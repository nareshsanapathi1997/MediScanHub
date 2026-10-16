import { requireSession } from "@/server/session";
import { tenantBranches } from "@/lib/services/catalog";
import { branchAction, hoursAction } from "@/server/actions";
import { Gate, NeedTenant } from "@/components/guard";
import { FormBox } from "@/components/form-box";
import { PageHeader, EmptyState } from "@/components/widgets";
import { ActionForm } from "@/components/action-form";

export const metadata = { title: "Branches" };

export default async function BranchesPage() {
  const { actor } = await requireSession();
  return (
    <Gate actor={actor} permission="branches.manage">
      <NeedTenant actor={actor}>
        <BranchesBody />
      </NeedTenant>
    </Gate>
  );
}

async function BranchesBody() {
  const { actor } = await requireSession();
  const branches = await tenantBranches(actor);
  return (
    <>
      <PageHeader eyebrow="Network" title="Branches" description="Each branch counts towards your plan limit. Opening hours are in IST." />
      {branches.length === 0 ? <EmptyState title="No branches yet" body="Add the first collection site. The public directory shows it after the center is active." /> : (
        <div className="grid gap-3">
          {branches.map((branch) => (
            <ActionForm key={branch.id} action={hoursAction} className="grid gap-2 rounded-2xl border bg-card p-4 sm:grid-cols-[1fr_auto_auto_auto]">
              <div>
                <h2 className="font-display text-2xl">{branch.name}</h2>
                <p className="text-sm text-muted-foreground">{branch.address}, {branch.city} · {branch.code}</p>
              </div>
              <input type="hidden" name="branchId" value={branch.id} />
              <label className="field">Opens<input name="opensAt" defaultValue={branch.opensAt} required /></label>
              <label className="field">Closes<input name="closesAt" defaultValue={branch.closesAt} required /></label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="homeCollection" defaultChecked={branch.homeCollection} /> Home collection</label>
              <button className="h-10 rounded-lg border px-3 text-sm" type="submit">Save hours</button>
            </ActionForm>
          ))}
        </div>
      )}
      <FormBox action={branchAction} submit="Add branch">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="field">Name<input name="name" required /></label>
          <label className="field">Code<input name="code" required /></label>
          <label className="field">City<input name="city" required /></label>
          <label className="field">State<input name="state" required /></label>
          <label className="field">Phone<input name="phone" required /></label>
          <label className="field sm:col-span-2">Address<textarea name="address" required rows={2} /></label>
          <label className="field">Opens<input name="opensAt" defaultValue="07:00" /></label>
          <label className="field">Closes<input name="closesAt" defaultValue="20:00" /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="homeCollection" /> Offer home collection</label>
        </div>
      </FormBox>
    </>
  );
}
