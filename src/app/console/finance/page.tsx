import { Pagination } from "@/components/pagination";
import { fetchPage, parsePage } from "@/lib/pagination";
import { requireSession } from "@/server/session";
import { listInvoices, listDueInvoicesPage } from "@/lib/services/billing";
import { listTpaClaims } from "@/lib/services/tpa-claims";
import { manualPayAction, refundAction, tpaClaimAction, walletRedeemAction } from "@/server/actions";
import { formatInr, formatWhen } from "@/lib/format";
import { hasPermission } from "@/domain/actor";
import { Gate, NeedTenant } from "@/components/guard";
import { FormBox } from "@/components/form-box";
import { EmptyState, Item, ItemList, PageHeader, Panel, Stat, StatusPill, Workspace } from "@/components/widgets";
import { Clock, ReceiptText, ShieldCheck, Wallet } from "lucide-react";
import { InvoiceTable } from "@/components/record-tables";
import { ViewToggle } from "@/components/view-toggle";
import { ListView } from "@/components/list-view";
import { resolveView, viewHrefs } from "@/lib/view-mode";

export const metadata = { title: "Finance" };

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ view?: string; page?: string }> }) {
  const params = await searchParams;
  const { actor } = await requireSession();
  return (
    <Gate actor={actor} permission="invoices.read">
      <NeedTenant actor={actor}>
        <FinanceBody params={params} />
      </NeedTenant>
    </Gate>
  );
}

