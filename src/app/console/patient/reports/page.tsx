import { requireSession } from "@/server/session";
import { listReports } from "@/lib/services/lab";
import { formatWhen } from "@/lib/format";
import { deny } from "@/components/guard";
import { Download } from "@/components/icons";
import { buttonVariants } from "@/components/ui/button";
import { ReportFileList } from "@/components/report-files";
import { PageHeader, EmptyState, StatusPill } from "@/components/widgets";

export const metadata = { title: "My reports" };

export default async function PatientReportsPage() {
  const { actor } = await requireSession();
  const blocked = deny(actor, "patient.portal");
  if (blocked) return blocked;
  const reports = actor.patientId ? await listReports({ ...actor, activeTenantId: null }) : [];
  return (
    <>
      <PageHeader eyebrow="Reports" title="My reports" description="Reports appear here after the doctor at the center checks and releases them. Download links work for 5 minutes and only for you." />
      {reports.length === 0 ? (
        <EmptyState title="No reports yet" body="Most blood test reports are ready in 24 hours and scans in 1–2 days. We will send you a message when your report is ready. The message will not contain your results." />
      ) : reports.map((report) => (
        <article key={report.id} className="grid gap-3 rounded-2xl border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl">{report.title}</h2>
              <p className="text-sm text-muted-foreground">Booking {report.booking.publicCode} · {report.booking.tenant.name} · Released {report.releasedAt ? formatWhen(report.releasedAt) : ""}</p>
            </div>
            <StatusPill value={report.status} />
          </div>
          {report.versions.length > 0 ? (
            <a className={buttonVariants({ className: "w-fit" })} href={`/api/v1/reports/${report.id}/open`} target="_blank" rel="noopener">
              <Download className="size-4" aria-hidden />Download report PDF
            </a>
          ) : null}
          {report.files.length > 0 ? (
            <div className="grid gap-2">
              <h3 className="text-sm font-medium">Files from the center</h3>
              <ReportFileList files={report.files} />
            </div>
          ) : null}
        </article>
      ))}
    </>
  );
}
