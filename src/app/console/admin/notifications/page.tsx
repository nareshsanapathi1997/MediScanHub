import { requireSession } from "@/server/session";
import { notificationHealth } from "@/lib/services/admin";
import { pumpNotificationsAction } from "@/server/actions";
import { deny } from "@/components/guard";
import { PageHeader, StatusPill } from "@/components/widgets";
import { formatWhen } from "@/lib/format";

export const metadata = { title: "Delivery" };

export default async function NotificationsPage() {
  const { actor } = await requireSession();
  const blocked = deny(actor, "platform.read");
  if (blocked) return blocked;
  const health = await notificationHealth(actor);
  return (
    <>
      <PageHeader eyebrow="Delivery" title="Notification health" description="The worker sends queued email, WhatsApp, and SMS through the configured provider. Local mode records them without calling Meta or an SMTP server. Reminders for the next 24 hours are queued when you run the worker." />
      <form action={pumpNotificationsAction}>
        <button className="h-10 rounded-lg bg-primary px-4 text-sm text-primary-foreground" type="submit">Run delivery worker</button>
      </form>
      <div className="flex flex-wrap gap-2">
        {health.grouped.map((row) => <StatusPill key={`${row.channel}-${row.status}`} value={`${row.channel} ${row.status} ${row._count}`} />)}
      </div>
      <section className="grid gap-2">
        <h2 className="font-display text-2xl">Failed</h2>
        {health.failed.length === 0 ? <p className="text-sm text-muted-foreground">No failed messages in the latest sample.</p> : health.failed.map((notice) => (
          <p key={notice.id} className="text-sm">{formatWhen(notice.updatedAt)} · {notice.channel} · {notice.templateKey} · {notice.toAddress}</p>
        ))}
      </section>
    </>
  );
}
