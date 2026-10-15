import Link from "next/link";
import { requireSession } from "@/server/session";
import { listBookings } from "@/lib/services/booking";
import { formatInr, formatWhen } from "@/lib/format";
import { Gate, NeedTenant } from "@/components/guard";
import { PageHeader, EmptyState } from "@/components/widgets";
import { BookingTable } from "@/components/record-tables";
import type { BookingStatus } from "@prisma/client";

export const metadata = { title: "Bookings" };

const statuses: BookingStatus[] = ["PENDING", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED", "CANCELLED", "REFUNDED"];

export default async function OrgBookingsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; from?: string; to?: string; page?: string }> }) {
  const { actor } = await requireSession();
  const query = await searchParams;
  return (
    <Gate actor={actor} permission="bookings.read">
      <NeedTenant actor={actor}>
        <BookingsBody query={query} />
      </NeedTenant>
    </Gate>
  );
}

async function BookingsBody({ query }: { query: { status?: string; q?: string; from?: string; to?: string; page?: string } }) {
  const { actor } = await requireSession();
  const status = statuses.find((item) => item === query.status);
  const page = Number(query.page ?? "1") || 1;
  const result = await listBookings(actor, {
    status,
    query: query.q,
    from: query.from ? new Date(`${query.from}T00:00:00+05:30`) : undefined,
    to: query.to ? new Date(`${query.to}T23:59:59+05:30`) : undefined,
    page,
  });
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  return (
    <>
      <PageHeader eyebrow="Visits" title="Bookings" description={`${result.total} in this filter. Branch staff only see their assigned branches.`} />
      <form className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-4">
        <label className="field">Code or patient<input name="q" defaultValue={query.q} /></label>
        <label className="field">Status
          <select name="status" defaultValue={query.status ?? ""}>
            <option value="">Any</option>
            {statuses.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="field">From<input type="date" name="from" defaultValue={query.from} /></label>
        <label className="field">To<input type="date" name="to" defaultValue={query.to} /></label>
        <button className="h-10 rounded-lg bg-primary px-3 text-sm text-primary-foreground" type="submit">Apply</button>
      </form>
      {result.rows.length === 0 ? <EmptyState title="No visits in this range" body="Widen the dates or clear the status filter." /> : (
        <BookingTable rows={result.rows.map((booking) => ({
          href: `/console/org/bookings/${booking.id}`,
          code: booking.publicCode,
          patient: booking.patient.user.name,
          status: booking.status,
          visit: booking.visitType,
          when: formatWhen(booking.scheduledAt),
          total: formatInr(booking.totalPaise),
        }))} />
      )}
      <div className="flex gap-3 text-sm">
        {page > 1 ? <Link href={`?page=${page - 1}&status=${query.status ?? ""}&q=${query.q ?? ""}&from=${query.from ?? ""}&to=${query.to ?? ""}`}>Previous</Link> : null}
        <span>Page {page} of {pages}</span>
        {page < pages ? <Link href={`?page=${page + 1}&status=${query.status ?? ""}&q=${query.q ?? ""}&from=${query.from ?? ""}&to=${query.to ?? ""}`}>Next</Link> : null}
      </div>
    </>
  );
}
