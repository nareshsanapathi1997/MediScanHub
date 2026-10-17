import { Pagination } from "@/components/pagination";
import { fetchPage, parsePage } from "@/lib/pagination";
import Link from "next/link";
import { CalendarSearch } from "lucide-react";
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
  const filters = {
    status,
    query: query.q,
    from: query.from ? new Date(`${query.from}T00:00:00+05:30`) : undefined,
    to: query.to ? new Date(`${query.to}T23:59:59+05:30`) : undefined,
  };
  const paged = await fetchPage(parsePage(query, 20), async (args) => {
    const found = await listBookings(actor, { ...filters, page: args.page, pageSize: args.pageSize });
    return { items: found.rows, total: found.total };
  });
  const page = paged.args.page;
  const result = { rows: paged.items, total: paged.total, pageSize: paged.args.pageSize };
  const today = istDate(0);
  const inDays = (days: number) => istDate(days);
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
      <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 text-sm" aria-label="Quick filters">
        {[{ label: "All", params: {} as Record<string, string> }, { label: "Today", params: { from: today, to: today } }, { label: "Next 7 days", params: { from: today, to: inDays(7) } }, ...["PENDING", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS"].map((item) => ({ label: titleCase(item), params: { status: item } }))].map((chip) => {
          const active = Object.keys(chip.params).length === 0 ? !query.status && !query.from && !query.to && !query.q : Object.entries(chip.params).every(([key, value]) => query[key as keyof typeof query] === value) && (chip.params.status ? !query.from : !query.status);
          return (
            <Link key={chip.label} href={`?${new URLSearchParams(chip.params)}`} aria-current={active ? "page" : undefined}
              className={active ? "shrink-0 rounded-full bg-primary px-3.5 py-1.5 font-medium text-primary-foreground" : "shrink-0 rounded-full border bg-card px-3.5 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"}>
              {chip.label}
            </Link>
          );
        })}
      </nav>
      {result.rows.length === 0 ? <EmptyState icon={CalendarSearch} title="No bookings found" body="Try other dates, or tap Reset to clear the filters." /> : (
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
      <Pagination pathname="/console/org/bookings" params={query} page={page} pageSize={result.pageSize} total={result.total} noun={result.total === 1 ? "booking" : "bookings"} label="Booking pages" />
    </>
  );
}

function istDate(offsetDays: number) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(Date.now() + offsetDays * 864e5));
}
