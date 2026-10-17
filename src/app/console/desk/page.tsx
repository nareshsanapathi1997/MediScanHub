import { Pagination } from "@/components/pagination";
import { fetchPage, parsePage } from "@/lib/pagination";
import type { BookingStatus } from "@prisma/client";
import { istDayKey, istDayStart } from "@/lib/format";
import Link from "next/link";
import { randomUUID } from "crypto";
import { requireSession } from "@/server/session";
import { listBookings } from "@/lib/services/booking";
import { listAccessibleBranches, listBookablePackages, listBookableServices } from "@/lib/services/catalog";
import { walkInAction } from "@/server/actions";
import { Gate, NeedTenant } from "@/components/guard";
import { FormBox } from "@/components/form-box";
import { EmptyState, ItemList, PageHeader, Panel, Stat, StatusPill, Workspace } from "@/components/widgets";
import { hasPermission } from "@/domain/actor";
import { CalendarCheck, ChevronRight, Clock, IndianRupee, UserCheck, Users } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Front desk" };

export default async function DeskPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { actor } = await requireSession();
  const params = await searchParams;
  return (
    <Gate actor={actor} permission="bookings.manage">
      <NeedTenant actor={actor}>
        <DeskBody params={params} />
      </NeedTenant>
    </Gate>
  );
}

async function DeskBody({ params }: { params: { page?: string } }) {
  const { actor } = await requireSession();
  const queue = { from: istDayStart(), to: new Date(istDayStart(new Date(), 1).getTime() - 1) };
  const queueCount = (status: BookingStatus) => listBookings(actor, { queue, status, pageSize: 1 }).then((result) => result.total);
  const [{ items: due, total, args: paging }, pending, confirmed, checkedIn, branches, services, packages] = await Promise.all([
    fetchPage(parsePage(params, 12), async (args) => {
      const result = await listBookings(actor, { queue, page: args.page, pageSize: args.pageSize });
      return { items: result.rows, total: result.total };
    }),
    queueCount("PENDING"),
    queueCount("CONFIRMED"),
    queueCount("CHECKED_IN"),
    listAccessibleBranches(actor),
    listBookableServices(actor),
    listBookablePackages(actor),
  ]);
  const today = istDayKey(new Date());
  const counts: Record<string, number> = { PENDING: pending, CONFIRMED: confirmed, CHECKED_IN: checkedIn };
  const count = (status: string) => counts[status] ?? 0;
  const canCollect = hasPermission(actor, "invoices.manage", actor.activeTenantId);
  const choice = "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5";
  return (
    <>
      <PageHeader
        eyebrow="Reception"
        title="Front desk"
        description="Check in patients and add walk-ins. Walk-in bookings are confirmed at once. Online bookings stay pending until they are paid."
        actions={canCollect ? <Link href="/console/finance" className={buttonVariants({ variant: "outline", size: "sm" })}><IndianRupee className="size-4" aria-hidden />Collect payment</Link> : undefined}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="In the queue" value={String(total)} icon={Users} />
        <Stat label="Waiting for payment" value={String(count("PENDING"))} icon={Clock} tone="warning" />
        <Stat label="Confirmed" value={String(count("CONFIRMED"))} icon={CalendarCheck} tone="info" />
        <Stat label="Checked in" value={String(count("CHECKED_IN"))} icon={UserCheck} tone="success" />
      </div>
      <Workspace aside={
        <Panel title="Record a walk-in" description="Creates the patient if new and confirms the visit.">
          <FormBox action={walkInAction} submit="Record walk-in">
            <label className="field">Branch
              <select name="branchId" required>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>
            </label>
            <label className="field">Patient name<input name="name" required autoComplete="off" /></label>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <label className="field">Phone<input name="phone" required inputMode="tel" placeholder="+91 98765 43210" /></label>
              <label className="field">Email<input name="email" type="email" required /></label>
              <label className="field">Date of birth<input name="dateOfBirth" type="date" required /></label>
              <label className="field">Sex
                <select name="sex" defaultValue="FEMALE"><option value="FEMALE">Female</option><option value="MALE">Male</option><option value="INTERSEX">Intersex</option><option value="UNKNOWN">Unknown</option></select>
              </label>
            </div>
            <fieldset className="grid gap-1.5">
              <legend className="mb-1.5 text-sm font-medium">Tests and scans</legend>
              <div className="grid max-h-56 gap-1.5 overflow-y-auto pr-1">
                {services.filter((service) => service.published).map((service) => (
                  <label key={service.id} className={choice}><input type="checkbox" name="serviceIds" value={service.id} className="size-4 accent-[var(--primary)]" />{service.name}</label>
                ))}
              </div>
            </fieldset>
            {packages.some((pkg) => pkg.published) ? (
              <fieldset className="grid gap-1.5">
                <legend className="mb-1.5 text-sm font-medium">Packages</legend>
                {packages.filter((pkg) => pkg.published).map((pkg) => (
                  <label key={pkg.id} className={choice}><input type="checkbox" name="packageIds" value={pkg.id} className="size-4 accent-[var(--primary)]" />{pkg.name}</label>
                ))}
              </fieldset>
            ) : null}
            <p className="text-xs text-muted-foreground">Pick at least one test, scan or package.</p>
            <input type="hidden" name="idempotencyKey" value={randomUUID()} />
          </FormBox>
        </Panel>
      }>
        <Panel title="Today’s queue" description="Pending, confirmed and checked-in visits, plus everything booked for today.">
          {due.length === 0 ? <EmptyState icon={Users} title="No visits waiting" body="There are no pending visits or visits today at your branches. Add a walk-in patient from the form." /> : (
            <ItemList>
              {due.map((booking) => (
                <li key={booking.id}>
                  <Link href={`/console/org/bookings/${booking.id}`} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/60">
                    <span className="grid w-14 shrink-0 text-center">
                      <span className="text-sm font-semibold tabular-nums">{timeFormat.format(new Date(booking.scheduledAt))}</span>
                      <span className="text-[11px] text-muted-foreground">{istDayKey(new Date(booking.scheduledAt)) === today ? "Today" : dayFormat.format(new Date(booking.scheduledAt))}</span>
                    </span>
                    <span className="grid min-w-0 flex-1">
                      <span className="truncate font-medium">{booking.patient.user.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">{booking.publicCode}</span>
                    </span>
                    <StatusPill value={booking.status} />
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ItemList>
          )}
          {total > 0 ? <Pagination className="mt-9" pathname="/console/desk" params={params} page={paging.page} pageSize={paging.pageSize} total={total} noun={total === 1 ? "visit" : "visits"} label="Queue pages" /> : null}
        </Panel>
      </Workspace>
    </>
  );
}

const timeFormat = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const dayFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
