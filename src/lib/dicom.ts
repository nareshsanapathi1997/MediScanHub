import { open } from "fs/promises";
import path from "path";
import dicomParser from "dicom-parser";
import yauzl from "yauzl";
import { DomainError } from "@/lib/errors";

/**
 * DICOM checks for report uploads. Pure JS (dicom-parser for headers, yauzl to walk zip files without unpacking them).
 * Only basic study facts are kept: modality, study date, body part and how many series and images there are.
 * Patient name, ID, birth date and all UIDs are never stored or shown.
 */
export const DICOM_MAX_MB = 500;
export const DICOM_MAX_BYTES = DICOM_MAX_MB * 1024 * 1024;
/** Header bytes read per image. Headers sit before the pixel data and are almost always far smaller. */
const HEADER_BYTES = 1024 * 1024;
const MAX_ZIP_ENTRIES = 20_000;

export type DicomMeta = {
  format: "dcm" | "zip";
  modalities: string[];
  studyDate: string | null;
  bodyParts: string[];
  studyCount: number;
  seriesCount: number;
  imageCount: number;
  otherFiles: number;
};

type Header = { modality: string | null; studyDate: string | null; bodyPart: string | null; studyUid: string | null; seriesUid: string | null };

export function hasDicomMagic(bytes: Uint8Array) {
  return bytes.length >= 132 && bytes[128] === 0x44 && bytes[129] === 0x49 && bytes[130] === 0x43 && bytes[131] === 0x4d;
}

export function hasZipMagic(bytes: Uint8Array) {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

function clean(value: string | undefined | null, max = 32) {
  const text = (value ?? "").replace(/[^\x20-\x7e]/g, "").trim();
  return text ? text.slice(0, max) : null;
}

function isoDate(value: string | null) {
  if (!value || !/^\d{8}$/.test(value)) return null;
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

/** Reads a few tags from the start of a DICOM Part 10 file. A cut-off header still gives the tags read so far. */
export function readDicomHeader(bytes: Uint8Array): Header {
  let dataSet: dicomParser.DataSet | undefined;
  try {
    dataSet = dicomParser.parseDicom(bytes, { untilTag: "x7fe00010" });
  } catch (error) {
    dataSet = (error as { dataSet?: dicomParser.DataSet }).dataSet;
  }
  if (!dataSet) throw new DomainError("UPLOAD", "This DICOM file could not be read. Export it again from the scanner.", 400);
  const read = (tag: string) => {
    try {
      return dataSet!.string(tag);
    } catch {
      return undefined;
    }
  };
  return {
    modality: clean(read("x00080060"), 8)?.toUpperCase() ?? null,
    studyDate: isoDate(clean(read("x00080020"), 8)),
    bodyPart: clean(read("x00180015"), 32)?.toUpperCase() ?? null,
    studyUid: clean(read("x0020000d"), 64),
    seriesUid: clean(read("x0020000e"), 64),
  };
}

function summarise(format: DicomMeta["format"], headers: Header[], otherFiles: number): DicomMeta {
  const dates = headers.map((item) => item.studyDate).filter((value): value is string => Boolean(value)).sort();
  return {
    format,
    modalities: [...new Set(headers.map((item) => item.modality).filter((value): value is string => Boolean(value)))].sort(),
    studyDate: dates[0] ?? null,
    bodyParts: [...new Set(headers.map((item) => item.bodyPart).filter((value): value is string => Boolean(value)))].sort().slice(0, 5),
    studyCount: Math.max(1, new Set(headers.map((item) => item.studyUid).filter(Boolean)).size),
    seriesCount: Math.max(1, new Set(headers.map((item) => item.seriesUid ?? "?")).size),
    imageCount: headers.length,
    otherFiles,
  };
}

async function readPrefix(filePath: string, length: number) {
  const handle = await open(filePath, "r");
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

function openZip(filePath: string) {
  return new Promise<yauzl.ZipFile>((resolve, reject) => {
    yauzl.open(filePath, { lazyEntries: true, autoClose: true, strictFileNames: false, validateEntrySizes: true }, (error, zip) => (error || !zip ? reject(error) : resolve(zip)));
  });
}

/** Reads at most `limit` bytes of one zip entry, then stops inflating it. */
function readEntryPrefix(zip: yauzl.ZipFile, entry: yauzl.Entry, limit: number) {
  return new Promise<Buffer>((resolve, reject) => {
    zip.openReadStream(entry, (error, stream) => {
      if (error || !stream) return reject(error);
      const chunks: Buffer[] = [];
      let total = 0;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve(Buffer.concat(chunks).subarray(0, limit));
      };
      stream.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
        total += chunk.length;
        if (total >= limit) {
          stream.unpipe();
          stream.destroy();
          finish();
        }
      });
      stream.on("end", finish);
      stream.on("close", finish);
      stream.on("error", (streamError) => (done ? undefined : reject(streamError)));
    });
  });
}

