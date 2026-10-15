import Link from "next/link";
import { requireSession } from "@/server/session";
import { platformOverview } from "@/lib/services/admin";
import { formatInr } from "@/lib/format";
import { deny } from "@/components/guard";
import { PageHeader, Stat, StatusPill } from "@/components/widgets";
import { TrendChart } from "@/components/trend-chart";

export const metadata = { title: "Platform" };

export default async function AdminHome() {
  const { actor } = await requireSession();
  const blocked = deny(actor, "platform.read");
  if (blocked) return blocked;
  return <AdminBody />;
}

async function AdminBody() {
  const { actor } = await requireSession();
  const overview = await platformOverview(actor);
  return (
    <>
      <PageHeader eyebrow="Platform" title="Network at a glance" description="Counts come from the database, not a sample chart. Pending centers still need a review decision." actions={<Link className="text-sm text-primary" href="/console/admin/centers">Review centers</Link>} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Centers" value={String(overview.centers)} />
        <Stat label="Branches" value={String(overview.branches)} />
        <Stat label="Patients" value={String(overview.patients)} />
        <Stat label="Bookings" value={String(overview.bookings)} />
        <Stat label="Captured payments" value={formatInr(overview.capturedPaise)} hint="Patient and other captured payments" />
        <Stat label="Overdue subscriptions" value={String(overview.overdueSubscriptions)} />
        <Stat label="Open tickets" value={String(overview.openTickets)} />
      </div>
      <section className="rounded-2xl border bg-card p-4">
        <h2 className="font-display text-2xl">Bookings, last 14 days</h2>
        <TrendChart data={overview.trend} />
      </section>
      <section className="flex flex-wrap gap-2">
        {overview.centersByStatus.map((row) => <StatusPill key={row.status} value={`${row.status} ${row._count}`} />)}
        {overview.notifications.map((row) => <StatusPill key={row.status} value={`${row.status} notices ${row._count}`} />)}
      </section>
    </>
  );
}
