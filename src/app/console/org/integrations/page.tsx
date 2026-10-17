import { requireSession } from "@/server/session";
import { listIntegrationMessages } from "@/lib/services/integrations";
import { Gate, NeedTenant } from "@/components/guard";
import { EmptyState, Item, ItemList, PageHeader, Panel, StatusPill, Workspace } from "@/components/widgets";
import { buttonVariants } from "@/components/ui/button";
import { ArrowDownLeft, ArrowUpRight, Network } from "lucide-react";
import { sentenceCase } from "@/lib/format";
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
      <PageHeader eyebrow="Interop" title="Connections (HL7, FHIR, ABDM, PACS)" description="Messages waiting to be sent to other hospital systems. Your IT team sets up the live connection." />
      <Workspace aside={
        <Panel title="Quick ABDM link" description="Queue a link for a patient’s record at this center.">
          <form action={integrationAction} className="grid gap-3">
            <label className="field">Patient ID<input name="patientId" placeholder="Patient UUID" required /></label>
            <input type="hidden" name="mode" value="abdm" />
            <button type="submit" className={buttonVariants({ variant: "outline" })}>Queue ABDM link</button>
          </form>
        </Panel>
      }>
        <Panel title="Outbox" description="Newest first.">
          {messages.length === 0 ? <EmptyState icon={Network} title="No messages yet" body="Send HL7/FHIR from a booking detail page or transmit imaging studies from the imaging desk." /> : (
            <ItemList>
              {messages.map((msg) => (
                <Item key={msg.id} icon={msg.direction === "INBOUND" ? ArrowDownLeft : ArrowUpRight} tone={msg.status === "FAILED" ? "danger" : msg.status === "SENT" || msg.status === "ACKNOWLEDGED" ? "success" : "info"}
                  title={<span className="font-mono text-sm">{msg.kind}</span>}
                  meta={`${sentenceCase(msg.direction)} · ${formatWhen(msg.createdAt)}${msg.referenceId ? ` · ref ${msg.referenceId.slice(0, 8)}` : ""}`}
                  trailing={<StatusPill value={msg.status} />} />
              ))}
            </ItemList>
          )}
        </Panel>
      </Workspace>
    </>
  );
}
