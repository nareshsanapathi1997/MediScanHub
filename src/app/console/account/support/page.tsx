import { Pagination } from "@/components/pagination";
import { fetchPage, parsePage } from "@/lib/pagination";
import { requireSession } from "@/server/session";
import { listOwnTicketsPage } from "@/lib/services/admin";
import { formatWhen } from "@/lib/format";
import { Gate } from "@/components/guard";
import { FormBox } from "@/components/form-box";
import { EmptyState, Item, ItemList, PageHeader, Panel, StatusPill, Workspace } from "@/components/widgets";
import { LifeBuoy, MessageSquare } from "lucide-react";
import { staffTicketAction } from "@/server/actions";

export const metadata = { title: "Support" };

export default async function StaffSupportPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { actor } = await requireSession();
  const params = await searchParams;
  return (
    <Gate actor={actor} permission="tickets.create">
      <SupportBody params={params} />
    </Gate>
  );
}

async function SupportBody({ params }: { params: { page?: string } }) {
  const { actor } = await requireSession();
  const { items: tickets, total, args: paging } = await fetchPage(parsePage(params, 10), (args) => listOwnTicketsPage(actor, args));
  return (
    <>
      <PageHeader eyebrow="Help" title="Support" description="Ask platform support about the console, bookings, payments or access. Do not paste patient results or PHI into the ticket." />
      <Workspace aside={
        <Panel title="Open a ticket" description="We reply within 1 working day.">
          <FormBox action={staffTicketAction} submit="Open ticket">
            <label className="field">Subject<input name="subject" required placeholder="e.g. Cannot check in a walk-in" /></label>
            <label className="field">Message<textarea name="body" required rows={4} /></label>
            <label className="field">How urgent?
              <select name="priority" defaultValue="NORMAL">
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
              </select>
            </label>
          </FormBox>
        </Panel>
      }>
        <Panel title="Your tickets" description="Status updates from the platform team.">
          {tickets.length === 0 ? <EmptyState title="No tickets yet" body="Your requests appear here with their status." icon={LifeBuoy} /> : (
            <ItemList>
              {tickets.map((ticket) => <Item key={ticket.id} icon={MessageSquare} title={ticket.subject} meta={`Opened ${formatWhen(ticket.createdAt)}`} trailing={<StatusPill value={ticket.status} />} />)}
            </ItemList>
          )}
          {total > 0 ? <Pagination className="mt-9" pathname="/console/account/support" params={params} page={paging.page} pageSize={paging.pageSize} total={total} noun={total === 1 ? "ticket" : "tickets"} label="Ticket pages" /> : null}
        </Panel>
      </Workspace>
    </>
  );
}
