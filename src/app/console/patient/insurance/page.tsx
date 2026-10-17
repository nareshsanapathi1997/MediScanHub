import { Pagination } from "@/components/pagination";
import { fetchPage, parsePage } from "@/lib/pagination";
import { requireSession } from "@/server/session";
import { listInsurancePage } from "@/lib/services/patient-extras";
import { Gate } from "@/components/guard";
import { FormBox } from "@/components/form-box";
import { PageHeader, EmptyState, Facts, Panel, RemoveForm, StatusPill, Workspace } from "@/components/widgets";
import { ShieldCheck } from "lucide-react";
import { deleteInsuranceAction, insuranceAction } from "@/server/actions";
import { formatDate } from "@/lib/format";
import { ViewToggle } from "@/components/view-toggle";
import { ListView } from "@/components/list-view";
import { resolveView, viewHrefs } from "@/lib/view-mode";

export const metadata = { title: "Insurance & TPA" };

export default async function InsurancePage({ searchParams }: { searchParams: Promise<{ view?: string; page?: string }> }) {
  const params = await searchParams;
  const { actor } = await requireSession();
  return (
    <Gate actor={actor} permission="patient.portal">
      <InsuranceBody params={params} />
    </Gate>
  );
}

async function InsuranceBody({ params }: { params: { view?: string; page?: string } }) {
  const view = await resolveView("insurance", params.view);
  const viewToggle = <ViewToggle page="insurance" view={view} hrefs={viewHrefs("/console/patient/insurance", params)} />;
  const { actor } = await requireSession();
  const { items: policies, total, args: paging } = await fetchPage(parsePage(params, 10), (args) => listInsurancePage(actor, args));
  return (
    <>
      <PageHeader eyebrow="Coverage" title="Health insurance" description="Save your health insurance policy. You can pick it at checkout, and the center will raise the claim with your insurer or TPA." />
      <Workspace aside={
        <Panel title="Add a policy" description="Use the details printed on your health card.">
          <FormBox action={insuranceAction} submit="Save policy">
            <label className="field">Insurer<input name="provider" required placeholder="e.g. Star Health" /></label>
            <label className="field">Policy number<input name="policyNumber" required /></label>
            <label className="field">TPA name (optional)<input name="tpaName" placeholder="e.g. Medi Assist" /></label>
            <label className="field">Valid until<input name="validUntil" type="date" /></label>
          </FormBox>
        </Panel>
      }>
        {policies.length === 0 ? <EmptyState title="No policy added" body="Add your insurer or third-party administrator (TPA) details." icon={ShieldCheck} /> : (
          <div className="grid gap-3">
            <div className="flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{total} polic{total === 1 ? "y" : "ies"}</p>{viewToggle}</div>
            {view === "list" ? (
              <ListView label="Policies" columns={[{ key: "provider", label: "Insurer" }, { key: "number", label: "Policy number" }, { key: "tpa", label: "TPA" }, { key: "valid", label: "Valid until" }, { key: "status", label: "Status" }]}
              rows={policies.map((policy) => {
                const expired = policy.validUntil ? policy.validUntil < new Date() : false;
                return {
                  id: policy.id,
                  cells: {
                    provider: policy.provider,
                    number: <span className="font-mono text-xs">{policy.policyNumber}</span>,
                    tpa: policy.tpaName || "—",
                    valid: policy.validUntil ? formatDate(policy.validUntil) : "Not given",
                    status: <StatusPill value={expired ? "EXPIRED" : "ACTIVE"} />,
                  },
                  actions: <RemoveForm action={deleteInsuranceAction} id={policy.id} label={`Remove policy ${policy.policyNumber}`} />,
                };
              })} />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {policies.map((policy) => {
                  const expired = policy.validUntil ? policy.validUntil < new Date() : false;
                  return (
                    <article key={policy.id} className="surface grid gap-4 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <span className="grid size-10 place-items-center rounded-xl bg-info/12 text-info"><ShieldCheck className="size-5" aria-hidden /></span>
                        <StatusPill value={expired ? "EXPIRED" : "ACTIVE"} />
                      </div>
                      <div>
                        <h2 className="font-display text-xl">{policy.provider}</h2>
                        <p className="font-mono text-sm text-muted-foreground">{policy.policyNumber}</p>
                      </div>
                      <Facts items={[{ label: "TPA", value: policy.tpaName || "—" }, { label: "Valid until", value: policy.validUntil ? formatDate(policy.validUntil) : "Not given" }]} />
                      <div className="flex justify-end border-t pt-3"><RemoveForm action={deleteInsuranceAction} id={policy.id} label={`Remove policy ${policy.policyNumber}`} /></div>
                    </article>
                  );
                })}
              </div>
            )}
            <Pagination pathname="/console/patient/insurance" params={params} page={paging.page} pageSize={paging.pageSize} total={total} noun={total === 1 ? "policy" : "policies"} />
          </div>
        )}
      </Workspace>
    </>
  );
}
