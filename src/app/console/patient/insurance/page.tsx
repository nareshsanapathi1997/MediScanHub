import { requireSession } from "@/server/session";
import { listInsurance } from "@/lib/services/patient-extras";
import { Gate } from "@/components/guard";
import { FormBox } from "@/components/form-box";
import { PageHeader, EmptyState } from "@/components/widgets";
import { deleteInsuranceAction, insuranceAction } from "@/server/actions";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Insurance & TPA" };

export default async function InsurancePage() {
  const { actor } = await requireSession();
  return (
    <Gate actor={actor} permission="patient.portal">
      <InsuranceBody />
    </Gate>
  );
}

async function InsuranceBody() {
  const { actor } = await requireSession();
  const policies = await listInsurance(actor);
  return (
    <>
      <PageHeader eyebrow="Coverage" title="Insurance & TPA" description="Store policy details for the center desk. Claims are recorded manually until a TPA adapter is configured." />
      {policies.length === 0 ? <EmptyState title="No policies" body="Add your insurer or third-party administrator details." /> : policies.map((policy) => (
        <article key={policy.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm">
          <span>{policy.provider} · {policy.policyNumber}{policy.tpaName ? ` · TPA ${policy.tpaName}` : ""}{policy.validUntil ? ` · until ${formatDate(policy.validUntil)}` : ""}</span>
          <form action={deleteInsuranceAction}>
            <input type="hidden" name="id" value={policy.id} />
            <button type="submit" className="text-primary">Remove</button>
          </form>
        </article>
      ))}
      <FormBox action={insuranceAction} submit="Save policy">
        <label className="field">Insurer<input name="provider" required /></label>
        <label className="field">Policy number<input name="policyNumber" required /></label>
        <label className="field">TPA name<input name="tpaName" placeholder="Optional" /></label>
        <label className="field">Valid until<input name="validUntil" type="date" /></label>
      </FormBox>
    </>
  );
}
