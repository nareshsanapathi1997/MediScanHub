import { requireSession } from "@/server/session";
import { notificationHealth } from "@/lib/services/admin";
import { pumpNotificationsAction } from "@/server/actions";
import { deny } from "@/components/guard";
import { Item, ItemList, PageHeader, Panel, StatusPill } from "@/components/widgets";
import { buttonVariants } from "@/components/ui/button";
import { CheckCircle2, Send, TriangleAlert } from "lucide-react";
import { sentenceCase } from "@/lib/format";
import { formatWhen } from "@/lib/format";
import { ActionForm } from "@/components/action-form";

export const metadata = { title: "Delivery" };

export default async function NotificationsPage() {
  const { actor } = await requireSession();
  const blocked = deny(actor, "platform.read");
  if (blocked) return blocked;
  const health = await notificationHealth(actor);
  const channels = [...new Set(health.grouped.map((row) => row.channel))];
  return (
    <>
      <PageHeader eyebrow="Delivery" title="Notification health" description="The worker sends queued email, WhatsApp and SMS through the configured provider. Local mode records them without calling Meta or an SMTP server. Running the worker also queues reminders for the next 24 hours." actions={
        <ActionForm action={pumpNotificationsAction}>
          <button className={buttonVariants()} type="submit"><Send className="size-4" aria-hidden />Run delivery worker</button>
        </ActionForm>
      } />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {channels.length === 0 ? <p className="text-sm text-muted-foreground">No messages yet.</p> : channels.map((channel) => {
          const rows = health.grouped.filter((row) => row.channel === channel);
          const total = rows.reduce((sum, row) => sum + row._count, 0);
          return (
            <section key={channel} className="surface grid gap-3 p-5">
              <div className="flex items-baseline justify-between"><h2 className="font-medium">{sentenceCase(channel)}</h2><span className="font-display text-2xl tabular-nums">{total}</span></div>
              <ul className="grid gap-1.5">
                {rows.map((row) => <li key={row.status} className="flex items-center justify-between text-sm"><StatusPill value={row.status} /><span className="tabular-nums text-muted-foreground">{row._count}</span></li>)}
              </ul>
            </section>
          );
        })}
      </div>
      <Panel title="Failed messages" description="From the latest sample. Fix the address or provider, then run the worker again.">
        {health.failed.length === 0 ? <p className="flex items-center gap-2 text-sm text-success"><CheckCircle2 className="size-4" aria-hidden />No failed messages.</p> : (
          <ItemList>
            {health.failed.map((notice) => (
              <Item key={notice.id} icon={TriangleAlert} tone="danger" title={<span className="break-all">{notice.toAddress}</span>} meta={`${sentenceCase(notice.channel)} · ${notice.templateKey} · ${formatWhen(notice.updatedAt)}`} />
            ))}
          </ItemList>
        )}
      </Panel>
    </>
  );
}
