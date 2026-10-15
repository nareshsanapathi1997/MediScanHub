export function GET() {
  return Response.json({ ok: true, data: { service: "mediscan-hub" } });
}
