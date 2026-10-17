import { requireSession } from "@/server/session";
import { listChronicConditions } from "@/lib/services/patient-extras";
import { Gate } from "@/components/guard";
import { FormBox } from "@/components/form-box";
import { PageHeader, EmptyState, Item, ItemList, Panel, RemoveForm, Workspace } from "@/components/widgets";
import { Activity } from "lucide-react";
import { chronicAction, deleteChronicAction } from "@/server/actions";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Chronic care" };

export default async function ChronicPage() {
  const { actor } = await requireSession();
  return (
    <Gate actor={actor} permission="patient.portal">
      <ChronicBody />
    </Gate>
  );
}

async function ChronicBody() {
  const { actor } = await requireSession();
  const rows = await listChronicConditions(actor);
  return (
    <>
      <PageHeader eyebrow="Health history" title="Long-term conditions" description="Add conditions like diabetes, BP or thyroid. Centers see this when you book so they can guide you better." />
      <Workspace aside={
        <Panel title="Add a condition">
          <FormBox action={chronicAction} submit="Add condition">
            <label className="field">Condition<input name="condition" required placeholder="e.g. Type 2 diabetes" list="conditions" /></label>
            <datalist id="conditions"><option value="Type 2 diabetes" /><option value="High blood pressure" /><option value="Hypothyroidism" /><option value="Asthma" /><option value="High cholesterol" /></datalist>
            <label className="field">Since<input name="since" type="date" /></label>
            <label className="field">Notes (optional)<textarea name="notes" rows={2} placeholder="e.g. On metformin 500 mg" /></label>
          </FormBox>
        </Panel>
      }>
        <Panel title="Your conditions" description="Shared with the center only when you book.">
          {rows.length === 0 ? <EmptyState title="No conditions added" body="Add diabetes, high BP or other ongoing conditions you want centers to know about." icon={Activity} /> : (
            <ItemList>
              {rows.map((row) => (
                <Item key={row.id} icon={Activity} tone="info" title={row.condition} meta={row.since ? `Since ${formatDate(row.since)}` : "Start date not given"} trailing={<RemoveForm action={deleteChronicAction} id={row.id} label={`Remove ${row.condition}`} />}>
                  {row.notes ? <p className="mt-1 text-sm text-muted-foreground">{row.notes}</p> : null}
                </Item>
              ))}
            </ItemList>
          )}
        </Panel>
      </Workspace>
    </>
  );
}
