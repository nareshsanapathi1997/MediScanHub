import { requireSession } from "@/server/session";
import { listTickets } from "@/lib/services/admin";
import { ticketAction } from "@/server/actions";
import { deny } from "@/components/guard";
import { FormBox } from "@/components/form-box";
import { PageHeader, StatusPill } from "@/components/widgets";
import { formatWhen } from "@/lib/format";

export const metadata = { title: "Tickets" };

export default async function TicketsPage() {
  const { actor } = await requireSession();
  const blocked = deny(actor, "tickets.manage");
  if (blocked) return blocked;
  const tickets = await listTickets(actor);
  return (
    <>
      <PageHeader eyebrow="Support" title="Support questions" description="Questions from patients, centers and the Contact page. Reply within 1 working day." />
      {tickets.length === 0 ? <p className="text-sm text-muted-foreground">The queue is empty.</p> : tickets.map((ticket) => (
        <article key={ticket.id} className="grid gap-2 rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-2xl">{ticket.subject}</h2>
            <StatusPill value={ticket.status} />
          </div>
          <p className="text-sm whitespace-pre-wrap">{ticket.body}</p>
          <p className="text-xs text-muted-foreground">{ticket.requester.email} · {formatWhen(ticket.createdAt)} · {ticket.priority}</p>
          <FormBox action={ticketAction} submit="Update ticket">
            <input type="hidden" name="ticketId" value={ticket.id} />
            <label className="field">Status
              <select name="status" defaultValue={ticket.status}>
                {["OPEN", "IN_PROGRESS", "WAITING", "RESOLVED", "CLOSED"].map((status) => <option key={status}>{status}</option>)}
              </select>
            </label>
            <label className="field">Resolution<textarea name="resolution" rows={2} defaultValue={ticket.resolution ?? ""} /></label>
          </FormBox>
        </article>
      ))}
    </>
  );
}
