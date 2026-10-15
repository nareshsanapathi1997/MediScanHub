import Link from "next/link";
import { requireSession } from "@/server/session";
import { listReports } from "@/lib/services/lab";
import { formatWhen } from "@/lib/format";
import { deny } from "@/components/guard";
import { PageHeader, EmptyState, StatusPill } from "@/components/widgets";

export const metadata = { title: "My reports" };

export default async function PatientReportsPage() {
  const { actor } = await requireSession();
  const blocked = deny(actor, "patient.portal");
  if (blocked) return blocked;
  const reports = actor.patientId ? await listReports({ ...actor, activeTenantId: null }) : [];
  return (
    <>
      <PageHeader eyebrow="Reports" title="Released reports" description="Draft and unverified results are hidden. Opening a file is written to the audit log." />
      {reports.length === 0 ? <EmptyState title="Nothing released yet" body="You will see a report here after a pathologist or radiologist releases it. The notification will not contain the values." /> : reports.map((report) => (
        <article key={report.id} className="flex items-center justify-between rounded-2xl border bg-card p-4">
          <div>
            <h2 className="font-display text-2xl">{report.title}</h2>
            <p className="text-sm text-muted-foreground">{report.booking.publicCode} · {report.booking.tenant.name} · {report.releasedAt ? formatWhen(report.releasedAt) : "Released"}</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusPill value={report.status} />
            <Link className="text-sm text-primary" href={`/api/v1/reports/${report.id}/download`}>Download</Link>
          </div>
        </article>
      ))}
    </>
  );
}
