import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/server/session";
import { getSample, listTechnicians } from "@/lib/services/lab";
import { assignSampleAction, resultsAction, sampleAction } from "@/server/actions";
import { SAMPLE_TRANSITIONS } from "@/domain/state";
import { hasPermission } from "@/domain/actor";
import { DomainError } from "@/lib/errors";
import { formatWhen, titleCase } from "@/lib/format";
import { Printer } from "@/components/icons";
import { Button, buttonVariants } from "@/components/ui/button";
import { deny } from "@/components/guard";
import { FormBox } from "@/components/form-box";
import { ConfirmForm } from "@/components/confirm-form";
import { Breadcrumbs, PageHeader, Panel, StatusPill } from "@/components/widgets";
import { ActionForm } from "@/components/action-form";

export const metadata = { title: "Sample" };

export default async function SamplePage({ params }: { params: Promise<{ id: string }> }) {
  const { actor } = await requireSession();
  const blocked = deny(actor, "samples.read", { tenant: true });
  if (blocked) return blocked;
  const { id } = await params;
  return <SampleBody id={id} />;
}

async function SampleBody({ id }: { id: string }) {
  const { actor } = await requireSession();
  let sample: Awaited<ReturnType<typeof getSample>>;
  try {
    sample = await getSample(actor, id);
  } catch (error) {
    if (error instanceof DomainError && error.status === 404) notFound();
    throw error;
  }
  const tenantId = actor.activeTenantId;
  const next = SAMPLE_TRANSITIONS[sample.status].filter((status) => {
    if (status === "REJECTED" || status === "RECOLLECTION") {
      return hasPermission(actor, "samples.collect", tenantId) || hasPermission(actor, "results.enter", tenantId);
    }
    if (status === "COLLECTED" || status === "IN_TRANSIT" || status === "PENDING") return hasPermission(actor, "samples.collect", tenantId);
    return hasPermission(actor, "results.enter", tenantId);
  });
  const lockedReport = sample.labOrder.reports.find((report) => ["VERIFIED", "APPROVED", "RELEASED"].includes(report.status));
  const canEnter = hasPermission(actor, "results.enter", tenantId) && ["PROCESSING", "RESULTED"].includes(sample.status) && !lockedReport;
  const canAssign = hasPermission(actor, "results.enter", tenantId);
  const technicians = canAssign ? await listTechnicians(actor) : [];
  const byParameter = new Map(sample.results.map((result) => [result.parameterId, result]));
  const patient = sample.labOrder.booking.patient;
  const label: Record<string, string> = { COLLECTED: "Mark collected", IN_TRANSIT: "Send to lab", RECEIVED: "Receive in lab", PROCESSING: "Start processing", RESULTED: "Mark resulted", REJECTED: "Reject sample", RECOLLECTION: "Request recollection", PENDING: "Reopen for collection" };
  return (
    <>
      <Breadcrumbs items={[{ href: "/console/lab", label: "Laboratory" }, { label: sample.barcode?.code ?? "Sample" }]} />
      <PageHeader
        eyebrow={`Sample · ${sample.barcode?.code ?? "no barcode"}`}
        title={sample.service.name}
        description={`${patient.user.name} · ${sample.labOrder.booking.publicCode} · ${sample.labOrder.booking.branch.name}`}
        actions={<div className="flex items-center gap-2"><StatusPill value={sample.status} /><Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/console/lab/samples/${sample.id}/label`}><Printer className="size-4" aria-hidden />Print label</Link></div>}
      />
      {sample.rejectionReason ? <p role="status" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">Rejected: {sample.rejectionReason}</p> : null}
      {lockedReport ? <p role="status" className="rounded-xl border bg-muted/50 px-4 py-3 text-sm">The report is {lockedReport.status.toLowerCase()}, so results are locked. <Link className="font-medium text-primary underline" href={`/console/lab/reports/${lockedReport.id}`}>Open the report</Link> to send it back or amend it.</p> : null}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="grid gap-4 lg:col-span-2">
          <Panel title="Next step" description="You see only the steps your role can do now.">
            {next.length === 0 ? <p className="text-sm text-muted-foreground">No further sample steps for your role. {sample.status === "RESULTED" ? "Review continues on the report." : ""}</p> : (
              <div className="flex flex-wrap gap-3">
                {next.map((status) => (
                  <ConfirmForm key={status} action={sampleAction} variant={status === "REJECTED" ? "destructive" : status === "RECOLLECTION" ? "outline" : "default"} confirm={`${label[status] ?? status}? This is recorded in the sample's chain of custody.`} submit={label[status] ?? status}>
                    <input type="hidden" name="sampleId" value={sample.id} />
                    <input type="hidden" name="to" value={status} />
                    {status === "REJECTED" || status === "RECOLLECTION" ? <input name="reason" required minLength={3} aria-label={`${label[status]} reason`} placeholder="Reason (required), e.g. haemolysed" className="h-10 w-64 rounded-lg border bg-card px-3 text-sm" /> : null}
                  </ConfirmForm>
                ))}
              </div>
            )}
          </Panel>
          <Panel title="Results" description="High, Low and Critical compare the value with the normal range. They are not a diagnosis.">
            {canEnter ? (
              <FormBox action={resultsAction} submit="Save results" success="Results saved. Nothing is released until review.">
                <input type="hidden" name="sampleId" value={sample.id} />
                <input type="hidden" name="parameterIds" value={sample.service.parameters.map((parameter) => parameter.id).join(",")} />
                <div className="grid gap-3 sm:grid-cols-2">
                  {sample.service.parameters.map((parameter) => {
                    const existing = byParameter.get(parameter.id);
                    const range = parameter.ranges[0];
                    const rangeText = range?.textValue ?? (range?.low != null || range?.high != null ? `${range?.low ?? "–"} to ${range?.high ?? "–"}` : "No range configured");
                    return (
                      <label key={parameter.id} className="field">
                        <span className="flex items-center justify-between gap-2">{parameter.name}{parameter.unit ? <span className="text-xs text-muted-foreground">{parameter.unit}</span> : null}</span>
                        {parameter.resultType === "NUMERIC"
                          ? <input name={`n:${parameter.id}`} type="number" step="any" inputMode="decimal" required defaultValue={existing?.numericValue?.toString() ?? ""} />
                          : <input name={`t:${parameter.id}`} required defaultValue={existing?.textValue ?? ""} />}
                        <span className="text-xs font-normal text-muted-foreground">Reference: {rangeText}</span>
                      </label>
                    );
                  })}
                </div>
              </FormBox>
            ) : null}
            {sample.results.length > 0 ? (
              <div className={canEnter ? "mt-5 overflow-x-auto rounded-xl border" : "overflow-x-auto rounded-xl border"}>
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs tracking-wide text-muted-foreground uppercase"><tr><th className="px-3 py-2">Parameter</th><th className="px-3 py-2">Value</th><th className="px-3 py-2">Reference</th><th className="px-3 py-2">Flag</th></tr></thead>
                  <tbody className="divide-y">
                    {sample.service.parameters.filter((parameter) => byParameter.has(parameter.id)).map((parameter) => {
                      const result = byParameter.get(parameter.id)!;
                      const range = parameter.ranges[0];
                      return (
                        <tr key={parameter.id}>
                          <td className="px-3 py-2 font-medium">{parameter.name}</td>
                          <td className="px-3 py-2 tabular-nums">{result.numericValue?.toString() ?? result.textValue ?? "—"} <span className="text-muted-foreground">{parameter.unit ?? ""}</span></td>
                          <td className="px-3 py-2 text-muted-foreground">{range?.textValue ?? (range?.low != null || range?.high != null ? `${range?.low ?? "–"} – ${range?.high ?? "–"}` : "—")}</td>
                          <td className="px-3 py-2">{result.flag ? <StatusPill value={result.flag} /> : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : !canEnter ? <p className="text-sm text-muted-foreground">{sample.status === "PROCESSING" || sample.status === "RESULTED" ? "No results entered yet." : "Results can be entered once the sample is received and processing starts."}</p> : null}
          </Panel>
        </div>
        <div className="grid content-start gap-4">
          {canAssign ? (
            <Panel title="Technician">
              <ActionForm action={assignSampleAction} className="grid gap-2">
                <input type="hidden" name="sampleId" value={sample.id} />
                <label className="field">Assigned to
                  <select name="assigneeId" defaultValue={sample.assigneeId ?? ""} required>
                    <option value="" disabled>Choose a technician</option>
                    {technicians.map((member) => <option key={member.userId} value={member.userId}>{member.user.name} · {member.role.name}</option>)}
                  </select>
                </label>
                <Button variant="outline" type="submit">Assign</Button>
              </ActionForm>
            </Panel>
          ) : <Panel title="Technician"><p className="text-sm">{sample.assignee?.name ?? "Unassigned"}</p></Panel>}
          <Panel title="Sample history">
            <ol className="relative grid gap-4 border-l pl-5 text-sm">
              {sample.events.map((event) => (
                <li key={event.id} className="relative">
                  <span className="absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full bg-primary ring-4 ring-card" aria-hidden />
                  <p className="font-medium">{titleCase(event.type)}</p>
                  <p className="text-xs text-muted-foreground">{formatWhen(event.createdAt)} · {event.actor?.name ?? "System"}</p>
                  {event.note ? <p className="mt-0.5 text-xs">{event.note}</p> : null}
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </>
  );
}
