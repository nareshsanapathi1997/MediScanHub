import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { getEnv } from "@/lib/env";
import { readSignedPayload, signPayload } from "@/lib/crypto";
import { DomainError } from "@/lib/errors";

export type ReportLink = { reportId: string; version: number; exp: number };

const ALLOWED = new Set(["application/pdf", "image/png", "image/jpeg"]);

function sniffUpload(bytes: Buffer): "pdf" | "png" | "jpeg" | null {
  if (bytes.subarray(0, 4).toString("utf8") === "%PDF") return "pdf";
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  return null;
}

export function assertUpload(bytes: Buffer, claimedName: string, maxMb = 5) {
  if (bytes.length === 0 || bytes.length > maxMb * 1024 * 1024) {
    throw new DomainError("UPLOAD", bytes.length === 0 ? "The file is empty. Choose the file again." : `The file is too large. The limit is ${maxMb} MB.`, 400);
  }
  const kind = sniffUpload(bytes);
  if (!kind) throw new DomainError("UPLOAD", "Only PDF, PNG and JPEG files are accepted.", 400);
  const ext = path.extname(claimedName).toLowerCase();
  const expected = kind === "jpeg" ? [".jpg", ".jpeg"] : [`.${kind}`];
  if (ext && !expected.includes(ext)) throw new DomainError("UPLOAD", "The file name does not match the file type. Rename it or export it again.", 400);
  const contentType = kind === "pdf" ? "application/pdf" : kind === "png" ? "image/png" : "image/jpeg";
  if (!ALLOWED.has(contentType)) throw new DomainError("UPLOAD", "Unsupported file", 400);
  return { kind, contentType };
}

async function putLocal(key: string, body: Buffer) {
  const root = path.resolve(process.cwd(), getEnv().LOCAL_STORAGE_DIR);
  const target = path.resolve(root, key);
  if (!target.startsWith(root)) throw new DomainError("STORAGE", "Invalid storage key", 400);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, body);
}

async function getLocal(key: string) {
  const root = path.resolve(process.cwd(), getEnv().LOCAL_STORAGE_DIR);
  const target = path.resolve(root, key);
  if (!target.startsWith(root)) throw new DomainError("STORAGE", "Invalid storage key", 400);
  return readFile(target);
}

function s3() {
  const env = getEnv();
  return new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID!, secretAccessKey: env.S3_SECRET_ACCESS_KEY! },
    forcePathStyle: Boolean(env.S3_ENDPOINT),
  });
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  const env = getEnv();
  if (env.STORAGE_PROVIDER === "s3") {
    await s3().send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: body, ContentType: contentType }));
    return;
  }
  await putLocal(key, body);
}

export async function getObject(key: string) {
  const env = getEnv();
  if (env.STORAGE_PROVIDER === "s3") {
    const response = await s3().send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    const bytes = await response.Body?.transformToByteArray();
    if (!bytes) throw new DomainError("STORAGE", "Empty object", 404);
    return Buffer.from(bytes);
  }
  return getLocal(key);
}

export function signReportLink(reportId: string, version: number, ttlSeconds = 300) {
  const payload: ReportLink = { reportId, version, exp: Date.now() + ttlSeconds * 1000 };
  return signPayload(getEnv().FILE_SIGNING_SECRET, payload);
}

export function readReportLink(token: string): ReportLink {
  const payload = readSignedPayload<ReportLink>(getEnv().FILE_SIGNING_SECRET, token);
  if (!payload || payload.exp < Date.now() || !payload.reportId) {
    throw new DomainError("LINK_EXPIRED", "This file link is invalid or has expired", 401);
  }
  return payload;
}

export type FileLink = { fileId: string; exp: number };

/** Short-lived signed link for an uploaded report file. The download route still checks the session. */
export function signFileLink(fileId: string, ttlSeconds = 300) {
  const payload: FileLink = { fileId, exp: Date.now() + ttlSeconds * 1000 };
  return signPayload(getEnv().FILE_SIGNING_SECRET, payload);
}

export function readFileLink(token: string): FileLink {
  const payload = readSignedPayload<FileLink>(getEnv().FILE_SIGNING_SECRET, token);
  if (!payload || payload.exp < Date.now() || !payload.fileId) {
    throw new DomainError("LINK_EXPIRED", "This file link is invalid or has expired", 401);
  }
  return payload;
}
