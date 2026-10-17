import Link from "next/link";
import { requireSession } from "@/server/session";
import { tenantAnalytics } from "@/lib/services/admin";
import { formatInr } from "@/lib/format";
import { Gate, NeedTenant } from "@/components/guard";
import { PageHeader, Panel, Stat, StatusPill } from "@/components/widgets";
import { buttonVariants } from "@/components/ui/button";
import { CalendarCheck, Download, IndianRupee, Timer } from "lucide-react";

export const metadata = { title: "Analytics" };

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const { actor } = await requireSession();
  const query = await searchParams;
  return (
    <Gate actor={actor} permission="analytics.read">
      <NeedTenant actor={actor}>
        <AnalyticsBody from={query.from} to={query.to} />
      </NeedTenant>
    </Gate>
  );
}

async function AnalyticsBody({ from, to }: { from?: string; to?: string }) {
  const { actor } = await requireSession();
  const data = await tenantAnalytics(actor, from ? new Date(`${from}T00:00:00+05:30`) : undefined, to ? new Date(`${to}T23:59:59+05:30`) : undefined);
  const bookings = data.byStatus.reduce((sum, row) => sum + row._count, 0);
  const sampleTotal = data.samples.reduce((sum, row) => sum + row._count, 0);
  return (
    <>
      <PageHeader eyebrow="Analytics" title="Revenue and report time" description="Money collected and how long reports take, from booking to release. Report time shows after the first report is released." actions={
        // eslint-disable-next-line @next/next/no-html-link-for-pages
        <a className={buttonVariants({ variant: "outline" })} href="/api/v1/exports/bookings"><Download className="size-4" aria-hidden />Export bookings CSV</a>
      } />
      <form className="surface flex flex-wrap items-end gap-3 p-4">
        <label className="field">From<input type="date" name="from" defaultValue={from} /></label>
        <label className="field">To<input type="date" name="to" defaultValue={to} /></label>
        <button className={buttonVariants()} type="submit">Apply range</button>
        {from || to ? <Link href="/console/org/analytics" className="h-10 content-center px-2 text-sm text-muted-foreground hover:text-foreground">Clear</Link> : <span className="h-10 content-center text-sm text-muted-foreground">Showing all time</span>}
      </form>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Money collected" value={formatInr(data.capturedPaise)} hint={`${data.payments} payments`} icon={IndianRupee} tone="success" />
        <Stat label="Average report time" value={data.averageReleaseHours ? `${data.averageReleaseHours} h` : "—"} hint="Booking to release" icon={Timer} tone="info" />
        <Stat label="Bookings" value={String(bookings)} hint="In this range" icon={CalendarCheck} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Breakdown title="Bookings by status" rows={data.byStatus.map((row) => ({ label: row.status, count: row._count }))} total={bookings} empty="No bookings in this range." />
        <Breakdown title="Samples by status" rows={data.samples.map((row) => ({ label: row.status, count: row._count }))} total={sampleTotal} empty="No samples in this range." />
      </div>
      <Link href="/console/finance" className="text-sm font-medium text-primary hover:underline">Open finance →</Link>
    </>
  );
}

function Breakdown({ title, rows, total, empty }: { title: string; rows: Array<{ label: string; count: number }>; total: number; empty: string }) {
  return (
    <Panel title={title}>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : (
        <ul className="grid gap-3">
          {[...rows].sort((a, b) => b.count - a.count).map((row) => (
            <li key={row.label} className="grid gap-1.5">
              <div className="flex items-center justify-between gap-2 text-sm"><StatusPill value={row.label} /><span className="tabular-nums text-muted-foreground">{row.count} · {Math.round((row.count / Math.max(total, 1)) * 100)}%</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.max(2, (row.count / Math.max(total, 1)) * 100)}%` }} /></div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
