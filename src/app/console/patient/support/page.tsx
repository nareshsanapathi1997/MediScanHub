import { requireSession } from "@/server/session";
import { listPatientTickets } from "@/lib/services/patient-extras";
import { formatWhen } from "@/lib/format";
import { Gate } from "@/components/guard";
import { FormBox } from "@/components/form-box";
import { PageHeader, EmptyState, StatusPill } from "@/components/widgets";
import { patientTicketAction } from "@/server/actions";

export const metadata = { title: "Support" };

export default async function PatientSupportPage() {
  const { actor } = await requireSession();
  return (
    <Gate actor={actor} permission="patient.portal">
      <SupportBody />
    </Gate>
  );
}

async function SupportBody() {
  const { actor } = await requireSession();
  const tickets = await listPatientTickets(actor);
  return (
    <>
      <PageHeader eyebrow="Help" title="Help" description="Ask us about bookings, payments or reports. We reply within 1 working day. Please do not type your test results here." />
      <FormBox action={patientTicketAction} submit="Open ticket">
        <label className="field">Subject<input name="subject" required /></label>
        <label className="field">Message<textarea name="body" required rows={4} /></label>
        <label className="field">Priority
          <select name="priority" defaultValue="NORMAL">
            <option value="LOW">Low</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">High</option>
          </select>
        </label>
      </FormBox>
      {tickets.length === 0 ? <EmptyState title="No questions yet" body="Your requests to the desk appear here with their status." /> : tickets.map((ticket) => (
        <article key={ticket.id} className="flex items-center justify-between rounded-xl border px-3 py-2 text-sm">
          <span>{ticket.subject} · {formatWhen(ticket.createdAt)}</span>
          <StatusPill value={ticket.status} />
        </article>
      ))}
    </>
  );
}
