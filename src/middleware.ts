import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const session = request.cookies.get("ms_session")?.value;
  const path = request.nextUrl.pathname;
  if (path.startsWith("/console") && !session) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-tenant-host", request.headers.get("host") ?? "");
  requestHeaders.set("x-pathname", path);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

// Large uploads skip middleware: it would buffer (and cap) the request body. The API checks auth and CSRF itself.
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|api/v1/uploads/).*)"] };
