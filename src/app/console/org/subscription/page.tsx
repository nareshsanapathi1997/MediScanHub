import { requireSession } from "@/server/session";
import { listPlans, subscriptionUsage } from "@/lib/services/subscription";
import { cancelPlanAction, planAction } from "@/server/actions";
import { formatDate, formatInr } from "@/lib/format";
import { Gate, NeedTenant } from "@/components/guard";
import { ConfirmForm } from "@/components/confirm-form";
import { PageHeader, Stat, StatusPill } from "@/components/widgets";
import { ActionForm } from "@/components/action-form";

export const metadata = { title: "Subscription" };

export default async function SubscriptionPage() {
  const { actor } = await requireSession();
  return (
    <Gate actor={actor} permission="tenant.manage">
      <NeedTenant actor={actor}>
        <SubscriptionBody />
      </NeedTenant>
    </Gate>
  );
}

async function SubscriptionBody() {
  const { actor } = await requireSession();
  const [usage, plans] = await Promise.all([subscriptionUsage(actor.activeTenantId!), listPlans()]);
  const subscription = usage.subscription;
  return (
    <>
      <PageHeader eyebrow="Plan" title={subscription?.plan.name ?? "No active plan"} description="Center subscriptions are billed apart from patient invoices. GST on subscription invoices uses the platform rate." />
      {subscription ? <StatusPill value={subscription.status} /> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Branches" value={`${usage.usage.branches}${subscription?.plan.maxBranches ? ` / ${subscription.plan.maxBranches}` : ""}`} />
        <Stat label="Users" value={`${usage.usage.users}${subscription?.plan.maxUsers ? ` / ${subscription.plan.maxUsers}` : ""}`} />
        <Stat label="Bookings this month" value={`${usage.usage.bookings}${subscription?.plan.maxBookingsPerMonth ? ` / ${subscription.plan.maxBookingsPerMonth}` : ""}`} />
      </div>
      {subscription ? <p className="text-sm text-muted-foreground">Period ends {formatDate(subscription.currentPeriodEnd)} · {subscription.billingCycle.toLowerCase()}</p> : null}
      <div className="grid gap-3 md:grid-cols-3">
        {plans.map((plan) => (
          <article key={plan.id} className="grid gap-2 rounded-2xl border bg-card p-4">
            <h2 className="font-display text-2xl">{plan.name}</h2>
            <p className="text-sm">{formatInr(plan.monthlyPricePaise)} / month · {formatInr(plan.annualPricePaise)} / year</p>
            <p className="text-sm text-muted-foreground">{plan.description}</p>
            <ActionForm action={planAction} className="grid gap-2">
              <input type="hidden" name="tier" value={plan.tier} />
              <select name="cycle" className="h-10 rounded-lg border bg-background px-2"><option value="MONTHLY">Monthly</option><option value="ANNUAL">Annual</option></select>
              <button className="h-10 rounded-lg bg-primary text-sm text-primary-foreground" type="submit">Change to {plan.name}</button>
            </ActionForm>
          </article>
        ))}
      </div>
      <ConfirmForm action={cancelPlanAction} confirm="Cancel the subscription at the end of this period?" submit="Cancel subscription" />
    </>
  );
}
