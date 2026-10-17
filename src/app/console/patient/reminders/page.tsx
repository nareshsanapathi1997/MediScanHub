import { Pagination } from "@/components/pagination";
import { fetchPage, parsePage } from "@/lib/pagination";
import Link from "next/link";
import { requireSession } from "@/server/session";
import { upcomingRemindersPage, listInAppNotifications, notificationPreview } from "@/lib/services/patient-extras";
import { formatWhen } from "@/lib/format";
import { Gate } from "@/components/guard";
import { EmptyState, Item, ItemList, PageHeader, Panel, StatusPill, Workspace } from "@/components/widgets";
import { BellRing, CalendarClock } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ViewToggle } from "@/components/view-toggle";
import { ListView } from "@/components/list-view";
import { resolveView, viewHrefs } from "@/lib/view-mode";

export const metadata = { title: "Reminders" };

export default async function RemindersPage({ searchParams }: { searchParams: Promise<{ view?: string; page?: string }> }) {
  const params = await searchParams;
  const { actor } = await requireSession();
  return (
    <Gate actor={actor} permission="patient.portal">
      <RemindersBody params={params} />
    </Gate>
  );
}

async function RemindersBody({ params }: { params: { view?: string; page?: string } }) {
  const view = await resolveView("reminders", params.view);
  const viewToggle = <ViewToggle page="reminders" view={view} hrefs={viewHrefs("/console/patient/reminders", params)} />;
  const { actor } = await requireSession();
  const [{ items: visits, total, args: paging }, notices] = await Promise.all([fetchPage(parsePage(params, 10), (args) => upcomingRemindersPage(actor, args)), listInAppNotifications(actor, 10)]);
  const reminderNotices = notices.filter((n) => n.templateKey === "booking_reminder");
  return (
    <>
      <PageHeader eyebrow="Schedule" title="Upcoming visits" description="Your visits in the next 2 weeks. We send a reminder a day before." actions={<Link className={buttonVariants({ variant: "outline" })} href="/tests">Book another test</Link>} />
      <Workspace aside={
        <Panel title="Reminder messages" description="Sent by email and WhatsApp a day before your visit.">
          {reminderNotices.length === 0 ? <p className="text-sm text-muted-foreground">No reminders sent yet. You will see them here once they go out.</p> : (
            <ItemList>
              {reminderNotices.map((row) => {
                const preview = notificationPreview(row.templateKey, (row.payload ?? {}) as Record<string, string>);
                return <Item key={row.id} icon={BellRing} title={preview.subject} meta={formatWhen(row.createdAt)}><p className="text-sm text-muted-foreground">{preview.text}</p></Item>;
              })}
            </ItemList>
          )}
        </Panel>
      }>
        {visits.length === 0 ? <EmptyState title="Nothing scheduled" body="Book a test to see upcoming visits here." icon={CalendarClock} action={<Link className={buttonVariants()} href="/tests">Find a test</Link>} /> : (
          <div className="grid gap-3">
            <div className="flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{total} upcoming visit{total === 1 ? "" : "s"}</p>{viewToggle}</div>
            {view === "list" ? (
              <ListView label="Upcoming visits" columns={[{ key: "center", label: "Center" }, { key: "when", label: "When" }, { key: "code", label: "Booking" }, { key: "for", label: "For", hideOnMobile: true }, { key: "status", label: "Status" }]}
              rows={visits.map((booking) => ({
                id: booking.id,
                href: `/bookings/${booking.id}`,
                cells: {
                  center: booking.tenant.name,
                  when: formatWhen(booking.scheduledAt),
                  code: <span className="font-mono text-xs">{booking.publicCode}</span>,
                  for: booking.dependent?.name ?? "You",
                  status: <StatusPill value={booking.status} />,
                },
              }))} />
            ) : (
              <ol className="grid gap-3">
                {visits.map((booking) => (
                  <li key={booking.id}>
                    <Link href={`/bookings/${booking.id}`} className="surface flex items-center gap-4 p-4 transition hover:border-primary/50">
                      <span className="grid w-16 shrink-0 place-items-center rounded-xl bg-primary/10 py-2 text-center text-primary">
                        <span className="text-xs font-medium uppercase">{monthFormat.format(booking.scheduledAt)}</span>
                        <span className="font-display text-2xl leading-none">{dayFormat.format(booking.scheduledAt)}</span>
                      </span>
                      <span className="grid min-w-0 flex-1 gap-0.5">
                        <span className="font-medium">{booking.tenant.name}</span>
                        <span className="text-sm text-muted-foreground">{formatWhen(booking.scheduledAt)} · {booking.publicCode}{booking.dependent ? ` · for ${booking.dependent.name}` : ""}</span>
                      </span>
                      <StatusPill value={booking.status} />
                    </Link>
                  </li>
                ))}
              </ol>
            )}
            <Pagination pathname="/console/patient/reminders" params={params} page={paging.page} pageSize={paging.pageSize} total={total} noun={total === 1 ? "visit" : "visits"} />
          </div>
        )}
      </Workspace>
    </>
  );
}

const monthFormat = new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "Asia/Kolkata" });
const dayFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", timeZone: "Asia/Kolkata" });
