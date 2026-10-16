import { requireSession } from "@/server/session";
import { listPlans } from "@/lib/services/subscription";
import { editPlanAction } from "@/server/actions";
import { formatInr } from "@/lib/format";
import { deny } from "@/components/guard";
import { FormBox } from "@/components/form-box";
import { PageHeader } from "@/components/widgets";

export const metadata = { title: "Plans" };

export default async function PlansPage() {
  const { actor } = await requireSession();
  const blocked = deny(actor, "plans.manage");
  if (blocked) return blocked;
  const plans = await listPlans();
  return (
    <>
      <PageHeader eyebrow="Billing" title="Subscription plans" description="Monthly plans that centers pay for. Separate from patient bills. An empty limit means no limit." />
      <div className="grid gap-4">
        {plans.map((plan) => (
          <FormBox key={plan.id} action={editPlanAction} submit={`Save ${plan.name}`}>
            <input type="hidden" name="planId" value={plan.id} />
            <h2 className="font-display text-2xl">{plan.name}</h2>
            <p className="text-sm text-muted-foreground">{plan.description} Current {formatInr(plan.monthlyPricePaise)} / month.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="field">Monthly rupees<input name="monthly" type="number" min="0" step="1" defaultValue={plan.monthlyPricePaise / 100} required /></label>
              <label className="field">Annual rupees<input name="annual" type="number" min="0" step="1" defaultValue={plan.annualPricePaise / 100} required /></label>
              <label className="field">Max branches<input name="maxBranches" type="number" min="1" defaultValue={plan.maxBranches ?? ""} placeholder="Unlimited" /></label>
              <label className="field">Max users<input name="maxUsers" type="number" min="1" defaultValue={plan.maxUsers ?? ""} placeholder="Unlimited" /></label>
              <label className="field">Max bookings / month<input name="maxBookings" type="number" min="1" defaultValue={plan.maxBookingsPerMonth ?? ""} placeholder="Unlimited" /></label>
            </div>
          </FormBox>
        ))}
      </div>
    </>
  );
}
