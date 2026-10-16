import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { currentSession } from "@/server/session";
import { quoteBooking } from "@/lib/services/booking";
import { withScope } from "@/lib/scope";
import { checkoutAction } from "@/server/actions";
import { getWallet, listDependents, listInsurance } from "@/lib/services/patient-extras";
import { formatInr, formatWhen } from "@/lib/format";
import { FormBox } from "@/components/form-box";
import { PageHeader } from "@/components/widgets";
import { DomainError } from "@/lib/errors";

export const metadata = { title: "Checkout" };

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ branch?: string; slot?: string; services?: string; packages?: string; visit?: string }> }) {
  const query = await searchParams;
  const back = `/checkout?${new URLSearchParams({ branch: query.branch ?? "", slot: query.slot ?? "", services: query.services ?? "", packages: query.packages ?? "", visit: query.visit ?? "CENTER_VISIT" }).toString()}`;
  const session = await currentSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(back)}`);
  if (!session.actor.patientId) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10">
        <PageHeader title="Please sign in as a patient" description="Only patient accounts can book here. Center staff can add walk-in patients from the Front desk page." />
      </main>
    );
  }
  const serviceIds = (query.services ?? "").split(",").filter(Boolean);
  const packageIds = (query.packages ?? "").split(",").filter(Boolean);
  if (!query.branch || (!serviceIds.length && !packageIds.length) || !query.slot) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10">
        <PageHeader title="Choose your test and a time first" description="Open a center page, add a test or package, then pick a time slot." />
      </main>
    );
  }
  let quote: Awaited<ReturnType<typeof quoteBooking>>;
  try {
    quote = await quoteBooking({ branchId: query.branch, serviceIds, packageIds });
  } catch (error) {
    const message = error instanceof DomainError ? error.message : "This selection could not be priced.";
    return (
      <main className="mx-auto max-w-xl px-4 py-10">
        <PageHeader title="We could not open checkout" description={message} />
      </main>
    );
  }
  const slot = await withScope({ tenantId: quote.tenant.id }, (tx) => tx.availabilitySlot.findFirst({ where: { id: query.slot, branchId: query.branch } }));
  const visit = query.visit === "HOME_COLLECTION" ? "HOME_COLLECTION" : "CENTER_VISIT";
  const [dependents, wallet, policies] = await Promise.all([
    listDependents(session.actor),
    getWallet(session.actor),
    listInsurance(session.actor),
  ]);
  return (
    <main className="mx-auto grid max-w-xl gap-6 px-4 py-10">
      <PageHeader eyebrow={quote.tenant.name} title="Confirm the visit" description={`${quote.branch.name} · ${slot ? formatWhen(slot.startsAt) : "This time slot is no longer available"}`} />
      <ul className="grid gap-2 rounded-2xl border bg-card p-4 text-sm">
        {quote.items.map((item) => (
          <li key={`${item.name}-${item.pricePaise}`} className="flex justify-between"><span>{item.name}</span><span>{formatInr(item.pricePaise)}</span></li>
        ))}
        <li className="flex justify-between font-medium"><span>Total</span><span>{formatInr(quote.total)}</span></li>
      </ul>
      <FormBox action={checkoutAction} submit="Create booking" encType="multipart/form-data">
        <input type="hidden" name="branchId" value={query.branch} />
        <input type="hidden" name="slotId" value={query.slot} />
        <input type="hidden" name="serviceIds" value={serviceIds.join(",")} />
        <input type="hidden" name="packageIds" value={packageIds.join(",")} />
        <input type="hidden" name="visitType" value={visit} />
        <input type="hidden" name="idempotencyKey" value={randomUUID()} />
        {visit === "HOME_COLLECTION" ? <label className="field">Pickup address<textarea name="address" required rows={3} /></label> : <input type="hidden" name="address" value="" />}
        {dependents.length > 0 ? (
          <label className="field">This test is for
            <select name="dependentId" defaultValue="">
              <option value="">Myself</option>
              {dependents.map((dep) => <option key={dep.id} value={dep.id}>{dep.name} ({dep.relation})</option>)}
            </select>
          </label>
        ) : null}
        {wallet.wallet.balancePaise > 0 ? (
          <label className="field">Use wallet money (you have {formatInr(wallet.wallet.balancePaise)})
            <input name="walletRupees" type="number" min="0" step="1" placeholder="Amount in ₹, or leave empty" />
          </label>
        ) : null}
        {policies.length > 0 ? (
          <>
            <label className="field">Insurance policy
              <select name="insurancePolicyId" defaultValue="">
                <option value="">Pay out of pocket</option>
                {policies.map((policy) => (
                  <option key={policy.id} value={policy.id}>{policy.provider} · {policy.policyNumber}</option>
                ))}
              </select>
            </label>
            <label className="field">TPA / pre-auth reference (optional)<input name="tpaReference" placeholder="AUTH-12345" /></label>
          </>
        ) : null}
        <label className="field">Doctor’s prescription (optional, PDF or photo up to 5 MB)<input name="prescription" type="file" accept="application/pdf,image/png,image/jpeg" /></label>
        <label className="field">Notes for the center<textarea name="notes" rows={2} placeholder="For example: I am diabetic, or I need a wheelchair" /></label>
        <label className="field">Your doctor’s email (optional, so they can see this booking)<input name="referralEmail" type="email" placeholder="doctor@example.in" /></label>
        <label className="flex items-start gap-2 text-sm">
          <input name="consent" type="checkbox" required className="mt-1" />
          <span>I agree that this center can collect my sample or do my scan, and prepare my report. (Consent version 2026-10-01)</span>
        </label>
      </FormBox>
    </main>
  );
}
