import Link from "next/link";
import { requireSession } from "@/server/session";
import { listBookings } from "@/lib/services/booking";
import { formatInr, formatWhen, titleCase } from "@/lib/format";
import { Button, buttonVariants } from "@/components/ui/button";
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
      <PageHeader eyebrow="Visits" title="Bookings" description={`${result.total} booking${result.total === 1 ? "" : "s"} found. Branch staff see only their own branches.`} />
      <form className="surface grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] lg:items-end" aria-label="Filter bookings">
        <label className="field">Booking code, patient name or mobile<input name="q" defaultValue={query.q} /></label>
        <label className="field">Status
          <select name="status" defaultValue={query.status ?? ""}>
            <option value="">Any</option>
            {statuses.map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}
          </select>
        </label>
        <label className="field">From<input type="date" name="from" defaultValue={query.from} /></label>
        <label className="field">To<input type="date" name="to" defaultValue={query.to} /></label>
        <div className="flex gap-2"><Button type="submit" className="h-11 flex-1 lg:flex-none">Apply</Button><Link href="/console/org/bookings" className={buttonVariants({ variant: "ghost", className: "h-11" })}>Reset</Link></div>
      </form>
      {result.rows.length === 0 ? <EmptyState title="No bookings found" body="Try other dates, or tap Reset to clear the filters." /> : (
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
      {pages > 1 ? (
        <nav aria-label="Pages" className="flex items-center justify-between text-sm">
          {page > 1 ? <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`?${new URLSearchParams({ ...clean(query), page: String(page - 1) })}`}>Previous page</Link> : <span />}
          <span className="text-muted-foreground">Page {page} of {pages}</span>
          {page < pages ? <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`?${new URLSearchParams({ ...clean(query), page: String(page + 1) })}`}>Next page</Link> : <span />}
        </nav>
      ) : null}
    </>
  );
}

function clean(query: Record<string, string | undefined>) {
  return Object.fromEntries(Object.entries(query).filter((entry): entry is [string, string] => Boolean(entry[1]) && entry[0] !== "page"));
}
