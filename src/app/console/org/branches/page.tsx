import { requireSession } from "@/server/session";
import { tenantBranches } from "@/lib/services/catalog";
import { branchAction, hoursAction } from "@/server/actions";
import { Gate, NeedTenant } from "@/components/guard";
import { FormBox } from "@/components/form-box";
import { EmptyState, PageHeader, Panel, Workspace } from "@/components/widgets";
import { buttonVariants } from "@/components/ui/button";
import { openStatus, weekPlan, type DayHours } from "@/lib/hours";
import { WeekHoursFields } from "@/components/hours-fields";
import { HolidayPicker } from "@/components/holiday-picker";

const NEW_BRANCH_PLAN: DayHours[] = [{ opensAt: "08:00", closesAt: "14:00" }, ...Array.from({ length: 6 }, () => ({ opensAt: "07:00", closesAt: "20:00" }))];
import { Building2, MapPin } from "lucide-react";
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
  const now = new Date();
  return (
    <>
      <PageHeader eyebrow="Network" title="Branches" description="Each branch counts towards your plan limit. Hours are in IST and show on your public page." />
      <Workspace aside={
        <Panel title="Add a branch" description="It appears in the directory once your center is active.">
          <FormBox action={branchAction} submit="Add branch" reloadOnSuccess>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <label className="field">Name<input name="name" required placeholder="Madhapur" /></label>
              <label className="field">Short code<input name="code" required placeholder="MAD" maxLength={6} /></label>
              <label className="field">City<input name="city" required /></label>
              <label className="field">State<input name="state" required /></label>
              <label className="field">Phone<input name="phone" required placeholder="+91 40 4000 1111" /></label>
              <label className="field sm:col-span-2 xl:col-span-1">Address<textarea name="address" required rows={2} /></label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="homeCollection" className="size-4 accent-[var(--primary)]" /> Offer home collection</label>
            </div>
            <WeekHoursFields idPrefix="new-branch" plan={NEW_BRANCH_PLAN} compact />
            <HolidayPicker />
          </FormBox>
        </Panel>
      }>
        {branches.length === 0 ? <EmptyState icon={Building2} title="No branches yet" body="Add the first collection site. The public directory shows it after the center is active." /> : (
          <div className="grid gap-4">
            {branches.map((branch) => {
              const plan = weekPlan(branch);
              const status = openStatus([branch], now);
              return (
                <ActionForm key={branch.id} action={hoursAction} className="surface grid gap-5 p-5">
                  <input type="hidden" name="branchId" value={branch.id} />
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="grid gap-1">
                      <h2 className="font-display text-2xl">{branch.name} <span className="align-middle font-mono text-xs text-muted-foreground">{branch.code}</span></h2>
                      <p className="flex items-start gap-1.5 text-sm text-muted-foreground"><MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />{branch.address}, {branch.city}</p>
                    </div>
                    <span className={status.open ? "inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success ring-1 ring-success/30 ring-inset" : "inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-border ring-inset"}><span className="size-1.5 rounded-full bg-current" aria-hidden />{status.label}</span>
                  </div>
                  <WeekHoursFields idPrefix={branch.id} plan={plan} />
                  <HolidayPicker defaultValue={branch.holidays} />
                  <div className="grid gap-3">
                    <label className="flex h-10 items-center gap-2 text-sm"><input type="checkbox" name="homeCollection" defaultChecked={branch.homeCollection} className="size-4 accent-[var(--primary)]" /> Home collection</label>
                  </div>
                  <div className="flex justify-end border-t pt-4"><button className={buttonVariants()} type="submit">Save hours</button></div>
                </ActionForm>
              );
            })}
          </div>
        )}
      </Workspace>
    </>
  );
}
