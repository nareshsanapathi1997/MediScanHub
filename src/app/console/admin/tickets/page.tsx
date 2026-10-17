import { Pagination } from "@/components/pagination";
import { fetchPage, parsePage } from "@/lib/pagination";
import { ViewToggle } from "@/components/view-toggle";
import { ListView } from "@/components/list-view";
import { resolveView, viewHrefs } from "@/lib/view-mode";
import Link from "next/link";
import { requireSession } from "@/server/session";
import { listTicketsPage } from "@/lib/services/admin";
import { ticketAction } from "@/server/actions";
import { deny } from "@/components/guard";
import { FormBox } from "@/components/form-box";
import { EmptyState, PageHeader, StatusPill } from "@/components/widgets";
import { LifeBuoy } from "lucide-react";
import { sentenceCase } from "@/lib/format";
import { formatWhen } from "@/lib/format";

export const metadata = { title: "Tickets" };

export default async function TicketsPage({ searchParams }: { searchParams: Promise<{ view?: string; page?: string }> }) {
  const params = await searchParams;
  const { actor } = await requireSession();
  const blocked = deny(actor, "tickets.manage");
  if (blocked) return blocked;
  const [{ items: tickets, total, open, args: paging }, view] = await Promise.all([fetchPage(parsePage(params, 10), (args) => listTicketsPage(actor, args)), resolveView("admin-tickets", params.view)]);
  const hrefs = viewHrefs("/console/admin/tickets", params);
  return (
    <>
      <PageHeader eyebrow="Support" title="Support questions" description={`Questions from patients, centers and the Contact page. Reply within 1 working day. ${open} open.`} />
      {tickets.length > 0 ? <div className="flex justify-end"><ViewToggle page="admin-tickets" view={view} hrefs={hrefs} /></div> : null}
      {tickets.length === 0 ? <EmptyState icon={LifeBuoy} title="The queue is empty" body="New questions appear here as soon as they are sent." /> : view === "list" ? (
        <ListView label="Support questions" columns={[{ key: "subject", label: "Subject" }, { key: "from", label: "From" }, { key: "priority", label: "Priority", hideOnMobile: true }, { key: "when", label: "Received" }, { key: "status", label: "Status" }]}
          rows={tickets.map((ticket) => ({
            id: ticket.id,
            cells: {
              subject: <span className="line-clamp-1">{ticket.subject}</span>,
              from: <span className="break-all">{ticket.requester.email}</span>,
              priority: sentenceCase(ticket.priority),
              when: formatWhen(ticket.createdAt),
              status: <StatusPill value={ticket.status} />,
            },
            actions: <Link href={`${hrefs.cards}#ticket-${ticket.id}`} className="inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium hover:bg-muted">Reply<span className="sr-only"> to {ticket.subject}</span></Link>,
          }))} />
      ) : (
        <ul className="grid gap-4 xl:grid-cols-2">
          {tickets.map((ticket) => (
            <li key={ticket.id} id={`ticket-${ticket.id}`} className="surface grid scroll-mt-24 content-between gap-4 p-5">
              <div className="grid gap-2">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-display text-xl">{ticket.subject}</h2>
                  <StatusPill value={ticket.status} />
                </div>
                <p className="text-xs text-muted-foreground"><span className="break-all">{ticket.requester.email}</span> · {formatWhen(ticket.createdAt)} · {sentenceCase(ticket.priority)} priority</p>
                <p className="line-clamp-6 rounded-lg bg-muted/40 p-3 text-sm whitespace-pre-wrap">{ticket.body}</p>
              </div>
              <FormBox action={ticketAction} submit="Update ticket">
                <input type="hidden" name="ticketId" value={ticket.id} />
                <label className="field">Status
                  <select name="status" defaultValue={ticket.status}>
                    {["OPEN", "IN_PROGRESS", "WAITING", "RESOLVED", "CLOSED"].map((status) => <option key={status} value={status}>{sentenceCase(status)}</option>)}
                  </select>
                </label>
                <label className="field">Reply or resolution<textarea name="resolution" rows={2} defaultValue={ticket.resolution ?? ""} /></label>
              </FormBox>
            </li>
          ))}
        </ul>
      )}
      {total > 0 ? <Pagination pathname="/console/admin/tickets" params={params} page={paging.page} pageSize={paging.pageSize} total={total} noun={total === 1 ? "question" : "questions"} label="Question pages" /> : null}
    </>
  );
}
