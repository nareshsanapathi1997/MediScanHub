import Link from "next/link";
import { requireSession } from "@/server/session";
import { tenantAnalytics } from "@/lib/services/admin";
import { formatInr } from "@/lib/format";
import { Gate, NeedTenant } from "@/components/guard";
import { PageHeader, Stat, StatusPill } from "@/components/widgets";

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
  return (
    <>
      <PageHeader eyebrow="Analytics" title="Revenue and report time" description="Money collected and how long reports take, from booking to release. Report time shows after the first report is released." actions={
        // eslint-disable-next-line @next/next/no-html-link-for-pages
        <a className="text-sm text-primary" href="/api/v1/exports/bookings">Export bookings CSV</a>
      } />
      <form className="flex flex-wrap gap-2">
        <label className="field">From<input type="date" name="from" defaultValue={from} /></label>
        <label className="field">To<input type="date" name="to" defaultValue={to} /></label>
        <button className="h-10 self-end rounded-lg border px-3 text-sm" type="submit">Apply range</button>
      </form>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Captured" value={formatInr(data.capturedPaise)} hint={`${data.payments} payments`} />
        <Stat label="Mean release hours" value={String(data.averageReleaseHours)} />
        <Stat label="Booking states" value={String(data.byStatus.reduce((sum, row) => sum + row._count, 0))} />
      </div>
      <div className="flex flex-wrap gap-2">
        {data.byStatus.map((row) => <StatusPill key={row.status} value={`${row.status} ${row._count}`} />)}
        {data.samples.map((row) => <StatusPill key={row.status} value={`Sample ${row.status} ${row._count}`} />)}
      </div>
      <Link href="/console/finance" className="text-sm text-primary">Open finance</Link>
    </>
  );
}