async function FinanceBody({ params }: { params: { view?: string; page?: string } }) {
  const view = await resolveView("finance", params.view);
  const viewToggle = <ViewToggle page="finance" view={view} hrefs={viewHrefs("/console/finance", params)} />;
  const { actor } = await requireSession();
  const [invoices, claims, duePage] = await Promise.all([listInvoices(actor), listTpaClaims(actor), fetchPage(parsePage(params, 8), (args) => listDueInvoicesPage(actor, args))]);
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
  const due = typed.filter((invoice) => invoice.status === "ISSUED" && invoice.booking);
  const sum = (rows: typeof typed) => rows.reduce((total, invoice) => total + invoice.totalPaise, 0);
  const paid = typed.filter((invoice) => invoice.status === "PAID");
  const openClaims = claims.filter((claim) => ["SUBMITTED", "APPROVED"].includes(claim.status));
  const captured = typed.flatMap((invoice) => invoice.payments.filter((payment) => payment.status === "CAPTURED").map((payment) => ({ invoice, payment })));
  return (
    <>
      <PageHeader eyebrow="Finance" title="Payments and bills" description="Record cash or UPI payments at the desk, apply wallet money, send insurance (TPA) claims and give refunds." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Bills" value={String(typed.length)} icon={ReceiptText} />
        <Stat label="Waiting for payment" value={formatInr(sum(due))} hint={`${due.length} bill${due.length === 1 ? "" : "s"}`} icon={Clock} tone="warning" />
        <Stat label="Collected" value={formatInr(sum(paid))} hint={`${paid.length} paid`} icon={Wallet} tone="success" />
        <Stat label="Open TPA claims" value={String(openClaims.length)} icon={ShieldCheck} tone="info" />
      </div>
      <Workspace aside={
        <>
          {canRefund ? (
            <Panel title="Refund a payment" description="Refunds go back to the original payment method.">
              {captured.length === 0 ? <p className="text-sm text-muted-foreground">No captured payments to refund.</p> : (
                <FormBox action={refundAction} submit="Refund payment">
                  <label className="field">Payment
                    <select name="paymentId" required>
                      {captured.map(({ invoice, payment }) => (
                        <option key={payment.id} value={payment.id}>{invoice.number} · {formatInr(payment.amountPaise)} · {payment.providerPaymentId ?? payment.id.slice(0, 8)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">Amount in rupees<input name="rupees" type="number" min="1" required /></label>
                  <label className="field">Reason<textarea name="reason" required rows={2} /></label>
                </FormBox>
              )}
            </Panel>
          ) : <Panel title="Refunds"><p className="text-sm text-muted-foreground">Refunds need the accountant role.</p></Panel>}
          {canCollect && claims.length > 0 ? (
            <Panel title="TPA claims" description="Insurance claims sent from this center.">
              <ItemList>
                {claims.map((claim) => (
                  <Item key={claim.id} icon={ShieldCheck} tone={claim.status === "PAID" ? "success" : claim.status === "REJECTED" ? "danger" : "info"}
                    title={<span>{formatInr(claim.claimedPaise)} <span className="font-normal text-muted-foreground">· {(claim as { invoice: { number: string } }).invoice.number}</span></span>}
                    trailing={<StatusPill value={claim.status} />}>
                    {claim.status === "SUBMITTED" ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <form action={tpaClaimAction} className="flex flex-wrap gap-2">
                          <input type="hidden" name="mode" value="transition" />
                          <input type="hidden" name="claimId" value={claim.id} />
                          <input type="hidden" name="to" value="APPROVED" />
                          <input name="approvedRupees" type="number" min="1" placeholder="Approved ₹" aria-label="Approved amount in rupees" className="h-10 rounded-lg border bg-background px-3 text-sm h-9 w-32" required />
                          <button type="submit" className="inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium transition-colors hover:bg-muted">Approve</button>
                        </form>
                        <form action={tpaClaimAction}>
                          <input type="hidden" name="mode" value="transition" />
                          <input type="hidden" name="claimId" value={claim.id} />
                          <input type="hidden" name="to" value="REJECTED" />
                          <button type="submit" className="inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium transition-colors hover:bg-muted text-destructive">Reject</button>
                        </form>
                      </div>
                    ) : null}
                    {claim.status === "APPROVED" ? (
                      <form action={tpaClaimAction} className="mt-2 flex flex-wrap gap-2">
                        <input type="hidden" name="mode" value="transition" />
                        <input type="hidden" name="claimId" value={claim.id} />
                        <input type="hidden" name="to" value="PAID" />
                        <input name="paidRupees" type="number" min="1" placeholder="Paid ₹" aria-label="Paid amount in rupees" className="h-10 rounded-lg border bg-background px-3 text-sm h-9 w-32" required />
                        <button type="submit" className="inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium transition-colors hover:bg-muted">Mark paid</button>
                      </form>
                    ) : null}
                  </Item>
                ))}
              </ItemList>
            </Panel>
          ) : null}
        </>
      }>
        {canCollect && duePage.total > 0 ? (
          <Panel title="Collect payment" description="Bills waiting for payment. Apply wallet money first, then record the rest." actions={viewToggle}>
            {view === "list" ? (
              <>
              <p className="mb-4 text-xs text-muted-foreground">Switch to card view to apply wallet money, add a note or send an insurance claim.</p>
              <ListView className="-mx-5 -mb-5 rounded-none border-x-0 border-b-0 shadow-none" label="Bills waiting for payment" columns={[{ key: "patient", label: "Patient" }, { key: "number", label: "Invoice" }, { key: "wallet", label: "Wallet applied", hideOnMobile: true }, { key: "amount", label: "Due", align: "right" }]}
                rows={duePage.items.map((invoice) => ({
                  id: invoice.id,
                  cells: {
                    patient: invoice.patient?.user.name ?? "Center",
                    number: <span className="font-mono text-xs">{invoice.number}</span>,
                    wallet: invoice.walletRedeemPaise > 0 ? formatInr(invoice.walletRedeemPaise) : "—",
                    amount: <span className="font-semibold">{formatInr(invoice.totalPaise)}</span>,
                  },
                  actions: (
                    <form action={manualPayAction}>
                      <input type="hidden" name="invoiceId" value={invoice.id} />
                      <button className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90" type="submit">Record cash or card<span className="sr-only"> for {invoice.number}</span></button>
                    </form>
                  ),
                }))} />
              </>
            ) : (
              <ul className="grid gap-3">
                {duePage.items.map((invoice) => (
                  <li key={invoice.id} className="grid gap-3 rounded-xl border bg-muted/20 p-4 text-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-medium">{invoice.patient?.user.name ?? "Center"} <span className="font-mono text-xs text-muted-foreground">{invoice.number}</span></p>
                      <p className="font-display text-xl tabular-nums">{formatInr(invoice.totalPaise)}</p>
                    </div>
                    {invoice.walletRedeemPaise > 0 ? <p className="text-xs text-muted-foreground">Wallet already applied: {formatInr(invoice.walletRedeemPaise)}</p> : null}
                    <div className="grid gap-2 lg:grid-cols-2">
                      <form action={walletRedeemAction} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="invoiceId" value={invoice.id} />
                        <input name="rupees" type="number" min="1" step="1" placeholder="Wallet ₹" aria-label="Wallet amount in rupees" className="h-10 rounded-lg border bg-background px-3 text-sm w-28" />
                        <input name="reason" placeholder="Note" aria-label="Wallet note" className="h-10 rounded-lg border bg-background px-3 text-sm min-w-[9rem] flex-1" />
                        <button className="inline-flex h-10 items-center rounded-lg border px-3 text-sm font-medium transition-colors hover:bg-muted" type="submit">Apply wallet</button>
                      </form>
                      <form action={manualPayAction} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="invoiceId" value={invoice.id} />
                        <input name="reason" placeholder="Cash, UPI or card note" aria-label="Desk collection note" className="h-10 rounded-lg border bg-background px-3 text-sm min-w-[9rem] flex-1" />
                        <button className="inline-flex h-10 items-center rounded-lg border px-3 text-sm font-medium transition-colors hover:bg-muted border-primary bg-primary text-primary-foreground hover:bg-primary/90" type="submit">Record cash or card</button>
                      </form>
                    </div>
                    {invoice.insurancePolicyId ? (
                      <form action={tpaClaimAction} className="flex flex-wrap items-center gap-2 border-t pt-3">
                        <input type="hidden" name="mode" value="submit" />
                        <input type="hidden" name="invoiceId" value={invoice.id} />
                        <input name="rupees" type="number" min="1" required placeholder="Claim ₹" aria-label="TPA claim in rupees" className="h-10 rounded-lg border bg-background px-3 text-sm w-28" />
                        <input name="externalReference" placeholder="TPA reference" aria-label="TPA reference" className="h-10 rounded-lg border bg-background px-3 text-sm min-w-[9rem] flex-1" />
                        <button className="inline-flex h-10 items-center rounded-lg border px-3 text-sm font-medium transition-colors hover:bg-muted" type="submit">Submit claim</button>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            <Pagination className={view === "list" ? "mt-9" : "mt-4"} pathname="/console/finance" params={params} page={duePage.args.page} pageSize={duePage.args.pageSize} total={duePage.total} noun={duePage.total === 1 ? "bill" : "bills"} label="Bill pages" />
          </Panel>
        ) : null}
        <Panel title="All bills" description="Newest first.">
          {typed.length === 0 ? <EmptyState icon={ReceiptText} title="No bills yet" body="A booking creates an invoice when the visit is saved." /> : (
            <InvoiceTable rows={typed.map((invoice) => ({
              number: invoice.number,
              patient: invoice.patient?.user.name ?? "Center",
              status: invoice.status,
              total: formatInr(invoice.totalPaise),
              booking: invoice.booking?.publicCode ?? formatWhen(invoice.issuedAt),
            }))} />
          )}
        </Panel>
      </Workspace>
    </>
  );
}
