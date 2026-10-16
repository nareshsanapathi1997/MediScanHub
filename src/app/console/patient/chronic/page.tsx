import { requireSession } from "@/server/session";
import { listChronicConditions } from "@/lib/services/patient-extras";
import { Gate } from "@/components/guard";
import { FormBox } from "@/components/form-box";
import { PageHeader, EmptyState } from "@/components/widgets";
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
      {rows.length === 0 ? <EmptyState title="No conditions added" body="Add diabetes, hypertension, or other ongoing conditions you want centers to see in notes." /> : rows.map((row) => (
        <article key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm">
          <span>{row.condition}{row.since ? ` · since ${formatDate(row.since)}` : ""}{row.notes ? ` · ${row.notes}` : ""}</span>
          <form action={deleteChronicAction}>
            <input type="hidden" name="id" value={row.id} />
            <button type="submit" className="text-primary">Remove</button>
          </form>
        </article>
      ))}
      <FormBox action={chronicAction} submit="Add condition">
        <label className="field">Condition<input name="condition" required /></label>
        <label className="field">Since<input name="since" type="date" /></label>
        <label className="field">Notes<textarea name="notes" rows={2} /></label>
      </FormBox>
    </>
  );
}
