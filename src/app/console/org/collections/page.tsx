import { Pagination } from "@/components/pagination";
import { fetchPage, parsePage } from "@/lib/pagination";
import { requireSession } from "@/server/session";
import { listBookings } from "@/lib/services/booking";
import { listStaff } from "@/lib/services/admin";
import { collectorAction } from "@/server/actions";
import { formatWhen } from "@/lib/format";
import { Gate, NeedTenant } from "@/components/guard";
import { EmptyState, PageHeader, Stat, StatusPill } from "@/components/widgets";
import { buttonVariants } from "@/components/ui/button";
import { Clock, Home, MapPin, UserPlus, Users } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { ViewToggle } from "@/components/view-toggle";
import { ListView } from "@/components/list-view";
import { resolveView, viewHrefs } from "@/lib/view-mode";

export const metadata = { title: "Home collection" };

export default async function CollectionsPage({ searchParams }: { searchParams: Promise<{ view?: string; page?: string }> }) {
  const params = await searchParams;
  const { actor } = await requireSession();
  return (
    <Gate actor={actor} permission="bookings.manage">
      <NeedTenant actor={actor}>
        <CollectionsBody params={params} />
      </NeedTenant>
    </Gate>
  );
}

async function CollectionsBody({ params }: { params: { view?: string; page?: string } }) {
  const view = await resolveView("collections", params.view);
  const viewToggle = <ViewToggle page="collections" view={view} hrefs={viewHrefs("/console/org/collections", params)} />;
  const { actor } = await requireSession();
  const [{ items: rows, total, args: paging }, waitingPage, staff] = await Promise.all([
    fetchPage(parsePage(params, 10), async (args) => {
      const result = await listBookings(actor, { homeCollection: true, page: args.page, pageSize: args.pageSize });
      return { items: result.rows, total: result.total };
    }),
    listBookings(actor, { homeCollection: true, collectionStatus: "REQUESTED", pageSize: 1 }),
    listStaff(actor),
  ]);
  const phlebotomists = staff.filter((member) => member.role.key === "PHLEBOTOMIST");
  const waiting = waitingPage.total;
  return (
    <>
      <PageHeader eyebrow="Logistics" title="Home sample collection" description="Assign a phlebotomist to each home visit. They update the status (on the way, collected) from their phone." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Home visits" value={String(total)} icon={Home} />
        <Stat label="Need a collector" value={String(waiting)} icon={UserPlus} tone={waiting ? "warning" : "success"} />
        <Stat label="Phlebotomists" value={String(phlebotomists.length)} icon={Users} tone="info" />
      </div>
      {rows.length === 0 ? <EmptyState icon={Home} title="No home visits booked" body="Home collection bookings appear here after a patient chooses a home slot." /> : (
        <div className="grid gap-3">
          <div className="flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{total} home visit{total === 1 ? "" : "s"}</p>{viewToggle}</div>
          {view === "list" ? (
            <ListView label="Home visits" columns={[{ key: "patient", label: "Patient" }, { key: "code", label: "Booking" }, { key: "when", label: "When" }, { key: "address", label: "Address", hideOnMobile: true }, { key: "status", label: "Status" }]}
          rows={rows.map((booking) => ({
            id: booking.id,
            href: `/console/org/bookings/${booking.id}`,
            cells: {
              patient: booking.patient.user.name,
              code: <span className="font-mono text-xs">{booking.publicCode}</span>,
              when: formatWhen(booking.scheduledAt),
              address: <span className="line-clamp-1 max-w-64">{booking.address ?? "—"}</span>,
              status: <StatusPill value={booking.collection?.status ?? "REQUESTED"} />,
            },
            actions: booking.collection?.status === "REQUESTED" && phlebotomists.length > 0 ? (
              <ActionForm action={collectorAction} className="flex items-center gap-2">
                <input type="hidden" name="bookingId" value={booking.id} />
                <select name="assigneeId" aria-label={`Collector for ${booking.publicCode}`} className="h-8 rounded-md border bg-background px-2 text-xs" required>
                  {phlebotomists.map((member) => <option key={member.userId} value={member.userId}>{member.user.name}</option>)}
                </select>
                <button className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground" type="submit">Assign</button>
              </ActionForm>
            ) : <span className="text-xs text-muted-foreground">{booking.collection?.assignee?.name ?? ""}</span>,
          }))} />
          ) : (
            <ul className="grid gap-3 lg:grid-cols-2">
              {rows.map((booking) => (
                <li key={booking.id} className="surface grid content-between gap-4 p-5">
                  <div className="grid gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{booking.patient.user.name}</p>
                        <p className="font-mono text-xs text-muted-foreground">{booking.publicCode}</p>
                      </div>
                      <StatusPill value={booking.collection?.status ?? "REQUESTED"} />
                    </div>
                    <p className="flex items-start gap-2 text-sm text-muted-foreground"><MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />{booking.address ?? "Address not given"}</p>
                    <p className="flex items-center gap-2 text-sm text-muted-foreground"><Clock className="size-4 shrink-0" aria-hidden />{formatWhen(booking.scheduledAt)}</p>
                  </div>
                  {booking.collection?.status === "REQUESTED" ? (
                    phlebotomists.length === 0 ? <p className="text-sm text-warning">Invite a phlebotomist from Staff first.</p> : (
                      <ActionForm action={collectorAction} className="flex flex-wrap gap-2 border-t pt-4">
                        <input type="hidden" name="bookingId" value={booking.id} />
                        <select name="assigneeId" aria-label="Collector" className="h-10 min-w-0 flex-1 rounded-lg border bg-background px-2 text-sm" required>
                          {phlebotomists.map((member) => <option key={member.userId} value={member.userId}>{member.user.name}</option>)}
                        </select>
                        <button className={buttonVariants()} type="submit">Assign</button>
                      </ActionForm>
                    )
                  ) : <p className="border-t pt-4 text-sm text-muted-foreground">Collector: <span className="font-medium text-foreground">{booking.collection?.assignee?.name ?? "Assigned"}</span></p>}
                </li>
              ))}
            </ul>
          )}
          <Pagination pathname="/console/org/collections" params={params} page={paging.page} pageSize={paging.pageSize} total={total} noun={total === 1 ? "home visit" : "home visits"} label="Home visit pages" />
        </div>
      )}
    </>
  );
}
