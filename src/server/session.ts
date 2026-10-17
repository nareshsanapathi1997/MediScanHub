import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveSession } from "@/lib/services/auth";

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

