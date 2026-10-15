import { DomainError } from "@/lib/errors";
import { ZodError } from "zod";
import { assertCsrf, assertSameOrigin, currentSession } from "@/server/session";
import type { Actor } from "@/domain/actor";

export function ok(data: unknown, status = 200) {
  return Response.json({ ok: true, data }, { status });
}

export function fail(error: unknown) {
  if (error instanceof DomainError) {
    return Response.json({ ok: false, error: { code: error.code, message: error.message, details: error.details ?? null } }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return Response.json({ ok: false, error: { code: "VALIDATION", message: "Invalid request", details: error.issues } }, { status: 422 });
  }
  console.error(error);
  return Response.json({ ok: false, error: { code: "INTERNAL", message: "Something went wrong" } }, { status: 500 });
}

export async function readBody(req: Request) {
  try {
    return await req.json();
  } catch {
    throw new DomainError("BAD_JSON", "Request body must be JSON", 400);
  }
}

type RouteCtx = { params: Promise<Record<string, string>> };

export function route(handler: (req: Request, ctx: RouteCtx & { actor: Actor | null }) => Promise<Response>, options?: { csrf?: boolean; auth?: boolean }) {
  return async (req: Request, ctx: RouteCtx) => {
    try {
      if (req.method !== "GET" && req.method !== "HEAD") {
        assertSameOrigin(req);
        if (options?.csrf !== false) await assertCsrf(req);
      }
      const session = await currentSession();
      if (options?.auth && !session) throw new DomainError("UNAUTHENTICATED", "Sign in required", 401);
      return await handler(req, { ...ctx, actor: session?.actor ?? null });
    } catch (error) {
      return fail(error);
    }
  };
}
