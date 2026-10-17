import { createHash, randomUUID } from "crypto";
import { createWriteStream } from "fs";
import { mkdir, unlink } from "fs/promises";
import os from "os";
import path from "path";
import { DomainError } from "@/lib/errors";

/**
 * Streams a raw request body (PUT with the file as the body) to a private temp file, hashing as it goes.
 * Stops and deletes the file as soon as it passes `maxBytes`, so nothing large is held in memory.
 */
export async function receiveUpload(req: Request, maxBytes: number) {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > maxBytes) throw new DomainError("UPLOAD_TOO_LARGE", `The file is too large. The limit is ${Math.round(maxBytes / 1024 / 1024)} MB.`, 413);
  if (!req.body) throw new DomainError("UPLOAD", "Choose a file to upload.", 400);
  const dir = path.join(os.tmpdir(), "mediscan-uploads");
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const filePath = path.join(dir, randomUUID());
  const out = createWriteStream(filePath, { mode: 0o600 });
  const hash = createHash("sha256");
  let size = 0;
  const reader = req.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new DomainError("UPLOAD_TOO_LARGE", `The file is too large. The limit is ${Math.round(maxBytes / 1024 / 1024)} MB.`, 413);
      }
      hash.update(value);
      if (!out.write(value)) await new Promise<void>((resolve) => out.once("drain", () => resolve()));
    }
    await new Promise<void>((resolve, reject) => out.end((error?: Error | null) => (error ? reject(error) : resolve())));
  } catch (error) {
    out.destroy();
    await unlink(filePath).catch(() => undefined);
    throw error;
  }
  return {
    filePath,
    size,
    checksum: hash.digest("hex"),
    cleanup: () => unlink(filePath).catch(() => undefined),
  };
}