async function inspectZip(filePath: string): Promise<DicomMeta> {
  let zip: yauzl.ZipFile;
  try {
    zip = await openZip(filePath);
  } catch {
    throw new DomainError("UPLOAD", "This zip file is damaged or uses an unsupported format. Zip the DICOM folder again and retry.", 400);
  }
  if (zip.entryCount > MAX_ZIP_ENTRIES) {
    zip.close();
    throw new DomainError("UPLOAD", `The zip has too many files (more than ${MAX_ZIP_ENTRIES.toLocaleString("en-IN")}). Upload one study per zip.`, 400);
  }
  const headers: Header[] = [];
  let otherFiles = 0;
  await new Promise<void>((resolve, reject) => {
    zip.on("error", reject);
    zip.on("end", () => resolve());
    zip.on("entry", async (entry: yauzl.Entry) => {
      try {
        const name = entry.fileName;
        const base = path.posix.basename(name);
        if (name.endsWith("/") || name.startsWith("__MACOSX/") || base.startsWith(".")) return zip.readEntry();
        if (base.toUpperCase() === "DICOMDIR") return zip.readEntry();
        const prefix = await readEntryPrefix(zip, entry, HEADER_BYTES);
        if (hasDicomMagic(prefix)) headers.push(readDicomHeader(prefix));
        else otherFiles += 1;
        zip.readEntry();
      } catch (error) {
        reject(error instanceof DomainError ? error : new DomainError("UPLOAD", "A file inside the zip could not be read. Zip the DICOM folder again and retry.", 400));
      }
    });
    zip.readEntry();
  });
  if (headers.length === 0) throw new DomainError("UPLOAD", "The zip has no DICOM images. It should contain .dcm files from the scanner.", 400);
  return summarise("zip", headers, otherFiles);
}

/**
 * Checks an uploaded file on disk. A DICOM file must have "DICM" at byte 128. A zip must hold at least one such file.
 * Returns the content type to store and the safe study facts.
 */
export async function inspectDicomUpload(filePath: string, size: number, fileName: string): Promise<{ contentType: string; extension: "dcm" | "zip"; meta: DicomMeta }> {
  if (size === 0) throw new DomainError("UPLOAD", "The file is empty. Choose the file again.", 400);
  if (size > DICOM_MAX_BYTES) throw new DomainError("UPLOAD_TOO_LARGE", `The file is too large. The limit for DICOM uploads is ${DICOM_MAX_MB} MB.`, 413);
  const ext = path.extname(fileName).toLowerCase();
  const prefix = await readPrefix(filePath, Math.min(size, HEADER_BYTES));
  if (hasDicomMagic(prefix)) {
    if (ext && ext !== ".dcm" && ext !== ".dicom") throw new DomainError("UPLOAD", "This is a DICOM file. Name it with .dcm at the end.", 400);
    return { contentType: "application/dicom", extension: "dcm", meta: summarise("dcm", [readDicomHeader(prefix)], 0) };
  }
  if (hasZipMagic(prefix)) {
    if (ext !== ".zip") throw new DomainError("UPLOAD", "This is a zip file. Name it with .zip at the end.", 400);
    return { contentType: "application/zip", extension: "zip", meta: await inspectZip(filePath) };
  }
  throw new DomainError("UPLOAD", "Only DICOM files (.dcm) or a zip of a DICOM study are accepted here. Upload PDFs and photos in the form above.", 400);
}
