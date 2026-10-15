import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/server/session";
import { getSample, listTechnicians } from "@/lib/services/lab";
import { assignSampleAction, resultsAction, sampleAction } from "@/server/actions";
import { SAMPLE_TRANSITIONS } from "@/domain/state";
import { hasPermission } from "@/domain/actor";
import { DomainError } from "@/lib/errors";
import { formatWhen } from "@/lib/format";
import { deny } from "@/components/guard";
import { FormBox } from "@/components/form-box";
import { ConfirmForm } from "@/components/confirm-form";
import { Breadcrumbs, PageHeader, StatusPill } from "@/components/widgets";

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
  const next = SAMPLE_TRANSITIONS[sample.status].filter((status) => {
    if (status === "REJECTED" || status === "RECOLLECTION") {
      return hasPermission(actor, "samples.collect", actor.activeTenantId) || hasPermission(actor, "results.enter", actor.activeTenantId);
    }
    if (status === "COLLECTED" || status === "IN_TRANSIT" || status === "PENDING") return hasPermission(actor, "samples.collect", actor.activeTenantId);
    return hasPermission(actor, "results.enter", actor.activeTenantId);
  });
  const canEnter = hasPermission(actor, "results.enter", actor.activeTenantId) && ["PROCESSING", "RESULTED"].includes(sample.status);
  const canAssign = hasPermission(actor, "results.enter", actor.activeTenantId);
  const technicians = canAssign ? await listTechnicians(actor) : [];
  return (
    <>
      <Breadcrumbs items={[{ href: "/console/lab", label: "Laboratory" }, { label: sample.barcode?.code ?? "Sample" }]} />
      <PageHeader title={sample.service.name} description={sample.labOrder.booking.publicCode} actions={<Link className="text-sm text-primary" href={`/console/lab/samples/${sample.id}/label`}>Print label</Link>} />
      <StatusPill value={sample.status} />
      <p className="text-sm text-muted-foreground">Technician: {sample.assignee?.name ?? "Unassigned"}</p>
      {canAssign ? (
        <form action={assignSampleAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="sampleId" value={sample.id} />
          <label className="field">Assign technician
            <select name="assigneeId" defaultValue={sample.assigneeId ?? ""} required>
              <option value="" disabled>Choose a technician</option>
              {technicians.map((member) => <option key={member.userId} value={member.userId}>{member.user.name} · {member.role.name}</option>)}
            </select>
          </label>
          <button className="h-10 rounded-lg border px-3 text-sm" type="submit">Assign</button>
        </form>
      ) : null}
      <ol className="grid gap-1 text-sm">
        {sample.events.map((event) => <li key={event.id}>{formatWhen(event.createdAt)} · {event.type} · {event.actor?.name ?? "System"}{event.note ? ` · ${event.note}` : ""}</li>)}
      </ol>
      <div className="flex flex-wrap gap-3">
        {next.map((status) => (
          <ConfirmForm key={status} action={sampleAction} confirm={`Move sample to ${status}?`} submit={status.toLowerCase()}>
            <input type="hidden" name="sampleId" value={sample.id} />
            <input type="hidden" name="to" value={status} />
            {status === "REJECTED" ? <input name="reason" required placeholder="Rejection reason" className="h-10 rounded-lg border px-2" /> : null}
          </ConfirmForm>
        ))}
      </div>
      {sample.results.length > 0 ? (
        <section className="grid gap-1 text-sm">
          <h2 className="font-display text-2xl">Entered values</h2>
          {sample.results.map((result) => (
            <p key={result.id}>{result.parameterId} · {result.numericValue?.toString() ?? result.textValue} · {result.flag ?? "unflagged"} · {result.status}</p>
          ))}
          <p className="text-muted-foreground">Flags compare the number with the configured range. They are not a diagnosis.</p>
        </section>
      ) : null}
      {canEnter ? (
        <FormBox action={resultsAction} submit="Save results" success="Results saved. They are not released.">
          <input type="hidden" name="sampleId" value={sample.id} />
          <input type="hidden" name="parameterIds" value={sample.service.parameters.map((parameter) => parameter.id).join(",")} />
          {sample.service.parameters.map((parameter) => (
            <label key={parameter.id} className="field">
              {parameter.name} {parameter.unit ? `(${parameter.unit})` : ""} · {parameter.resultType}
              {parameter.resultType === "NUMERIC"
                ? <input name={`n:${parameter.id}`} inputMode="decimal" required />
                : <input name={`t:${parameter.id}`} required />}
            </label>
          ))}
        </FormBox>
      ) : null}
    </>
  );
}
