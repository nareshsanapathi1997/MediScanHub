import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/server/session";
import { getReport } from "@/lib/services/lab";
import { reportAction } from "@/server/actions";
import { REPORT_TRANSITIONS, permissionForReportTransition } from "@/domain/state";
import { hasPermission } from "@/domain/actor";
import { DomainError } from "@/lib/errors";
import { formatWhen } from "@/lib/format";
import { ConfirmForm } from "@/components/confirm-form";
import { AccessDenied, Breadcrumbs, PageHeader, StatusPill } from "@/components/widgets";

export const metadata = { title: "Report" };

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { actor } = await requireSession();
  const { id } = await params;
  const allowed = ["samples.read", "reports.verify", "reports.approve", "reports.release", "imaging.report"].some((permission) => hasPermission(actor, permission, actor.activeTenantId));
  if (!allowed) return <AccessDenied />;
  return <ReportBody id={id} />;
}

async function ReportBody({ id }: { id: string }) {
  const { actor } = await requireSession();
  let report: Awaited<ReturnType<typeof getReport>>;
  try {
    report = await getReport(actor, id);
  } catch (error) {
    if (error instanceof DomainError && (error.status === 404 || error.status === 403)) notFound();
    throw error;
  }
  const next = REPORT_TRANSITIONS[report.status].filter((status) => hasPermission(actor, permissionForReportTransition(status), actor.activeTenantId));
  const released = report.status === "RELEASED" || report.status === "AMENDED";
  return (
    <>
      <Breadcrumbs items={[{ href: "/console/lab", label: "Laboratory" }, { label: report.booking.publicCode }]} />
      <PageHeader title={report.title} description={`${report.booking.patient.user.name} · ${report.booking.branch.name}`} />
      <StatusPill value={report.status} />
      <p className="text-sm text-muted-foreground">Values below are the entered results. Releasing builds a PDF. The patient cannot download it before release.</p>
      {(report.labOrder?.samples ?? []).map((sample) => (
        <section key={sample.id} className="grid gap-1 text-sm">
          <h2 className="font-medium">{sample.service.name}</h2>
          {sample.results.map((result) => (
            <p key={result.id}>{result.parameter.name}: {result.numericValue?.toString() ?? result.textValue ?? "—"} {result.parameter.unit ?? ""} · {result.flag ?? "no flag"}</p>
          ))}
        </section>
      ))}
      {(report.imagingOrder?.studies ?? []).map((study) => (
        <p key={study.id} className="text-sm">{study.service.name} · {study.accession} · {study.status}</p>
      ))}
      <div className="flex flex-wrap gap-3">
        {next.map((status) => (
          <ConfirmForm key={status} action={reportAction} confirm={`Move the report to ${status}?`} submit={status.toLowerCase()}>
            <input type="hidden" name="reportId" value={report.id} />
            <input type="hidden" name="to" value={status} />
            <input name="comment" placeholder="Comment" className="h-10 rounded-lg border px-2" />
          </ConfirmForm>
        ))}
      </div>
      <section className="grid gap-1 text-sm">
        <h2 className="font-display text-2xl">Approvals</h2>
        {report.approvals.length === 0 ? <p className="text-muted-foreground">No approval steps yet.</p> : report.approvals.map((approval) => (
          <p key={approval.id}>{formatWhen(approval.createdAt)} · {approval.decision} · {approval.approver.name}{approval.comment ? ` · ${approval.comment}` : ""}</p>
        ))}
      </section>
      <section className="grid gap-1 text-sm">
        <h2 className="font-display text-2xl">Versions</h2>
        {report.versions.length === 0 ? <p className="text-muted-foreground">No file until the report is released.</p> : report.versions.map((version) => (
          <p key={version.id}>Version {version.version} · {version.note ?? "Released file"}</p>
        ))}
        {released ? <Link className="text-primary" href={`/api/v1/reports/${report.id}/download`}>Download PDF</Link> : <p>Download stays unavailable until release.</p>}
      </section>
    </>
  );
}
