import { requireSession } from "@/server/session";
import { listInvoices } from "@/lib/services/billing";
import { formatInr, formatWhen } from "@/lib/format";
import { deny } from "@/components/guard";
import { PageHeader, EmptyState, StatusPill } from "@/components/widgets";

export const metadata = { title: "My invoices" };

export default async function PatientInvoicesPage() {
  const { actor } = await requireSession();
  const blocked = deny(actor, "patient.portal");
  if (blocked) return blocked;
  const invoices = actor.patientId ? await listInvoices({ ...actor, activeTenantId: null }) : [];
  return (
    <>
      <PageHeader eyebrow="Payments" title="My bills" description="Bills for your bookings. Diagnostic tests are exempt from GST." />
      {invoices.length === 0 ? <EmptyState title="No bills yet" body="An invoice is issued when you create a booking." /> : invoices.map((invoice) => (
        <article key={invoice.id} className="flex items-center justify-between rounded-2xl border bg-card p-4 text-sm">
          <div>
            <p className="font-medium">{invoice.number}</p>
            <p className="text-muted-foreground">{invoice.booking?.publicCode ?? "Visit"} · {formatWhen(invoice.issuedAt)} · {formatInr(invoice.totalPaise)}</p>
          </div>
          <StatusPill value={invoice.status} />
        </article>
      ))}
    </>
  );
}
