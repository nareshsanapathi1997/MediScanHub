import { Pagination } from "@/components/pagination";
import { fetchPage, parsePage } from "@/lib/pagination";
import { ViewToggle } from "@/components/view-toggle";
import { ListView } from "@/components/list-view";
import { resolveView, viewHrefs } from "@/lib/view-mode";
import Link from "next/link";
import { requireSession } from "@/server/session";
import { listPlansPage } from "@/lib/services/subscription";
import { editPlanAction } from "@/server/actions";
import { formatInr } from "@/lib/format";
import { deny } from "@/components/guard";
import { FormBox } from "@/components/form-box";
import { PageHeader } from "@/components/widgets";

export const metadata = { title: "Plans" };

export default async function PlansPage({ searchParams }: { searchParams: Promise<{ view?: string; page?: string }> }) {
  const params = await searchParams;
  const { actor } = await requireSession();
  const blocked = deny(actor, "plans.manage");
  if (blocked) return blocked;
  const [{ items: plans, total, args: paging }, view] = await Promise.all([fetchPage(parsePage(params, 10), listPlansPage), resolveView("admin-plans", params.view)]);
  const hrefs = viewHrefs("/console/admin/plans", params);
  const limit = (value: number | null) => value ?? "No limit";
  return (
    <>
      <PageHeader eyebrow="Billing" title="Subscription plans" description="Monthly plans that centers pay for. Separate from patient bills. An empty limit means no limit." />
      <div className="flex justify-end"><ViewToggle page="admin-plans" view={view} hrefs={hrefs} /></div>
      {view === "list" ? (
        <ListView label="Subscription plans" columns={[{ key: "name", label: "Plan" }, { key: "monthly", label: "Monthly", align: "right" }, { key: "annual", label: "Annual" }, { key: "branches", label: "Branches" }, { key: "users", label: "Users" }, { key: "bookings", label: "Bookings / month", hideOnMobile: true }]}
          rows={plans.map((plan) => ({
            id: plan.id,
            cells: {
              name: plan.name,
              monthly: <span className="font-semibold">{formatInr(plan.monthlyPricePaise)}</span>,
              annual: `${formatInr(plan.annualPricePaise)} / year`,
              branches: <>{limit(plan.maxBranches)}<span className="md:hidden"> branches</span></>,
              users: <>{limit(plan.maxUsers)}<span className="md:hidden"> users</span></>,
              bookings: limit(plan.maxBookingsPerMonth),
            },
            actions: <Link href={`${hrefs.cards}#plan-${plan.id}`} className="inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium hover:bg-muted">Edit<span className="sr-only"> {plan.name}</span></Link>,
          }))} />
      ) : (
      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {plans.map((plan) => (
          <section key={plan.id} id={`plan-${plan.id}`} className="surface grid scroll-mt-24 content-start gap-4 p-5">
            <div className="grid gap-1">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-display text-2xl">{plan.name}</h2>
                <p className="tabular-nums"><span className="font-display text-xl">{formatInr(plan.monthlyPricePaise)}</span><span className="text-sm text-muted-foreground"> / month</span></p>
              </div>
              <p className="text-sm text-muted-foreground">{plan.description}</p>
            </div>
            <FormBox action={editPlanAction} submit={`Save ${plan.name}`}>
              <input type="hidden" name="planId" value={plan.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="field">Monthly (₹)<input name="monthly" type="number" min="0" step="1" defaultValue={plan.monthlyPricePaise / 100} required /></label>
                <label className="field">Annual (₹)<input name="annual" type="number" min="0" step="1" defaultValue={plan.annualPricePaise / 100} required /></label>
                <label className="field">Max branches<input name="maxBranches" type="number" min="1" defaultValue={plan.maxBranches ?? ""} placeholder="No limit" /></label>
                <label className="field">Max users<input name="maxUsers" type="number" min="1" defaultValue={plan.maxUsers ?? ""} placeholder="No limit" /></label>
                <label className="field sm:col-span-2">Max bookings a month<input name="maxBookings" type="number" min="1" defaultValue={plan.maxBookingsPerMonth ?? ""} placeholder="No limit" /></label>
              </div>
            </FormBox>
          </section>
        ))}
      </div>
      )}
      <Pagination pathname="/console/admin/plans" params={params} page={paging.page} pageSize={paging.pageSize} total={total} noun={total === 1 ? "plan" : "plans"} label="Plan pages" />
    </>
  );
}
