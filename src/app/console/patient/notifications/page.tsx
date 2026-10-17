import { Pagination } from "@/components/pagination";
import { fetchPage, parsePage } from "@/lib/pagination";
import { requireSession } from "@/server/session";
import { listInAppNotificationsPage, notificationPreview } from "@/lib/services/patient-extras";
import { formatWhen } from "@/lib/format";
import { Gate } from "@/components/guard";
import { EmptyState, Item, ItemList, PageHeader, Panel } from "@/components/widgets";
import { Bell, CheckCheck, Mail, MailOpen } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { notificationReadAction } from "@/server/actions";

export const metadata = { title: "Notifications" };

export default async function PatientNotificationsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { actor } = await requireSession();
  const params = await searchParams;
  return (
    <Gate actor={actor} permission="patient.portal">
      <NotificationsBody params={params} />
    </Gate>
  );
}

async function NotificationsBody({ params }: { params: { page?: string } }) {
  const { actor } = await requireSession();
  const { items: rows, total, unread, args: paging } = await fetchPage(parsePage(params, 15), (args) => listInAppNotificationsPage(actor, args));
  return (
    <>
      <PageHeader
        eyebrow="Inbox"
        title="Notifications"
        description="Updates about your bookings and reports. For your privacy, test results are never shown here."
        actions={
          unread > 0 ? (
            <form action={notificationReadAction}>
              <input type="hidden" name="id" value="all" />
              <button type="submit" className={buttonVariants({ variant: "outline" })}><CheckCheck className="size-4" aria-hidden />Mark all read</button>
            </form>
          ) : null
        }
      />
      {rows.length === 0 ? (
        <EmptyState title="No messages yet" body="When a booking is confirmed or a report is released, a message appears here." icon={Bell} />
      ) : (
        <Panel title={unread > 0 ? `${unread} unread` : "All caught up"} description={`${total} ${total === 1 ? "message" : "messages"}`}>
          <ItemList>
            {rows.map((row) => {
              const payload = (row.payload ?? {}) as Record<string, string>;
              const preview = notificationPreview(row.templateKey, payload);
              return (
                <Item
                  key={row.id}
                  icon={row.readAt ? MailOpen : Mail}
                  tone={row.readAt ? "muted" : "primary"}
                  title={<span className="flex items-center gap-2">{!row.readAt ? <span className="size-2 rounded-full bg-primary" aria-label="Unread" /> : null}{preview.subject}</span>}
                  meta={formatWhen(row.createdAt)}
                  trailing={!row.readAt ? (
                    <form action={notificationReadAction}>
                      <input type="hidden" name="id" value={row.id} />
                      <button type="submit" className="rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10">Mark read</button>
                    </form>
                  ) : null}
                >
                  <p className={row.readAt ? "text-sm text-muted-foreground" : "text-sm"}>{preview.text}</p>
                </Item>
              );
            })}
          </ItemList>
          <Pagination className="mt-9" pathname="/console/patient/notifications" params={params} page={paging.page} pageSize={paging.pageSize} total={total} noun={total === 1 ? "message" : "messages"} label="Message pages" />
        </Panel>
      )}
    </>
  );
}
