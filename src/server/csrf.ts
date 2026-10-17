import { DomainError } from "@/lib/errors";
import { safeEqual } from "@/lib/crypto";

/**
 * CSRF protection for the JSON API (`/api/v1/*`). Server actions get Next.js's own Origin check;
 * everything here goes through `checkCsrf`, called once from the API entry point.
 *
 * A state-changing request (POST, PUT, PATCH, DELETE) must pass all of:
 *  1. Fetch metadata: if the browser sends `Sec-Fetch-Site`, it must be `same-origin` (or `none` for a typed URL).
 *  2. Origin: if `Origin` (or, failing that, `Referer`) is present it must be this app's origin. `Origin: null` is refused.
 *  3. Token: `x-csrf-token` must equal the `ms_csrf` cookie (double submit) and, when signed in,
 *     the secret stored with the session (so a token planted from another session does not work).
 * Login, registration and password recovery have no session yet, so they need only 1 and 2.
 * The payment webhook and the notification worker are server-to-server and are checked by signature or secret instead.
 */
export const CSRF_HEADER = "x-csrf-token";
export const SIGNED_ENDPOINTS = new Set(["payments/webhook", "notifications/process"]);
export const PRE_SESSION_ENDPOINTS = new Set(["auth/login", "auth/register", "auth/forgot", "auth/recover", "centers/register"]);
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export type CsrfInput = {
  method: string;
  slug: string;
  headers: Headers;
  requestUrl: string;
  appUrl?: string;
  cookieToken?: string | null;
  sessionToken?: string | null;
};

function originOf(value: string | null | undefined) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return "invalid";
  }
}

function allowedOrigins(input: CsrfInput) {
  const allowed = new Set<string>();
  const own = originOf(input.requestUrl);
  if (own && own !== "invalid") allowed.add(own);
  const host = input.headers.get("x-forwarded-host") ?? input.headers.get("host");
  if (host) {
    const proto = input.headers.get("x-forwarded-proto") ?? (input.requestUrl.startsWith("https") ? "https" : "http");
    allowed.add(`${proto}://${host}`);
  }
  const app = originOf(input.appUrl);
  if (app && app !== "invalid") allowed.add(app);
  return allowed;
}

/** Returns the reason a request must be refused, or null when it may go ahead. Pure, so it is unit-tested directly. */
export function checkCsrf(input: CsrfInput): DomainError | null {
  if (SAFE_METHODS.has(input.method.toUpperCase())) return null;
  if (SIGNED_ENDPOINTS.has(input.slug)) return null;
  const site = input.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    return new DomainError("CSRF_CROSS_SITE", "Cross-site request blocked", 403);
  }
  const origin = input.headers.get("origin");
  const allowed = allowedOrigins(input);
  if (origin !== null) {
    if (origin === "null" || !allowed.has(originOf(origin) ?? "")) return new DomainError("CSRF_ORIGIN", "Cross-origin request blocked", 403);
  } else {
    const referer = originOf(input.headers.get("referer"));
    if (referer && !allowed.has(referer)) return new DomainError("CSRF_ORIGIN", "Cross-origin request blocked", 403);
  }
  if (PRE_SESSION_ENDPOINTS.has(input.slug)) return null;
  // Nothing to protect on logout when there is no session.
  if (input.slug === "auth/logout" && !input.sessionToken && !input.cookieToken) return null;
  const header = input.headers.get(CSRF_HEADER) ?? "";
  const cookie = input.cookieToken ?? "";
  if (!header || !cookie || !safeEqual(header, cookie)) return new DomainError("CSRF", "Missing or invalid CSRF token. Reload the page and try again.", 403);
  if (input.sessionToken && !safeEqual(header, input.sessionToken)) return new DomainError("CSRF", "Missing or invalid CSRF token. Reload the page and try again.", 403);
  return null;
}

export function assertCsrfAllowed(input: CsrfInput) {
  const problem = checkCsrf(input);
  if (problem) throw problem;
}
