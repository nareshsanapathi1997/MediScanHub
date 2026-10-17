import { Pagination } from "@/components/pagination";
import { fetchPage, parsePage } from "@/lib/pagination";
import { requireSession } from "@/server/session";
import { listDependentsPage } from "@/lib/services/patient-extras";
import { Gate } from "@/components/guard";
import { FormBox } from "@/components/form-box";
import { PageHeader, EmptyState, Item, ItemList, Panel, RemoveForm, Workspace } from "@/components/widgets";
import { UserRound, Users } from "lucide-react";
import { deleteDependentAction, dependentAction } from "@/server/actions";
import { formatDate } from "@/lib/format";
import { ViewToggle } from "@/components/view-toggle";
import { resolveView, viewHrefs } from "@/lib/view-mode";

export const metadata = { title: "Family" };

export default async function FamilyPage({ searchParams }: { searchParams: Promise<{ view?: string; page?: string }> }) {
  const params = await searchParams;
  const { actor } = await requireSession();
  return (
    <Gate actor={actor} permission="patient.portal">
      <FamilyBody params={params} />
    </Gate>
  );
}

async function FamilyBody({ params }: { params: { view?: string; page?: string } }) {
  const view = await resolveView("family", params.view, "list");
  const viewToggle = <ViewToggle page="family" view={view} hrefs={viewHrefs("/console/patient/family", params)} />;
  const { actor } = await requireSession();
  const { items: dependents, total, args: paging } = await fetchPage(parsePage(params, 10), (args) => listDependentsPage(actor, args));
  return (
    <>
      <PageHeader eyebrow="Family" title="Family members" description="Add your parents, spouse or children. You can then book tests for them from checkout." />
      <Workspace aside={
        <Panel title="Add a family member" description="They will appear under “This test is for” at checkout.">
          <FormBox action={dependentAction} submit="Add family member">
            <label className="field">Full name<input name="name" required autoComplete="off" /></label>
            <label className="field">Relation<input name="relation" required placeholder="Mother, son, spouse" list="relations" /></label>
            <datalist id="relations"><option value="Mother" /><option value="Father" /><option value="Spouse" /><option value="Son" /><option value="Daughter" /></datalist>
            <div className="grid grid-cols-2 gap-3">
              <label className="field">Date of birth<input name="dateOfBirth" type="date" required /></label>
              <label className="field">Sex
          <select name="sex" defaultValue="FEMALE">
            <option value="FEMALE">Female</option>
            <option value="MALE">Male</option>
            <option value="INTERSEX">Intersex</option>
            <option value="UNKNOWN">Prefer not to say</option>
          </select>
              </label>
            </div>
          </FormBox>
        </Panel>
      }>
        <Panel title="Your family" description={`${total} ${total === 1 ? "person" : "people"} added`} actions={dependents.length ? viewToggle : undefined}>
          {dependents.length === 0 ? <EmptyState title="No family members added" body="Add a spouse, child or parent to pick them during booking." icon={Users} /> : view === "cards" ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {dependents.map((dep) => (
                <li key={dep.id} className="grid gap-3 rounded-xl border bg-muted/20 p-4">
                  <div className="flex items-center gap-3">
                    <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 font-semibold text-primary">{dep.name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("")}</span>
                    <span className="grid min-w-0"><span className="truncate font-medium">{dep.name}</span><span className="text-xs text-muted-foreground">{dep.relation}</span></span>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground"><span>Born {formatDate(dep.dateOfBirth)}</span><RemoveForm action={deleteDependentAction} id={dep.id} label={`Remove ${dep.name}`} /></div>
                </li>
              ))}
            </ul>
          ) : (
            <ItemList>
              {dependents.map((dep) => (
                <Item key={dep.id} icon={UserRound} title={dep.name} meta={`${dep.relation} · Born ${formatDate(dep.dateOfBirth)}`} trailing={<RemoveForm action={deleteDependentAction} id={dep.id} label={`Remove ${dep.name}`} />} />
              ))}
            </ItemList>
          )}
          {total > 0 ? <Pagination className={view === "list" ? "mt-9" : "mt-4"} pathname="/console/patient/family" params={params} page={paging.page} pageSize={paging.pageSize} total={total} noun={total === 1 ? "person" : "people"} /> : null}
        </Panel>
      </Workspace>
    </>
  );
}
