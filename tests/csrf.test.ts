import { describe, expect, it } from "vitest";
import { checkCsrf, type CsrfInput } from "@/server/csrf";

const app = "http://127.0.0.1:43211";
function req(overrides: Partial<Omit<CsrfInput, "headers">> & { headers?: Record<string, string> } = {}) {
  const { headers, ...rest } = overrides;
  return {
    method: "POST",
    slug: "report-files/abc",
    requestUrl: `${app}/api/v1/report-files/abc`,
    appUrl: app,
    cookieToken: "tok-1",
    sessionToken: "tok-1",
    ...rest,
    headers: new Headers({ host: "127.0.0.1:43211", origin: app, "sec-fetch-site": "same-origin", "x-csrf-token": "tok-1", ...headers }),
  } satisfies CsrfInput;
}

describe("central CSRF check", () => {
  it("lets a same-origin request with the session's token through, for every unsafe method", () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) expect(checkCsrf(req({ method }))).toBeNull();
    expect(checkCsrf(req({ method: "GET", headers: { origin: "https://evil.example", "x-csrf-token": "" } }))).toBeNull();
  });

  it("refuses cross-site and cross-origin requests even with a valid token", () => {
    expect(checkCsrf(req({ method: "DELETE", headers: { "sec-fetch-site": "cross-site" } }))?.code).toBe("CSRF_CROSS_SITE");
    expect(checkCsrf(req({ headers: { "sec-fetch-site": "same-site" } }))?.code).toBe("CSRF_CROSS_SITE");
    expect(checkCsrf(req({ method: "DELETE", headers: { origin: "https://evil.example" } }))?.status).toBe(403);
    expect(checkCsrf(req({ headers: { origin: "null" } }))?.code).toBe("CSRF_ORIGIN");
    const noOrigin = req({ method: "PUT" });
    noOrigin.headers.delete("origin");
    noOrigin.headers.delete("sec-fetch-site");
    noOrigin.headers.set("referer", "https://evil.example/page");
    expect(checkCsrf(noOrigin)?.code).toBe("CSRF_ORIGIN");
  });

  it("needs the double-submit token to match the cookie and the session", () => {
    expect(checkCsrf(req({ method: "DELETE", headers: { "x-csrf-token": "" } }))?.code).toBe("CSRF");
    expect(checkCsrf(req({ headers: { "x-csrf-token": "tok-2" } }))?.code).toBe("CSRF");
    expect(checkCsrf(req({ cookieToken: null }))?.code).toBe("CSRF");
    // An attacker who plants their own cookie and header pair still fails the session check.
    expect(checkCsrf(req({ cookieToken: "planted", sessionToken: "tok-1", headers: { "x-csrf-token": "planted" } }))?.code).toBe("CSRF");
    // Non-browser clients (no Origin, no fetch metadata) still need the token.
    const cli = req({ method: "PUT" });
    cli.headers.delete("origin");
    cli.headers.delete("sec-fetch-site");
    expect(checkCsrf(cli)).toBeNull();
    cli.headers.delete("x-csrf-token");
    expect(checkCsrf(cli)?.code).toBe("CSRF");
  });

  it("exempts only signed server-to-server calls from all checks, and pre-login forms from the token", () => {
    expect(checkCsrf(req({ slug: "payments/webhook", headers: { origin: "https://razorpay.example", "sec-fetch-site": "cross-site", "x-csrf-token": "" } }))).toBeNull();
    expect(checkCsrf(req({ slug: "auth/login", cookieToken: null, sessionToken: null, headers: { "x-csrf-token": "" } }))).toBeNull();
    expect(checkCsrf(req({ slug: "auth/login", cookieToken: null, sessionToken: null, headers: { origin: "https://evil.example", "x-csrf-token": "" } }))?.code).toBe("CSRF_ORIGIN");
    expect(checkCsrf(req({ slug: "auth/logout", headers: { "x-csrf-token": "" } }))?.code).toBe("CSRF");
  });
});
