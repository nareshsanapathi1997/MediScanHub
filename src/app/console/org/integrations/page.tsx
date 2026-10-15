import { requireSession } from "@/server/session";
import { listIntegrationMessages } from "@/lib/services/integrations";
import { Gate, NeedTenant } from "@/components/guard";
import { PageHeader, EmptyState } from "@/components/widgets";
import { formatWhen } from "@/lib/format";
import { integrationAction } from "@/server/actions";

export const metadata = { title: "Integrations" };

export default async function IntegrationsPage() {
  const { actor } = await requireSession();
  return (
    <Gate actor={actor} permission="tenant.read">
      <NeedTenant actor={actor}>
        <IntegrationsBody />
      </NeedTenant>
    </Gate>
  );
}

async function IntegrationsBody() {
  const { actor } = await requireSession();
  const messages = await listIntegrationMessages(actor);
  return (
    <>
      <PageHeader eyebrow="Interop" title="HL7, FHIR, ABDM & PACS" description="Outbound messages are queued for your interface engine. Configure PACS_ENDPOINT and ABDM_HIP_ID in the environment for live sends." />
      {messages.length === 0 ? <EmptyState title="No messages yet" body="Send HL7/FHIR from a booking detail form or transmit imaging studies from the imaging desk." /> : (
        <ul className="grid gap-2 text-sm">
          {messages.map((msg) => (
            <li key={msg.id} className="rounded-xl border px-3 py-2">
              {msg.kind} · {msg.direction} · {msg.status} · {formatWhen(msg.createdAt)}
              {msg.referenceId ? ` · ref ${msg.referenceId.slice(0, 8)}` : ""}
            </li>
          ))}
        </ul>
      )}
      <form action={integrationAction} className="grid max-w-md gap-2 text-sm">
        <p className="font-medium">Quick ABDM link (patient MRN at this center)</p>
        <input name="patientId" placeholder="Patient UUID" className="h-10 rounded-lg border px-2" required />
        <input type="hidden" name="mode" value="abdm" />
        <button type="submit" className="h-10 rounded-lg border">Queue ABDM link</button>
      </form>
    </>
  );
}
