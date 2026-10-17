import { Pagination } from "@/components/pagination";
import { fetchPage, parsePage } from "@/lib/pagination";
import { requireSession } from "@/server/session";
import { listReports, listSamples } from "@/lib/services/lab";
import { listBookings } from "@/lib/services/booking";
import { collectionAction } from "@/server/actions";
import { formatWhen } from "@/lib/format";
import { FlaskConical, FileCheck2, TestTubes, TriangleAlert } from "@/components/icons";
import { SampleTable, ReportTable } from "@/components/record-tables";
import { COLLECTION_TRANSITIONS } from "@/domain/state";
import { Button } from "@/components/ui/button";
import { Gate, NeedTenant } from "@/components/guard";
import { PageHeader, Panel, Stat, StatusPill } from "@/components/widgets";
import { hasPermission } from "@/domain/actor";
import { ActionForm } from "@/components/action-form";

export const metadata = { title: "Laboratory" };

export default async function LabPage({ searchParams }: { searchParams: Promise<{ hc?: string }> }) {
  const { actor } = await requireSession();
  const params = await searchParams;
  return (
    <Gate actor={actor} permission="samples.read">
      <NeedTenant actor={actor}>
        <LabBody params={params} />
      </NeedTenant>
    </Gate>
  );
}

async function LabBody({ params }: { params: { hc?: string } }) {
  const { actor } = await requireSession();
  const [samples, reports, minePage] = await Promise.all([
    listSamples(actor),
    listReports(actor).catch(() => []),
    hasPermission(actor, "samples.collect", actor.activeTenantId)
      ? fetchPage(parsePage(params, 6, "hc"), async (args) => {
          // Open home visits assigned to me (statuses that still have a next step).
          const result = await listBookings(actor, { collectionAssigneeId: actor.userId, collectionStatus: ["REQUESTED", "ASSIGNED", "EN_ROUTE", "FAILED"], page: args.page, pageSize: args.pageSize });
          return { items: result.rows, total: result.total };
        })
      : Promise.resolve({ items: [], total: 0, args: parsePage(params, 6, "hc") }),
  ]);
  // Only collections assigned to this user; managers assign and track the rest from the collections board.
  const mine = minePage.items;
  const now = Date.now();
  const age = (date: Date) => {
    const hours = Math.max(0, Math.round((now - new Date(date).getTime()) / 36e5));
    return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
  };
  const count = (statuses: string[]) => samples.filter((sample) => statuses.includes(sample.status)).length;
  const awaitingReview = reports.filter((report) => ["ENTERED", "VERIFIED", "APPROVED"].includes(report.status)).length;
  const critical = samples.filter((sample) => sample.results.some((result) => result.flag === "CRITICAL")).length;
  return (
    <>
      <PageHeader eyebrow="Laboratory" title="Samples and reports" description="Follow each sample from collection to result. A second person must check results before the patient sees them." />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat label="Awaiting collection" value={String(count(["PENDING", "RECOLLECTION"]))} hint="Pending or recollection" icon={TestTubes} tone="warning" />
        <Stat label="In the lab" value={String(count(["COLLECTED", "IN_TRANSIT", "RECEIVED", "PROCESSING"]))} hint="Collected through processing" icon={FlaskConical} tone="info" />
        <Stat label="Reports in review" value={String(awaitingReview)} hint="Entered, verified, or approved" icon={FileCheck2} />
        <Stat label="Critical values" value={String(critical)} hint="Samples with a critical flag" icon={TriangleAlert} tone={critical ? "danger" : "success"} />
      </div>
      {mine.length > 0 ? (
        <Panel title="Your home collections" description="Update each home visit as you go. When you mark it Collected, its samples are marked collected.">
          <ul className="grid gap-3 md:grid-cols-2">
            {mine.map((booking) => (
              <li key={booking.id} className="rounded-xl border bg-muted/30 p-4 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{booking.patient.user.name} <span className="text-muted-foreground">· {booking.publicCode}</span></p>
                    <p className="mt-0.5 text-muted-foreground">{booking.address}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{formatWhen(booking.scheduledAt)}</p>
                  </div>
                  <StatusPill value={booking.collection!.status} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {COLLECTION_TRANSITIONS[booking.collection!.status].filter((to): to is "EN_ROUTE" | "COLLECTED" | "FAILED" => to === "EN_ROUTE" || to === "COLLECTED" || to === "FAILED").map((to) => (
                    <ActionForm key={to} action={collectionAction}>
                      <input type="hidden" name="bookingId" value={booking.id} />
                      <input type="hidden" name="to" value={to} />
                      <Button size="sm" variant={to === "FAILED" ? "outline" : "default"} type="submit">{to === "EN_ROUTE" ? "Start route" : to === "COLLECTED" ? "Mark collected" : "Could not collect"}</Button>
                    </ActionForm>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          <Pagination className="mt-4" pathname="/console/lab" params={params} pageKey="hc" page={minePage.args.page} pageSize={minePage.args.pageSize} total={minePage.total} noun={minePage.total === 1 ? "home visit" : "home visits"} label="Home visit pages" />
        </Panel>
      ) : null}
      <Panel title="Samples" description="Newest first. Open a barcode to receive the sample, enter results, or reject it with a reason.">
        <SampleTable
          rows={samples.map((sample) => ({
            href: `/console/lab/samples/${sample.id}`,
            barcode: sample.barcode?.code ?? "No barcode",
            test: sample.service.name,
            patient: sample.labOrder.booking.patient.user.name,
            branch: sample.labOrder.booking.branch.name,
            status: sample.status,
            assignee: sample.assignee?.name ?? "Unassigned",
            age: age(sample.createdAt),
            ageSort: -new Date(sample.createdAt).getTime(),
          }))}
        />
      </Panel>
      <Panel title="Reports" description="Every report moves through four checks before the patient sees it. Upload printouts or scans on the report page.">
        <ol className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Report pipeline">
          {(["ENTERED", "VERIFIED", "APPROVED", "RELEASED"] as const).map((step, index) => (
            <li key={step} className="relative rounded-xl border bg-muted/30 px-3 py-2.5">
              <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Step {index + 1}</span>
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium">{{ ENTERED: "Results entered", VERIFIED: "Verified", APPROVED: "Approved", RELEASED: "Released" }[step]}</span>
                <span className="font-display text-xl tabular-nums">{reports.filter((report) => report.status === step).length}</span>
              </span>
            </li>
          ))}
        </ol>
        <ReportTable
          rows={reports.map((report) => ({
            href: `/console/lab/reports/${report.id}`,
            code: report.booking.publicCode,
            title: report.title,
            patient: report.booking.patient.user.name,
            status: report.status,
            updated: formatWhen(report.updatedAt),
            updatedSort: -new Date(report.updatedAt).getTime(),
          }))}
        />
      </Panel>
      <p className="text-xs text-muted-foreground">Synthetic data only. Reference flags compare values with the center&apos;s configured ranges and are not a diagnosis.</p>
    </>
  );
}
