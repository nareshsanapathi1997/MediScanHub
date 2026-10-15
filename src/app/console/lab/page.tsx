import Link from "next/link";
import { requireSession } from "@/server/session";
import { listReports, listSamples } from "@/lib/services/lab";
import { listBookings } from "@/lib/services/booking";
import { collectionAction } from "@/server/actions";
import { formatWhen } from "@/lib/format";
import { Gate, NeedTenant } from "@/components/guard";
import { PageHeader, StatusPill, EmptyState } from "@/components/widgets";
import { hasPermission } from "@/domain/actor";

export const metadata = { title: "Laboratory" };

export default async function LabPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { actor } = await requireSession();
  const query = await searchParams;
  return (
    <Gate actor={actor} permission="samples.read">
      <NeedTenant actor={actor}>
        <LabBody status={query.status} />
      </NeedTenant>
    </Gate>
  );
}

async function LabBody({ status }: { status?: string }) {
  const { actor } = await requireSession();
  const sampleStatus = ["PENDING", "COLLECTED", "IN_TRANSIT", "RECEIVED", "PROCESSING", "RESULTED", "REJECTED", "RECOLLECTION"].includes(status ?? "") ? status as "PENDING" : undefined;
  const [samples, reports, bookings] = await Promise.all([
    listSamples(actor, sampleStatus),
    listReports(actor).catch(() => []),
    hasPermission(actor, "samples.collect", actor.activeTenantId) ? listBookings(actor, { pageSize: 30 }) : Promise.resolve({ rows: [] }),
  ]);
  const mine = bookings.rows.filter((booking) => booking.collection && (booking.collection.assigneeId === actor.userId || booking.collection.status === "ASSIGNED"));
  return (
    <>
      <PageHeader eyebrow="Laboratory" title="Samples and reports" description="Unapproved values stay off the patient PDF. Rejection needs a reason." />
      <form className="flex flex-wrap gap-2 text-sm">
        {["", "PENDING", "COLLECTED", "RECEIVED", "PROCESSING", "RESULTED", "REJECTED"].map((value) => (
          <button key={value || "all"} name="status" value={value} className="rounded-full border px-3 py-1">{value || "All samples"}</button>
        ))}
      </form>
      {samples.length === 0 ? <EmptyState title="No samples" body="Confirmed lab bookings open a sample and a barcode." /> : (
        <div className="grid gap-2">
          {samples.map((sample) => (
            <Link key={sample.id} href={`/console/lab/samples/${sample.id}`} className="flex items-center justify-between rounded-xl border bg-card px-3 py-2 text-sm">
              <span>{sample.barcode?.code ?? "No barcode"} · {sample.service.name} · {sample.labOrder.booking.patient.user.name}</span>
              <StatusPill value={sample.status} />
            </Link>
          ))}
        </div>
      )}
      <section className="grid gap-2">
        <h2 className="font-display text-2xl">Reports</h2>
        {reports.length === 0 ? <p className="text-sm text-muted-foreground">No reports in this center.</p> : reports.map((report) => (
          <Link key={report.id} href={`/console/lab/reports/${report.id}`} className="flex items-center justify-between text-sm">
            <span>{report.booking.publicCode} · {report.title}</span>
            <StatusPill value={report.status} />
          </Link>
        ))}
      </section>
      {mine.length > 0 ? (
        <section className="grid gap-3">
          <h2 className="font-display text-2xl">Your collections</h2>
          {mine.map((booking) => (
            <article key={booking.id} className="rounded-xl border p-3 text-sm">
              <p>{booking.publicCode} · {booking.address} · {formatWhen(booking.scheduledAt)} · {booking.collection?.status}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(["EN_ROUTE", "COLLECTED", "FAILED"] as const).map((to) => (
                  <form key={to} action={collectionAction}>
                    <input type="hidden" name="bookingId" value={booking.id} />
                    <input type="hidden" name="to" value={to} />
                    <button className="h-9 rounded-lg border px-3" type="submit">{to.toLowerCase().replace("_", " ")}</button>
                  </form>
                ))}
              </div>
            </article>
          ))}
        </section>
      ) : null}
    </>
  );
}
