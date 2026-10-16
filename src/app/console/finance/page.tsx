import { requireSession } from "@/server/session";
import { listInvoices } from "@/lib/services/billing";
import { listTpaClaims } from "@/lib/services/tpa-claims";
import { manualPayAction, refundAction, tpaClaimAction, walletRedeemAction } from "@/server/actions";
import { formatInr, formatWhen } from "@/lib/format";
import { hasPermission } from "@/domain/actor";
import { Gate, NeedTenant } from "@/components/guard";
import { FormBox } from "@/components/form-box";
import { PageHeader, EmptyState } from "@/components/widgets";
import { InvoiceTable } from "@/components/record-tables";

export const metadata = { title: "Finance" };

export default async function FinancePage() {
  const { actor } = await requireSession();
  return (
    <Gate actor={actor} permission="invoices.read">
      <NeedTenant actor={actor}>
        <FinanceBody />
      </NeedTenant>
    </Gate>
  );
}

async function FinanceBody() {
  const { actor } = await requireSession();
  const [invoices, claims] = await Promise.all([listInvoices(actor), listTpaClaims(actor)]);
  const typed = invoices as unknown as Array<{
    id: string;
    number: string;
    status: string;
    totalPaise: number;
    walletRedeemPaise: number;
    insurancePolicyId: string | null;
    issuedAt: Date;
    booking: { publicCode: string } | null;
    patient: { user: { name: string } } | null;
    payments: Array<{ id: string; status: string; providerPaymentId: string | null; amountPaise: number }>;
  }>;
  const canRefund = hasPermission(actor, "payments.refund", actor.activeTenantId);
  const canCollect = hasPermission(actor, "invoices.manage", actor.activeTenantId);
  return (
    <>
      <PageHeader eyebrow="Finance" title="Payments and bills" description="Record cash or UPI payments at the desk, apply wallet money, send insurance (TPA) claims and give refunds." />
      {typed.length === 0 ? <EmptyState title="No bills yet" body="A booking creates an invoice when the visit is saved." /> : (
        <InvoiceTable rows={typed.map((invoice) => ({
          number: invoice.number,
          patient: invoice.patient?.user.name ?? "Center",
          status: invoice.status,
          total: formatInr(invoice.totalPaise),
          booking: invoice.booking?.publicCode ?? formatWhen(invoice.issuedAt),
        }))} />
      )}
      {canCollect ? typed.filter((invoice) => invoice.status === "ISSUED" && invoice.booking).map((invoice) => (
        <div key={invoice.id} className="grid gap-2 rounded-xl border bg-card p-3 text-sm">
          <p className="font-medium">{invoice.number} · due {formatInr(invoice.totalPaise)}{invoice.walletRedeemPaise > 0 ? ` (wallet already ${formatInr(invoice.walletRedeemPaise)})` : ""}</p>
          <form action={walletRedeemAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="invoiceId" value={invoice.id} />
            <label className="field">Wallet (₹)<input name="rupees" type="number" min="1" step="1" className="h-10 w-28 rounded-lg border px-2" /></label>
            <input name="reason" placeholder="Wallet note" className="h-10 rounded-lg border px-2" />
            <button className="h-10 rounded-lg border px-3" type="submit">Apply wallet</button>
          </form>
          <form action={manualPayAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="invoiceId" value={invoice.id} />
            <input name="reason" placeholder="Desk collection note" className="h-10 rounded-lg border px-2" />
            <button className="h-10 rounded-lg border px-3" type="submit">Record cash or card</button>
          </form>
          {invoice.insurancePolicyId ? (
            <form action={tpaClaimAction} className="flex flex-wrap items-end gap-2 border-t pt-2">
              <input type="hidden" name="mode" value="submit" />
              <input type="hidden" name="invoiceId" value={invoice.id} />
              <label className="field">TPA claim (₹)<input name="rupees" type="number" min="1" required className="h-10 w-28 rounded-lg border px-2" /></label>
              <input name="externalReference" placeholder="TPA ref" className="h-10 rounded-lg border px-2" />
              <button className="h-10 rounded-lg border px-3" type="submit">Submit claim</button>
            </form>
          ) : null}
        </div>
      )) : null}
      {canCollect && claims.length > 0 ? (
        <section className="grid gap-3">
          <h2 className="font-display text-2xl">TPA claims</h2>
          {claims.map((claim) => (
            <div key={claim.id} className="rounded-xl border bg-card p-3 text-sm">
              <p>{claim.status} · {formatInr(claim.claimedPaise)} · invoice {(claim as { invoice: { number: string } }).invoice.number}</p>
              {claim.status === "SUBMITTED" ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <form action={tpaClaimAction} className="flex flex-wrap gap-2">
                    <input type="hidden" name="mode" value="transition" />
                    <input type="hidden" name="claimId" value={claim.id} />
                    <input type="hidden" name="to" value="APPROVED" />
                    <input name="approvedRupees" type="number" min="1" placeholder="Approved ₹" className="h-9 rounded-lg border px-2" required />
                    <button type="submit" className="h-9 rounded-lg border px-3">Approve</button>
                  </form>
                  <form action={tpaClaimAction}>
                    <input type="hidden" name="mode" value="transition" />
                    <input type="hidden" name="claimId" value={claim.id} />
                    <input type="hidden" name="to" value="REJECTED" />
                    <button type="submit" className="h-9 rounded-lg border px-3">Reject</button>
                  </form>
                </div>
              ) : null}
              {claim.status === "APPROVED" ? (
                <form action={tpaClaimAction} className="mt-2 flex flex-wrap gap-2">
                  <input type="hidden" name="mode" value="transition" />
                  <input type="hidden" name="claimId" value={claim.id} />
                  <input type="hidden" name="to" value="PAID" />
                  <input name="paidRupees" type="number" min="1" placeholder="Paid ₹" className="h-9 rounded-lg border px-2" required />
                  <button type="submit" className="h-9 rounded-lg border px-3">Mark paid</button>
                </form>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}
      {canRefund ? (
        <FormBox action={refundAction} submit="Refund payment">
          <label className="field">Payment id
            <select name="paymentId" required>
              {typed.flatMap((invoice) => invoice.payments.filter((payment) => payment.status === "CAPTURED").map((payment) => (
                <option key={payment.id} value={payment.id}>{invoice.number} · {payment.providerPaymentId ?? payment.id} · {formatInr(payment.amountPaise)}</option>
              )))}
            </select>
          </label>
          <label className="field">Amount in rupees<input name="rupees" type="number" min="1" required /></label>
          <label className="field">Reason<textarea name="reason" required rows={2} /></label>
        </FormBox>
      ) : <p className="text-sm text-muted-foreground">Refunds require the accountant role.</p>}
    </>
  );
}
