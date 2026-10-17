import { Pagination } from "@/components/pagination";
import { fetchPage, parsePage } from "@/lib/pagination";
import { requireSession } from "@/server/session";
import { listAccessibleBranches } from "@/lib/services/catalog";
import { slotAction } from "@/server/actions";
import { Gate, NeedTenant } from "@/components/guard";
import { FormBox } from "@/components/form-box";
import { EmptyState, PageHeader, Panel, Workspace } from "@/components/widgets";
import { CalendarClock } from "lucide-react";
import { withScope } from "@/lib/scope";
import { ViewToggle } from "@/components/view-toggle";
import { ListView } from "@/components/list-view";
import { resolveView, viewHrefs } from "@/lib/view-mode";

export const metadata = { title: "Schedule" };

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ view?: string; page?: string }> }) {
  const params = await searchParams;
  const { actor } = await requireSession();
  return (
    <Gate actor={actor} permission="bookings.manage">
      <NeedTenant actor={actor}>
        <ScheduleBody params={params} />
      </NeedTenant>
    </Gate>
  );
}

async function ScheduleBody({ params }: { params: { view?: string; page?: string } }) {
  const view = await resolveView("schedule", params.view);
  const { actor } = await requireSession();
  const branches = await listAccessibleBranches(actor);
  const where = { tenantId: actor.activeTenantId!, startsAt: { gte: new Date() } };
  const { items: slots, total, args: paging } = await fetchPage(parsePage(params, 24), (args) =>
    withScope({ tenantId: actor.activeTenantId, userId: actor.userId }, async (tx) => {
      const [items, count] = await Promise.all([
        tx.availabilitySlot.findMany({ where, include: { branch: true }, orderBy: [{ startsAt: "asc" }, { id: "asc" }], skip: args.skip, take: args.take }),
        tx.availabilitySlot.count({ where }),
      ]);
      return { items, total: count };
    }),
  );
  const days = new Map<string, typeof slots>();
  for (const slot of slots) {
    const key = dayFormat.format(slot.startsAt);
    days.set(key, [...(days.get(key) ?? []), slot]);
  }
  return (
    <>
      <PageHeader eyebrow="Calendar" title="Time slots" description="Center-visit and home-collection slots, in IST. A full slot can’t be booked. Scan slots are set per machine on the Scan rooms page." />
      <Workspace aside={
        <Panel title="Add slots" description="Each slot is 30 minutes.">
          <FormBox action={slotAction} submit="Add slots">
            <label className="field">Branch
              <select name="branchId">{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>
            </label>
            <label className="field">Kind
              <select name="kind"><option value="CENTER">Center visit</option><option value="HOME">Home collection</option></select>
            </label>
            <label className="field">Date<input name="date" type="date" required /></label>
            <label className="field">Times, comma separated<input name="times" placeholder="09:00, 09:30, 10:00" required /></label>
            <label className="field">Patients per slot<input name="capacity" type="number" min="1" max="50" defaultValue="1" /></label>
          </FormBox>
        </Panel>
      }>
        <Panel title="Upcoming slots" description={`${total} upcoming ${total === 1 ? "slot" : "slots"} across your branches.`} actions={slots.length ? <ViewToggle page="schedule" view={view} hrefs={viewHrefs("/console/org/schedule", params)} /> : undefined}>
          {slots.length === 0 ? <EmptyState icon={CalendarClock} title="No future slots" body="Add slots so patients can pick a time." /> : (
            view === "list" ? (
              <ListView className="-mx-5 -mb-5 rounded-none border-x-0 border-b-0 shadow-none" label="Upcoming slots" columns={[{ key: "time", label: "Time" }, { key: "day", label: "Day" }, { key: "branch", label: "Branch" }, { key: "kind", label: "Kind" }, { key: "left", label: "Seats", align: "right" }]}
                rows={slots.map((slot) => {
                  const full = slot.bookedCount >= slot.capacity;
                  return {
                    id: slot.id,
                    cells: {
                      time: timeFormat.format(slot.startsAt),
                      day: dayFormat.format(slot.startsAt),
                      branch: slot.branch.name,
                      kind: slot.kind === "HOME" ? "Home collection" : slot.kind === "IMAGING" ? "Scan" : "Center visit",
                      left: <span className={full ? "text-destructive" : "text-success"}>{full ? "Full" : `${slot.capacity - slot.bookedCount} of ${slot.capacity} left`}</span>,
                    },
                  };
                })} />
            ) :
            <div className="grid gap-5">
              {[...days.entries()].map(([day, list]) => (
                <section key={day} className="grid gap-2">
                  <h3 className="text-sm font-semibold">{day}</h3>
                  <ul className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
                    {list.map((slot) => {
                      const full = slot.bookedCount >= slot.capacity;
                      return (
                        <li key={slot.id} className="flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm">
                          <span className="w-16 font-semibold tabular-nums">{timeFormat.format(slot.startsAt)}</span>
                          <span className="grid min-w-0 flex-1">
                            <span className="truncate">{slot.branch.name}</span>
                            <span className="text-xs text-muted-foreground">{slot.kind === "HOME" ? "Home collection" : slot.kind === "IMAGING" ? "Scan" : "Center visit"}</span>
                          </span>
                          <span className={full ? "rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive" : "rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success"}>{full ? "Full" : `${slot.capacity - slot.bookedCount} left`}</span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
          {total > 0 ? <Pagination className={view === "list" ? "mt-9" : "mt-4"} pathname="/console/org/schedule" params={params} page={paging.page} pageSize={paging.pageSize} total={total} noun={total === 1 ? "slot" : "slots"} label="Slot pages" /> : null}
        </Panel>
      </Workspace>
    </>
  );
}

const dayFormat = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" });
const timeFormat = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
