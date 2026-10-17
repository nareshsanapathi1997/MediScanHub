import { Pagination } from "@/components/pagination";
import { fetchPage, parsePage } from "@/lib/pagination";
import { requireSession } from "@/server/session";
import { listPatientInvoicesPage } from "@/lib/services/billing";
import { formatInr, formatWhen } from "@/lib/format";
import { deny } from "@/components/guard";
import { EmptyState, Item, ItemList, PageHeader, Panel, Stat, StatusPill } from "@/components/widgets";
import { IndianRupee, ReceiptText } from "lucide-react";

export const metadata = { title: "My invoices" };

export default async function PatientInvoicesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams;
  const { actor } = await requireSession();
  const blocked = deny(actor, "patient.portal");
  if (blocked) return blocked;
  const { items: invoices, total, due, args: paging } = actor.patientId
    ? await fetchPage(parsePage(params, 10), (args) => listPatientInvoicesPage({ ...actor, activeTenantId: null }, args))
    : { items: [], total: 0, due: 0, args: parsePage(params, 10) };
  return (
    <>
      <PageHeader eyebrow="Payments" title="My bills" description="Bills for your bookings. Diagnostic tests are exempt from GST." />
      {invoices.length === 0 ? <EmptyState title="No bills yet" body="An invoice is issued when you create a booking." icon={ReceiptText} /> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Stat label="Bills" value={String(total)} icon={ReceiptText} />
            <Stat label="To pay" value={formatInr(due)} icon={IndianRupee} tone={due > 0 ? "warning" : "success"} hint={due > 0 ? "Open the booking to pay" : "Nothing pending"} />
          </div>
          <Panel title="All bills">
            <ItemList>
              {invoices.map((invoice) => (
                <Item key={invoice.id} icon={ReceiptText} title={<span className="font-mono text-sm">{invoice.number}</span>} meta={`${invoice.booking?.publicCode ?? "Visit"} · ${formatWhen(invoice.issuedAt)}`} trailing={<span className="flex items-center gap-3"><span className="font-medium tabular-nums">{formatInr(invoice.totalPaise)}</span><StatusPill value={invoice.status} /></span>} />
              ))}
            </ItemList>
            <Pagination className="mt-9" pathname="/console/patient/invoices" params={params} page={paging.page} pageSize={paging.pageSize} total={total} noun={total === 1 ? "bill" : "bills"} label="Bill pages" />
          </Panel>
        </>
      )}
    </>
  );
}
