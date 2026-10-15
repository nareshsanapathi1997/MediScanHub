import { requireSession } from "@/server/session";
import { listDependents } from "@/lib/services/patient-extras";
import { Gate } from "@/components/guard";
import { FormBox } from "@/components/form-box";
import { PageHeader, EmptyState } from "@/components/widgets";
import { deleteDependentAction, dependentAction } from "@/server/actions";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Family" };

export default async function FamilyPage() {
  const { actor } = await requireSession();
  return (
    <Gate actor={actor} permission="patient.portal">
      <FamilyBody />
    </Gate>
  );
}

async function FamilyBody() {
  const { actor } = await requireSession();
  const dependents = await listDependents(actor);
  return (
    <>
      <PageHeader eyebrow="Family" title="Dependents" description="Book tests on behalf of family members from checkout." />
      {dependents.length === 0 ? <EmptyState title="No dependents" body="Add a spouse, child, or parent to select them during booking." /> : dependents.map((dep) => (
        <article key={dep.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm">
          <span>{dep.name} · {dep.relation} · {formatDate(dep.dateOfBirth)}</span>
          <form action={deleteDependentAction}>
            <input type="hidden" name="id" value={dep.id} />
            <button type="submit" className="text-primary">Remove</button>
          </form>
        </article>
      ))}
      <FormBox action={dependentAction} submit="Add family member">
        <label className="field">Name<input name="name" required /></label>
        <label className="field">Relation<input name="relation" required placeholder="Child, spouse, parent" /></label>
        <label className="field">Date of birth<input name="dateOfBirth" type="date" required /></label>
        <label className="field">Sex
          <select name="sex" defaultValue="FEMALE">
            <option value="FEMALE">Female</option>
            <option value="MALE">Male</option>
            <option value="INTERSEX">Intersex</option>
            <option value="UNKNOWN">Unknown</option>
          </select>
        </label>
      </FormBox>
    </>
  );
}
