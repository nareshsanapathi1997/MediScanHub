import { zipSync } from "fflate";

/** Builds tiny synthetic DICOM Part 10 files (explicit VR little endian) for tests. No real patient data. */
type El = { group: number; element: number; vr: string; value: Buffer };

function pad(value: Buffer, vr: string) {
  if (value.length % 2 === 0) return value;
  return Buffer.concat([value, Buffer.from([vr === "UI" || vr === "OB" ? 0 : 0x20])]);
}

function encode(el: El) {
  const value = pad(el.value, el.vr);
  const long = ["OB", "OW", "OF", "SQ", "UT", "UN"].includes(el.vr);
  const head = Buffer.alloc(long ? 12 : 8);
  head.writeUInt16LE(el.group, 0);
  head.writeUInt16LE(el.element, 2);
  head.write(el.vr, 4, "latin1");
  if (long) head.writeUInt32LE(value.length, 8);
  else head.writeUInt16LE(value.length, 6);
  return Buffer.concat([head, value]);
}

const str = (group: number, element: number, vr: string, text: string): El => ({ group, element, vr, value: Buffer.from(text, "latin1") });

export function syntheticDicom(input: { modality?: string; studyDate?: string; bodyPart?: string; studyUid?: string; seriesUid?: string; instance?: number } = {}) {
  const instanceUid = `1.2.826.0.1.3680043.10.999.${input.instance ?? 1}`;
  const metaBody = Buffer.concat([
    encode({ group: 2, element: 1, vr: "OB", value: Buffer.from([0, 1]) }),
    encode(str(2, 2, "UI", "1.2.840.10008.5.1.4.1.1.2")),
    encode(str(2, 3, "UI", instanceUid)),
    encode(str(2, 0x10, "UI", "1.2.840.10008.1.2.1")),
  ]);
  const groupLength = Buffer.alloc(4);
  groupLength.writeUInt32LE(metaBody.length, 0);
  const meta = Buffer.concat([encode({ group: 2, element: 0, vr: "UL", value: groupLength }), metaBody]);
  const body = Buffer.concat([
    encode(str(8, 0x18, "UI", instanceUid)),
    encode(str(8, 0x20, "DA", input.studyDate ?? "20261012")),
    encode(str(8, 0x60, "CS", input.modality ?? "CT")),
    encode(str(0x10, 0x10, "PN", "SYNTHETIC^PATIENT")),
    encode(str(0x10, 0x20, "LO", "SYN-000123")),
    encode(str(0x18, 0x15, "CS", input.bodyPart ?? "HEAD")),
    encode(str(0x20, 0x0d, "UI", input.studyUid ?? "1.2.826.0.1.3680043.10.999.100")),
    encode(str(0x20, 0x0e, "UI", input.seriesUid ?? "1.2.826.0.1.3680043.10.999.200")),
    encode({ group: 0x7fe0, element: 0x10, vr: "OW", value: Buffer.alloc(64, 7) }),
  ]);
  return Buffer.concat([Buffer.alloc(128), Buffer.from("DICM", "latin1"), meta, body]);
}

/** A zipped study: `series` series with `perSeries` images each, plus a DICOMDIR and a readme that are ignored or counted. */
export function syntheticDicomZip(input: { series?: number; perSeries?: number; modality?: string; bodyPart?: string; extra?: Record<string, Buffer> } = {}) {
  const files: Record<string, Uint8Array> = {};
  let n = 0;
  for (let s = 1; s <= (input.series ?? 2); s += 1) {
    for (let i = 1; i <= (input.perSeries ?? 3); i += 1) {
      n += 1;
      files[`STUDY/SERIES${s}/IM${i}.dcm`] = syntheticDicom({ modality: input.modality ?? "MR", seriesUid: `1.2.826.0.1.3680043.10.999.2${s}`, instance: n, bodyPart: input.bodyPart ?? "KNEE" });
    }
  }
  files["DICOMDIR"] = Buffer.from("not parsed");
  for (const [name, bytes] of Object.entries(input.extra ?? {})) files[name] = bytes;
  return Buffer.from(zipSync(files, { level: 6 }));
}
