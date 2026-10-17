import Link from "next/link";
import { requireSession } from "@/server/session";
import { tenantDashboard, todayOverview } from "@/lib/services/admin";
import { prismaPrivileged } from "@/lib/db";
import { tenantProfileAction } from "@/server/actions";
import { formatInr, formatWhen, titleCase } from "@/lib/format";
import { CalendarDays, FileClock, IndianRupee, Truck, ArrowRight, MapPin, Phone, Globe } from "@/components/icons";
import { tenantBranches } from "@/lib/services/catalog";
import { openStatus } from "@/lib/hours";
import { UserPlus } from "lucide-react";
import { TrendChart, StatusBars } from "@/components/trend-chart";
import { Gate, NeedTenant } from "@/components/guard";
import { FormBox } from "@/components/form-box";
import { PageHeader, Panel, Stat, StatusPill } from "@/components/widgets";
import { formatPhone } from "@/components/center-profile/utils";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Center overview" };

export default async function OrgHome() {
  const { actor } = await requireSession();
  return (
    <Gate actor={actor} permission="tenant.read">
      <NeedTenant actor={actor}>
        <OrgBody />
      </NeedTenant>
    </Gate>
  );
}

async function OrgBody() {
  const { actor } = await requireSession();
  const [today, tenant, board] = await Promise.all([
    todayOverview(actor),
    prismaPrivileged.tenant.findUnique({ where: { id: actor.activeTenantId! } }),
    tenantDashboard(actor),
  ]);
  const branches = await tenantBranches(actor).catch(() => []);
  if (!tenant) return null;
  const canManage = actor.memberships.some((membership) => membership.tenantId === tenant.id && membership.permissions.includes("tenant.manage"));
  const order = ["DRAFT", "ENTERED", "VERIFIED", "APPROVED", "RELEASED", "AMENDED", "REJECTED"];
  const pipeline = order.map((status) => ({ label: titleCase(status), value: board.pipeline.find((row) => row.status === status)?._count ?? 0 })).filter((row) => row.value > 0);
  const total14 = board.trend.reduce((sum, row) => sum + row.bookings, 0);
  return (
    <>
      <PageHeader
        eyebrow={`${tenant.city} · ${titleCase(tenant.status)}`}
        title={tenant.name}
        description={tenant.about.length > 220 ? `${tenant.about.slice(0, tenant.about.lastIndexOf(" ", 220))}…` : tenant.about}
        actions={<Link className={buttonVariants({ size: "sm" })} href="/console/org/bookings">Open bookings <ArrowRight className="size-4" aria-hidden /></Link>}
      />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat label="Visits today" value={String(today.bookings)} hint="Scheduled for today, excluding cancellations" icon={CalendarDays} />
        <Stat label="Reports in progress" value={String(today.pendingReports)} hint="Draft through approved, not yet released" icon={FileClock} tone="warning" />
        <Stat label="Open collections" value={String(today.collections)} hint="Requested, assigned, or en route" icon={Truck} tone="info" />
        <Stat label="Captured today" value={formatInr(today.capturedPaise)} hint="Payments captured since midnight IST" icon={IndianRupee} tone="success" />
      </div>
      <nav aria-label="Quick actions" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { href: "/console/desk", label: "Add a walk-in", icon: UserPlus },
          { href: "/console/org/schedule", label: "Open slots", icon: CalendarDays },
          { href: "/console/lab", label: "Lab worklist", icon: FileClock },
          { href: "/console/finance", label: "Collect payment", icon: IndianRupee },
        ].map((action) => (
          <Link key={action.href} href={action.href} className="surface group flex items-center gap-3 p-3.5 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-primary/5">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><action.icon className="size-4" aria-hidden /></span>
            <span className="flex-1">{action.label}</span>
            <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        ))}
      </nav>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Bookings, last 14 days" description={`${total14} booking${total14 === 1 ? "" : "s"} created in this period (IST).`}>
          <TrendChart data={board.trend} />
        </Panel>
        <Panel title="Report pipeline" description="Every report is checked by a doctor before the patient can see it.">
          <StatusBars data={pipeline} />
        </Panel>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
      <Panel className="lg:col-span-2" title="Up next" description="The next visits at your branches." actions={<Link href="/console/desk" className="text-sm font-medium text-primary">Front desk</Link>}>
        {board.upcoming.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No upcoming visits.</p> : (
          <ul className="divide-y">
            {board.upcoming.map((booking) => (
              <li key={booking.id}>
                <Link href={`/console/org/bookings/${booking.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm hover:text-primary">
                  <span className="min-w-0">
                    <span className="font-medium">{booking.patient.user.name}</span>
                    <span className="block text-xs text-muted-foreground">{booking.publicCode} · {booking.branch.name} · {titleCase(booking.visitType)}</span>
                  </span>
                  <span className="flex items-center gap-3"><span className="text-xs text-muted-foreground tabular-nums">{formatWhen(booking.scheduledAt)}</span><StatusPill value={booking.status} /></span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
        <Panel title="Branches" description="Open-now status in IST." actions={canManage ? <Link href="/console/org/branches" className="text-sm font-medium text-primary">Edit hours</Link> : undefined}>
          <ul className="grid gap-3">
            {branches.map((branch) => {
              const status = openStatus([branch]);
              return (
                <li key={branch.id} className="flex items-start gap-3 text-sm">
                  <span className={status.open ? "mt-1.5 size-2.5 shrink-0 rounded-full bg-success ring-4 ring-success/15" : "mt-1.5 size-2.5 shrink-0 rounded-full bg-muted-foreground/40 ring-4 ring-muted"} aria-hidden />
                  <span className="grid"><span className="font-medium">{branch.name}</span><span className="text-xs text-muted-foreground">{status.label}</span></span>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>
      <Panel title="Center profile" description="Shown on your public page and on patient bills.">
        <ul className="mb-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
          <li className="flex items-center gap-2"><MapPin className="size-4 shrink-0" aria-hidden />{tenant.address}</li>
          <li className="flex items-center gap-2"><Phone className="size-4 shrink-0" aria-hidden />{formatPhone(tenant.phone)}</li>
          <li className="flex items-center gap-2"><Globe className="size-4 shrink-0" aria-hidden />{tenant.customDomain ?? `/centers/${tenant.slug}`}</li>
        </ul>
        {canManage ? (
          <details className="group rounded-xl border bg-muted/30 p-4">
            <summary className="cursor-pointer text-sm font-medium text-primary">Edit profile and branding</summary>
            <div className="mt-4">
              <FormBox action={tenantProfileAction} submit="Save center profile">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="field">Name<input name="name" defaultValue={tenant.name} required /></label>
                  <label className="field">Phone<input name="phone" defaultValue={tenant.phone} required /></label>
                  <label className="field">City<input name="city" defaultValue={tenant.city} required /></label>
                  <label className="field">Logo URL<input name="logoUrl" defaultValue={tenant.logoUrl ?? ""} placeholder="https://… or /centers/your-slug/logo.svg" /></label>
                  <label className="field">Cover image URL<input name="coverImageUrl" defaultValue={tenant.coverImageUrl ?? ""} placeholder="https://… or /centers/your-slug/cover.svg" /></label>
                  <label className="field sm:col-span-2">Gallery image URLs<textarea name="galleryUrls" defaultValue={(tenant.galleryUrls ?? []).join("\n")} rows={4} placeholder="One https or /public path per line" /></label>
                  <label className="field">Brand color<input name="brandColor" type="color" defaultValue={tenant.brandColor} required className="h-11 p-1" /></label>
                  <label className="field">Accent color<input name="accentColor" type="color" defaultValue={tenant.accentColor} required className="h-11 p-1" /></label>
                  <label className="field sm:col-span-2">Custom domain<input name="customDomain" defaultValue={tenant.customDomain ?? ""} placeholder="book.example.com" /></label>
                  <label className="field sm:col-span-2">Address<textarea name="address" defaultValue={tenant.address} required rows={2} /></label>
                  <label className="field sm:col-span-2">About<textarea name="about" defaultValue={tenant.about} required rows={3} /></label>
                </div>
              </FormBox>
            </div>
          </details>
        ) : null}
      </Panel>
    </>
  );
}
