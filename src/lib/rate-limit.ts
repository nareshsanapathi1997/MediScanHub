import { prismaPrivileged } from "@/lib/db";

type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();

function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((stamp) => now - stamp < windowMs);
  if (bucket.timestamps.length >= limit) {
    buckets.set(key, bucket);
    return { ok: false as const, retryAfterMs: windowMs - (now - bucket.timestamps[0]) };
  }
  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  return { ok: true as const };
}

export async function rateLimitShared(key: string, limit: number, windowMs: number) {
  if (process.env.RATE_LIMIT_STORE !== "postgres") return rateLimit(key, limit, windowMs);
  const since = new Date(Date.now() - windowMs);
  const count = await prismaPrivileged.rateLimitHit.count({ where: { bucketKey: key, hitAt: { gte: since } } });
  if (count >= limit) return { ok: false as const, retryAfterMs: windowMs };
  await prismaPrivileged.rateLimitHit.create({ data: { bucketKey: key } });
  await prismaPrivileged.rateLimitHit.deleteMany({ where: { hitAt: { lt: since } } });
  return { ok: true as const };
}
