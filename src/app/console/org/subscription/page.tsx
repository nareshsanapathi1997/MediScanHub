import { requireSession } from "@/server/session";
import { listPlans, subscriptionUsage } from "@/lib/services/subscription";
import { cancelPlanAction, planAction } from "@/server/actions";
import { formatDate, formatInr } from "@/lib/format";
import { Gate, NeedTenant } from "@/components/guard";
import { ConfirmForm } from "@/components/confirm-form";
import { PageHeader, StatusPill } from "@/components/widgets";
import { buttonVariants } from "@/components/ui/button";
import { Building2, CalendarCheck, Users } from "lucide-react";
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
  const meters = [
    { label: "Branches", used: usage.usage.branches, max: subscription?.plan.maxBranches, icon: Building2 },
    { label: "Staff accounts", used: usage.usage.users, max: subscription?.plan.maxUsers, icon: Users },
    { label: "Bookings this month", used: usage.usage.bookings, max: subscription?.plan.maxBookingsPerMonth, icon: CalendarCheck },
  ];
  return (
    <>
      <PageHeader eyebrow="Plan" title={subscription?.plan.name ?? "No active plan"} description="Center subscriptions are billed apart from patient invoices. GST on subscription invoices uses the platform rate." actions={subscription ? <StatusPill value={subscription.status} /> : null} />
      <section className="surface grid gap-5 p-5" aria-label="Usage">
        {subscription ? <p className="text-sm text-muted-foreground">Billed {subscription.billingCycle === "ANNUAL" ? "yearly" : "monthly"} · current period ends <span className="font-medium text-foreground">{formatDate(subscription.currentPeriodEnd)}</span></p> : null}
        <div className="grid gap-5 sm:grid-cols-3">
          {meters.map((meter) => {
            const share = meter.max ? Math.min(100, Math.round((meter.used / meter.max) * 100)) : 0;
            return (
              <div key={meter.label} className="grid gap-2">
                <p className="flex items-center gap-2 text-sm text-muted-foreground"><meter.icon className="size-4" aria-hidden />{meter.label}</p>
                <p className="font-display text-2xl tabular-nums">{meter.used}<span className="text-base text-muted-foreground"> / {meter.max ?? "no limit"}</span></p>
                {meter.max ? <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={share} aria-valuemin={0} aria-valuemax={100} aria-label={`${meter.label} used`}><div className={share >= 90 ? "h-full rounded-full bg-destructive" : share >= 70 ? "h-full rounded-full bg-warning" : "h-full rounded-full bg-primary"} style={{ width: `${Math.max(3, share)}%` }} /></div> : null}
              </div>
            );
          })}
        </div>
      </section>
      <section className="grid gap-3">
        <h2 className="font-display text-2xl">Plans</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => {
            const current = subscription?.plan.id === plan.id;
            return (
              <article key={plan.id} className={current ? "surface grid content-between gap-4 p-5 ring-2 ring-primary" : "surface grid content-between gap-4 p-5"}>
                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-2"><h3 className="font-display text-xl">{plan.name}</h3>{current ? <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">Current</span> : null}</div>
                  <p><span className="font-display text-3xl tabular-nums">{formatInr(plan.monthlyPricePaise)}</span><span className="text-sm text-muted-foreground"> / month</span></p>
                  <p className="text-xs text-muted-foreground">or {formatInr(plan.annualPricePaise)} / year</p>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                </div>
                <ActionForm action={planAction} className="grid gap-2">
                  <input type="hidden" name="tier" value={plan.tier} />
                  <select name="cycle" aria-label={`Billing for ${plan.name}`} className="h-10 rounded-lg border bg-background px-2 text-sm"><option value="MONTHLY">Monthly</option><option value="ANNUAL">Annual</option></select>
                  <button className={buttonVariants({ variant: current ? "outline" : "default" })} type="submit">Change to {plan.name}</button>
                </ActionForm>
              </article>
            );
          })}
        </div>
      </section>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <p className="text-sm text-muted-foreground">Cancelling keeps the plan until the end of this period.</p>
        <ConfirmForm action={cancelPlanAction} confirm="Cancel the subscription at the end of this period?" submit="Cancel subscription" />
      </div>
    </>
  );
}
