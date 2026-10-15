import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveSession } from "@/lib/services/auth";
import { safeEqual } from "@/lib/crypto";
import { DomainError } from "@/lib/errors";

export const SESSION_COOKIE = "ms_session";
export const CSRF_COOKIE = "ms_csrf";

export async function currentSession() {
  const jar = await cookies();
  return resolveSession(jar.get(SESSION_COOKIE)?.value);
}

export async function requireSession() {
  const session = await currentSession();
  if (!session) redirect("/login");
  return session;
}

export async function setSessionCookies(token: string, csrf: string) {
  const jar = await cookies();
  const secure = process.env.NODE_ENV === "production";
  jar.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 60 * 60 * 12 });
  jar.set(CSRF_COOKIE, csrf, { httpOnly: false, sameSite: "lax", secure, path: "/", maxAge: 60 * 60 * 12 });
}

export async function clearSessionCookies() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(CSRF_COOKIE);
}

export async function requestMeta() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return { ip: forwarded || h.get("x-real-ip"), userAgent: h.get("user-agent") };
}

export async function assertCsrf(req: Request) {
  const jar = await cookies();
  const cookie = jar.get(CSRF_COOKIE)?.value ?? "";
  const header = req.headers.get("x-csrf-token") ?? "";
  if (!cookie || !header || !safeEqual(cookie, header)) throw new DomainError("CSRF", "Invalid CSRF token", 403);
}

export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("host");
  if (!host) throw new DomainError("ORIGIN", "Missing host", 400);
  const expected = new URL(`${req.url.startsWith("https") ? "https" : "http"}://${host}`);
  if (new URL(origin).host !== expected.host && new URL(origin).host !== new URL(process.env.APP_URL || "http://127.0.0.1:43123").host) {
    throw new DomainError("ORIGIN", "Cross-origin request blocked", 403);
  }
}
