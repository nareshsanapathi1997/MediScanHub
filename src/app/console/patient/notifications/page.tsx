import { requireSession } from "@/server/session";
import { listInAppNotifications, notificationPreview } from "@/lib/services/patient-extras";
import { formatWhen } from "@/lib/format";
import { Gate } from "@/components/guard";
import { PageHeader, EmptyState } from "@/components/widgets";
import { notificationReadAction } from "@/server/actions";

export const metadata = { title: "Notifications" };

export default async function PatientNotificationsPage() {
  const { actor } = await requireSession();
  return (
    <Gate actor={actor} permission="patient.portal">
      <NotificationsBody />
    </Gate>
  );
}

async function NotificationsBody() {
  const { actor } = await requireSession();
  const rows = await listInAppNotifications(actor);
  return (
    <>
      <PageHeader
        eyebrow="Inbox"
        title="Notifications"
        description="Secure messages about bookings and reports. Clinical values are never shown here."
        actions={
          rows.some((row) => !row.readAt) ? (
            <form action={notificationReadAction}>
              <input type="hidden" name="id" value="all" />
              <button type="submit" className="text-sm text-primary">Mark all read</button>
            </form>
          ) : null
        }
      />
      {rows.length === 0 ? (
        <EmptyState title="No messages yet" body="When a booking is confirmed or a report is released, a message appears here." />
      ) : (
        rows.map((row) => {
          const payload = (row.payload ?? {}) as Record<string, string>;
          const preview = notificationPreview(row.templateKey, payload);
          return (
            <article key={row.id} className={`rounded-2xl border bg-card p-4 ${row.readAt ? "opacity-80" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-medium">{preview.subject}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{preview.text}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{formatWhen(row.createdAt)}</p>
                </div>
                {!row.readAt ? (
                  <form action={notificationReadAction}>
                    <input type="hidden" name="id" value={row.id} />
                    <button type="submit" className="text-xs text-primary">Mark read</button>
                  </form>
                ) : null}
              </div>
            </article>
          );
        })
      )}
    </>
  );
}
