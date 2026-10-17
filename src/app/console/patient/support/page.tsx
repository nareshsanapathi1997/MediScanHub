import { Pagination } from "@/components/pagination";
import { fetchPage, parsePage } from "@/lib/pagination";
import { requireSession } from "@/server/session";
import { listPatientTicketsPage } from "@/lib/services/patient-extras";
import { formatWhen } from "@/lib/format";
import { Gate } from "@/components/guard";
import { FormBox } from "@/components/form-box";
import { EmptyState, Item, ItemList, PageHeader, Panel, StatusPill, Workspace } from "@/components/widgets";
import { LifeBuoy, MessageSquare } from "lucide-react";
import Link from "next/link";
import { patientTicketAction } from "@/server/actions";

export const metadata = { title: "Support" };

export default async function PatientSupportPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { actor } = await requireSession();
  const params = await searchParams;
  return (
    <Gate actor={actor} permission="patient.portal">
      <SupportBody params={params} />
    </Gate>
  );
}

async function SupportBody({ params }: { params: { page?: string } }) {
  const { actor } = await requireSession();
  const { items: tickets, total, args: paging } = await fetchPage(parsePage(params, 10), (args) => listPatientTicketsPage(actor, args));
  return (
    <>
      <PageHeader eyebrow="Help" title="Help" description="Ask us about bookings, payments or reports. We reply within 1 working day. Please do not type your test results here." />
      <Workspace aside={
        <Panel title="Ask a question" description="For a booking, you can also call the center directly.">
          <FormBox action={patientTicketAction} submit="Open ticket">
            <label className="field">Subject<input name="subject" required placeholder="e.g. Refund for cancelled visit" /></label>
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
        <Panel title="Your questions" description="Status updates from our team.">
          {tickets.length === 0 ? <EmptyState title="No questions yet" body="Your requests appear here with their status." icon={LifeBuoy} /> : (
            <ItemList>
              {tickets.map((ticket) => <Item key={ticket.id} icon={MessageSquare} title={ticket.subject} meta={`Opened ${formatWhen(ticket.createdAt)}`} trailing={<StatusPill value={ticket.status} />} />)}
            </ItemList>
          )}
          {total > 0 ? <Pagination className="mt-9" pathname="/console/patient/support" params={params} page={paging.page} pageSize={paging.pageSize} total={total} noun={total === 1 ? "question" : "questions"} label="Question pages" /> : null}
        </Panel>
        <Link href="/faq" className="text-sm font-medium text-primary hover:underline">Read common questions</Link>
      </Workspace>
    </>
  );
}
