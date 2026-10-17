import Link from "next/link";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { currentSession } from "@/server/session";
import { quoteBooking } from "@/lib/services/booking";
import { withScope } from "@/lib/scope";
import { checkoutAction } from "@/server/actions";
import { getWallet, listDependents, listInsurance } from "@/lib/services/patient-extras";
import { formatInr, formatWhen } from "@/lib/format";
import { FormBox } from "@/components/form-box";
import { Breadcrumbs, PageHeader } from "@/components/widgets";
import { DomainError } from "@/lib/errors";
import { modalityLabel } from "@/domain/scan-scheduling";

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
  const slot = await withScope({ tenantId: quote.tenant.id }, (tx) => tx.availabilitySlot.findFirst({ where: { id: query.slot, branchId: query.branch }, include: { equipment: { select: { name: true, room: true, modality: true, active: true, blocks: { select: { startsAt: true, endsAt: true } } } } } }));
  const visit = query.visit === "HOME_COLLECTION" && !quote.scanModality ? "HOME_COLLECTION" : "CENTER_VISIT";
  const wrongSlot = Boolean(quote.scanModality && slot && slot.equipment?.modality !== quote.scanModality);
  // Full, past, blocked for maintenance or machine out of use: say so here instead of failing on submit.
  const slotOpen = Boolean(
    slot && slot.startsAt > new Date() && slot.bookedCount < slot.capacity &&
    (!slot.equipment || (slot.equipment.active && !slot.equipment.blocks.some((block) => block.startsAt < slot.endsAt && block.endsAt > slot.startsAt))),
  );
  const [dependents, wallet, policies] = await Promise.all([
    listDependents(session.actor),
    getWallet(session.actor),
    listInsurance(session.actor),
  ]);
  const prepRows = quote.preparation.filter((item) => quote.items.some((row) => row.expanded.some((service) => service.name === item.name && service.kind === "IMAGING")));
  const changeHref = `/centers/${quote.tenant.slug}?${new URLSearchParams({ branch: query.branch, ...(serviceIds.length ? { service: serviceIds.join(",") } : {}), ...(packageIds.length ? { package: packageIds.join(",") } : {}) }).toString()}#book`;
  return (
    <main className="mx-auto grid max-w-5xl gap-6 px-4 py-10 sm:py-12">
      <Breadcrumbs items={[{ href: `/centers/${quote.tenant.slug}`, label: quote.tenant.name }, { label: "Checkout" }]} />
      <PageHeader eyebrow={quote.tenant.name} title="Confirm the visit" description={`${quote.branch.name} · ${slot && slotOpen ? formatWhen(slot.startsAt) : "This time slot is no longer available. Go back and pick another time."}`} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="surface order-2 p-5 sm:p-6 lg:order-1">
        <FormBox action={checkoutAction} submit="Create booking" encType="multipart/form-data">
          <h2 className="font-display text-xl">Patient details</h2>
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
          <label className="flex items-start gap-2.5 rounded-xl border bg-muted/40 p-3 text-sm">
            <input name="consent" type="checkbox" required className="mt-1" />
            <span>I agree that this center can collect my sample or do my scan, and prepare my report. (Consent version 2026-10-01)</span>
          </label>
        </FormBox>
        </div>
        <aside aria-label="Booking summary" className="order-1 grid gap-4 lg:sticky lg:top-20 lg:order-2">
          <div className="surface grid gap-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-lg">{quote.branch.name}</p>
                <p className={slot && slotOpen ? "text-sm text-muted-foreground" : "text-sm font-medium text-destructive"}>{slot && slotOpen ? formatWhen(slot.startsAt) : "Slot not available"}</p>
                <p className="text-xs text-muted-foreground">{visit === "HOME_COLLECTION" ? "Home collection" : "Visit the center"}</p>
              </div>
              <Link href={changeHref} className="shrink-0 text-sm font-medium text-primary hover:underline">Change</Link>
            </div>
            <ul className="grid gap-2 border-t pt-4 text-sm">
              {quote.items.map((item) => (
                <li key={`${item.name}-${item.pricePaise}`} className="flex justify-between gap-3"><span>{item.name}</span><span className="tabular-nums">{formatInr(item.pricePaise)}</span></li>
              ))}
            </ul>
            <p className="flex items-center justify-between border-t pt-4 font-medium"><span>Total</span><span className="font-display text-2xl tabular-nums">{formatInr(quote.total)}</span></p>
            <p className="text-xs text-muted-foreground">You pay after the booking is created. You can cancel any time before your visit.</p>
          </div>
          {quote.scanModality ? (
            <section className="grid gap-2 rounded-2xl border border-info/30 bg-info/8 p-5 text-sm" aria-label="Scan details">
              {wrongSlot ? <p role="alert" className="font-medium text-destructive">This time is not a {modalityLabel(quote.scanModality)} slot. Go back and pick a time from the {modalityLabel(quote.scanModality)} list.</p> : null}
              {slot?.equipment ? <p><span className="font-medium">{modalityLabel(slot.equipment.modality)}</span> in {slot.equipment.room} ({slot.equipment.name})</p> : null}
              <p className="font-medium">How to prepare</p>
              <ul className="list-disc pl-5 text-muted-foreground">
                {prepRows.map((item) => <li key={item.name}>{item.name}: {item.text}</li>)}
                <li>Come 15 minutes before your slot. Bring your prescription and any old scans.</li>
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
