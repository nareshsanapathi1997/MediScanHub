import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/server/session";
import { getReport } from "@/lib/services/lab";
import { OPEN_FOR_FILES, canManageReportFiles, listReportFiles } from "@/lib/services/report-files";
import { ReportFilesPanel } from "@/components/report-files";
import { reportAction } from "@/server/actions";
import { REPORT_TRANSITIONS, permissionForReportTransition } from "@/domain/state";
import { hasPermission } from "@/domain/actor";
import { DomainError } from "@/lib/errors";
import { formatWhen, titleCase } from "@/lib/format";
import { Download, ShieldCheck } from "@/components/icons";
import { buttonVariants } from "@/components/ui/button";
import { ConfirmForm } from "@/components/confirm-form";
import { AccessDenied, Breadcrumbs, PageHeader, Panel, StatusPill, Steps } from "@/components/widgets";

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
  const files = await listReportFiles(actor, report.id);
  const next = REPORT_TRANSITIONS[report.status].filter((status) => hasPermission(actor, permissionForReportTransition(status, Boolean(report.imagingOrder && !report.labOrder)), actor.activeTenantId));
  const released = report.status === "RELEASED" || report.status === "AMENDED";
  const steps = ["DRAFT", "ENTERED", "VERIFIED", "APPROVED", "RELEASED"] as const;
  const reached = Math.max(0, steps.indexOf(report.status === "AMENDED" ? "RELEASED" : report.status === "REJECTED" ? "ENTERED" : report.status));
  const enteredBy = new Set((report.labOrder?.samples ?? []).flatMap((sample) => sample.results.map((result) => result.enteredById)));
  const selfReview = enteredBy.has(actor.userId);
  const label: Record<string, string> = { ENTERED: "Submit for verification", VERIFIED: "Verify", APPROVED: "Approve", RELEASED: "Release to patient", REJECTED: "Send back", AMENDED: "Amend" };
  return (
    <>
      <Breadcrumbs items={[report.imagingOrder && !report.labOrder ? { href: "/console/imaging", label: "Scans" } : { href: "/console/lab", label: "Laboratory" }, { label: report.booking.publicCode }]} />
      <PageHeader eyebrow={`Report · ${report.booking.publicCode}`} title={report.title} description={`${report.booking.patient.user.name} · ${report.booking.branch.name}`} actions={<StatusPill value={report.status} />} />
      <Steps label="Review progress" steps={steps.map((step) => titleCase(step))} current={reached} complete={report.status === "RELEASED" || report.status === "AMENDED"} />
      {report.status === "REJECTED" ? <p role="status" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">Sent back for correction. Fix the results, then submit again.</p> : null}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="grid gap-4 lg:col-span-2">
          {(report.labOrder?.samples ?? []).map((sample) => (
            <Panel key={sample.id} title={sample.service.name} actions={<StatusPill value={sample.status} />}>
              {sample.results.length === 0 ? <p className="text-sm text-muted-foreground">No results entered yet. <Link className="font-medium text-primary underline" href={`/console/lab/samples/${sample.id}`}>Open the sample</Link></p> : (
                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left text-xs tracking-wide text-muted-foreground uppercase"><tr><th className="px-3 py-2">Parameter</th><th className="px-3 py-2">Result</th><th className="px-3 py-2">Reference</th><th className="px-3 py-2">Flag</th></tr></thead>
                    <tbody className="divide-y">
                      {sample.results.map((result) => {
                        const range = result.parameter.ranges[0];
                        return (
                          <tr key={result.id} className={result.flag === "CRITICAL" ? "bg-destructive/5" : undefined}>
                            <td className="px-3 py-2 font-medium">{result.parameter.name}</td>
                            <td className="px-3 py-2 tabular-nums">{result.numericValue?.toString() ?? result.textValue ?? "—"} <span className="text-muted-foreground">{result.parameter.unit ?? ""}</span></td>
                            <td className="px-3 py-2 text-muted-foreground">{range?.textValue ?? (range?.low != null || range?.high != null ? `${range?.low ?? "–"} – ${range?.high ?? "–"}` : "—")}</td>
                            <td className="px-3 py-2">{result.flag ? <StatusPill value={result.flag} /> : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          ))}
          {report.imagingOrder ? (
            <Panel title="Imaging studies" description="Write the findings in the comment when you sign. Upload scan images and the typed report below.">
              <ul className="divide-y text-sm">
                {report.imagingOrder.studies.map((study) => (
                  <li key={study.id} className="flex items-center justify-between py-2"><span>{study.service.name} <span className="text-muted-foreground">· {study.accession}</span></span><StatusPill value={study.status} /></li>
                ))}
              </ul>
            </Panel>
          ) : null}
          <ReportFilesPanel
            reportId={report.id}
            files={files}
            items={report.booking.items.map((item) => ({ id: item.id, name: item.name }))}
            canManage={canManageReportFiles(actor, report)}
            open={OPEN_FOR_FILES.has(report.status)}
            imaging={Boolean(report.imagingOrder && !report.labOrder)}
          />
          <Panel title="Review" description="Each step is saved with your name and time. You cannot verify or approve results you entered yourself.">
            {next.length === 0 ? <p className="text-sm text-muted-foreground">Nothing for you to do here right now.</p> : (
              <div className="grid gap-3">
                {selfReview && next.some((status) => status === "VERIFIED" || status === "APPROVED") ? <p className="rounded-lg bg-warning/15 px-3 py-2 text-sm">You entered some of these results, so another reviewer must verify or approve them.</p> : null}
                <div className="flex flex-wrap gap-3">
                  {next.map((status) => (
                    <ConfirmForm key={status} action={reportAction} variant={status === "REJECTED" ? "destructive" : "default"} confirm={status === "RELEASED" ? "Release builds the signed PDF and notifies the patient. Continue?" : `${label[status] ?? status}?`} submit={label[status] ?? status}>
                      <input type="hidden" name="reportId" value={report.id} />
                      <input type="hidden" name="to" value={status} />
                      <input name="comment" required={status === "REJECTED" || status === "AMENDED"} aria-label="Comment" placeholder={status === "REJECTED" || status === "AMENDED" ? "Reason (required)" : report.imagingOrder && !report.labOrder ? "Findings / impression" : "Comment (optional)"} className="h-10 w-64 rounded-lg border bg-card px-3 text-sm" />
                    </ConfirmForm>
                  ))}
                </div>
              </div>
            )}
          </Panel>
        </div>
        <div className="grid content-start gap-4">
          <Panel title="Report PDF">
            {report.versions.length === 0 ? <p className="text-sm text-muted-foreground">The PDF is made when the report is released. Patients cannot see the report before that.</p> : (
              <ul className="grid gap-2 text-sm">{report.versions.map((version) => <li key={version.id} className="flex justify-between"><span>Version {version.version}</span><span className="text-muted-foreground">{formatWhen(version.createdAt)}</span></li>)}</ul>
            )}
            {released ? <Link className={buttonVariants({ className: "mt-4 w-full" })} href={`/api/v1/reports/${report.id}/open`} target="_blank" rel="noopener"><Download className="size-4" aria-hidden />Download PDF</Link> : null}
          </Panel>
          <Panel title="Sign-off history">
            {report.approvals.length === 0 ? <p className="text-sm text-muted-foreground">No one has signed yet.</p> : (
              <ol className="relative grid gap-4 border-l pl-5 text-sm">
                {report.approvals.map((approval) => (
                  <li key={approval.id} className="relative">
                    <ShieldCheck className="absolute top-0.5 -left-[1.85rem] size-4 rounded-full bg-card text-primary" aria-hidden />
                    <p className="font-medium">{titleCase(approval.decision)} · {approval.approver.name}</p>
                    <p className="text-xs text-muted-foreground">{formatWhen(approval.createdAt)}</p>
                    {approval.comment ? <p className="mt-0.5 text-xs">{approval.comment}</p> : null}
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
