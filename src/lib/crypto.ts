import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function hmacSha256(secret: string, payload: string) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function stableHash(value: unknown) {
  return sha256(stableStringify(value));
}

export function publicCode(prefix: string) {
  return `${prefix}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

export function signPayload(secret: string, payload: Record<string, unknown>) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${hmacSha256(secret, body)}`;
}

export function readSignedPayload<T>(secret: string, token: string): T | null {
  const [body, sig] = token.split(".");
  if (!body || !sig || !safeEqual(hmacSha256(secret, body), sig)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}
