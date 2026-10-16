import Link from "next/link";
import { requireSession } from "@/server/session";
import { platformOverview } from "@/lib/services/admin";
import { formatInr, titleCase } from "@/lib/format";
import { AlertTriangle, Building2, IndianRupee, Users } from "@/components/icons";
import { buttonVariants } from "@/components/ui/button";
import { deny } from "@/components/guard";
import { PageHeader, Panel, Stat, StatusPill } from "@/components/widgets";
import { StatusBars, TrendChart } from "@/components/trend-chart";

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
  const total = (rows: Array<{ _count: number }>) => rows.reduce((sum, row) => sum + row._count, 0);
  return (
    <>
      <PageHeader eyebrow="Platform" title="Network at a glance" description="Live numbers for all centers. Centers waiting for approval are shown first." actions={<Link className={buttonVariants({ size: "sm" })} href="/console/admin/centers">Review centers</Link>} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat label="Centers" value={String(overview.centers)} hint={`${overview.branches} branches`} icon={Building2} />
        <Stat label="Patients" value={String(overview.patients)} hint={`${overview.bookings} bookings all time`} icon={Users} tone="info" />
        <Stat label="Captured payments" value={formatInr(overview.capturedPaise)} hint="All tenants, all time" icon={IndianRupee} tone="success" />
        <Stat label="Needs attention" value={String(overview.overdueSubscriptions + overview.openTickets)} hint={`${overview.overdueSubscriptions} overdue plans · ${overview.openTickets} open tickets`} icon={AlertTriangle} tone={overview.overdueSubscriptions + overview.openTickets ? "warning" : "success"} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Bookings, last 14 days" description="All centers, by day (IST).">
          <TrendChart data={overview.trend} />
        </Panel>
        <div className="grid content-start gap-4">
          <Panel title="Centers by status" description={`${total(overview.centersByStatus)} total`}>
            <StatusBars data={overview.centersByStatus.map((row) => ({ label: titleCase(row.status), value: row._count }))} />
          </Panel>
          <Panel title="Notification delivery" description={`${total(overview.notifications)} messages`} actions={<Link className="text-sm font-medium text-primary" href="/console/admin/notifications">Details</Link>}>
            <ul className="grid gap-2 text-sm">{overview.notifications.map((row) => <li key={row.status} className="flex items-center justify-between"><StatusPill value={row.status} /><span className="tabular-nums">{row._count}</span></li>)}</ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
