import { withScope } from "@/lib/scope";

/** False when DATABASE_URL uses a superuser (e.g. local postgres-only) and Postgres bypasses RLS. */
export async function databaseEnforcesRls(): Promise<boolean> {
  const rows = await withScope({}, (tx) => tx.booking.findMany({ take: 1 }));
  return rows.length === 0;
}
