import { DomainError } from "@/lib/errors";
import { ZodError } from "zod";

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

