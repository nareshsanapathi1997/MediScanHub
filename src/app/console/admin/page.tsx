import { listTenantsAdmin } from "@/lib/services/admin";
import { formatDate } from "@/lib/format";
import { CheckCircle2, LifeBuoy, ScrollText } from "lucide-react";
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
  const [overview, pending] = await Promise.all([platformOverview(actor), listTenantsAdmin(actor, "PENDING").catch(() => [])]);
  const total = (rows: Array<{ _count: number }>) => rows.reduce((sum, row) => sum + row._count, 0);
  return (
    <>
      <PageHeader eyebrow="Platform" title="Network at a glance" description="Live numbers for all centers. Centers waiting for approval are shown first." actions={<Link className={buttonVariants({ size: "sm" })} href="/console/admin/centers">Review centers</Link>} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat label="Centers" value={String(overview.centers)} hint={`${overview.branches} branches`} icon={Building2} />
        <Stat label="Patients" value={String(overview.patients)} hint={`${overview.bookings} bookings all time`} icon={Users} tone="info" />
        <Stat label="Captured payments" value={formatInr(overview.capturedPaise)} hint="All centers, all time" icon={IndianRupee} tone="success" />
        <Stat label="Needs attention" value={String(overview.overdueSubscriptions + overview.openTickets)} hint={`${overview.overdueSubscriptions} overdue plans · ${overview.openTickets} open tickets`} icon={AlertTriangle} tone={overview.overdueSubscriptions + overview.openTickets ? "warning" : "success"} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Waiting for review" description={pending.length ? `${pending.length} center${pending.length === 1 ? "" : "s"} applied and need a decision.` : "No centers are waiting."} actions={<Link className="text-sm font-medium text-primary" href="/console/admin/centers?status=PENDING">Open queue</Link>}>
          {pending.length === 0 ? <p className="flex items-center gap-2 text-sm text-success"><CheckCircle2 className="size-4" aria-hidden />All caught up.</p> : (
            <ul className="-mx-5 -mb-5 divide-y border-t">
              {pending.slice(0, 5).map((tenant) => (
                <li key={tenant.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-warning/15 text-[oklch(0.5_0.12_65)]"><Building2 className="size-4" aria-hidden /></span>
                  <span className="grid min-w-0 flex-1"><span className="truncate font-medium">{tenant.name}</span><span className="text-xs text-muted-foreground">{tenant.city} · applied {formatDate(tenant.createdAt)} · {tenant.verifications.length} file{tenant.verifications.length === 1 ? "" : "s"}</span></span>
                  <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/console/admin/centers?status=PENDING">Review</Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Shortcuts">
          <ul className="-mx-2 grid gap-1 text-sm">
            {[
              { href: "/console/admin/tickets", label: "Support questions", hint: `${overview.openTickets} open`, icon: LifeBuoy },
              { href: "/console/admin/users", label: "Users and access", hint: "Search, suspend", icon: Users },
              { href: "/console/admin/plans", label: "Subscription plans", hint: `${overview.overdueSubscriptions} overdue`, icon: IndianRupee },
              { href: "/console/admin/audit", label: "Audit log", hint: "Who did what", icon: ScrollText },
            ].map((item) => (
              <li key={item.href}><Link href={item.href} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted"><item.icon className="size-4 text-primary" aria-hidden /><span className="flex-1 font-medium">{item.label}</span><span className="text-xs text-muted-foreground">{item.hint}</span></Link></li>
            ))}
          </ul>
        </Panel>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Bookings, last 14 days" description="All centers, by day (IST).">
          <TrendChart data={overview.trend} />
        </Panel>
        <div className="grid content-start gap-4">
          <Panel title="Centers by status" description={`${total(overview.centersByStatus)} total`}>
            <StatusBars data={overview.centersByStatus.map((row) => ({ label: titleCase(row.status), value: row._count }))} />
          </Panel>
          <Panel title="Notification delivery" description={`${total(overview.notifications)} ${total(overview.notifications) === 1 ? "message" : "messages"}`} actions={<Link className="text-sm font-medium text-primary" href="/console/admin/notifications">Details</Link>}>
            <ul className="grid gap-2 text-sm">{overview.notifications.map((row) => <li key={row.status} className="flex items-center justify-between"><StatusPill value={row.status} /><span className="tabular-nums">{row._count}</span></li>)}</ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
