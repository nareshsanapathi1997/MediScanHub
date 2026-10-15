import { requireSession } from "@/server/session";
import { listTenantsAdmin } from "@/lib/services/admin";
import { decisionAction } from "@/server/actions";
import { deny } from "@/components/guard";
import { ConfirmForm } from "@/components/confirm-form";
import { PageHeader, StatusPill } from "@/components/widgets";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Center review" };

export default async function CentersReviewPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { actor } = await requireSession();
  const query = await searchParams;
  const status = ["PENDING", "ACTIVE", "SUSPENDED", "REJECTED"].includes(query.status ?? "") ? query.status as "PENDING" | "ACTIVE" | "SUSPENDED" | "REJECTED" : undefined;
  const blocked = deny(actor, "tenants.review");
  if (blocked) return blocked;
  return (
    <>
      <PageHeader eyebrow="Review" title="Centers" description="Approve starts a trial. Suspend and reject take the center out of the public directory." />
      <form className="flex flex-wrap gap-2 text-sm">
        {["", "PENDING", "ACTIVE", "SUSPENDED", "REJECTED"].map((value) => (
          <button key={value || "all"} name="status" value={value} className="rounded-full border px-3 py-1">{value || "All"}</button>
        ))}
      </form>
      <CenterList status={status} />
    </>
  );
}

async function CenterList({ status }: { status?: "PENDING" | "ACTIVE" | "SUSPENDED" | "REJECTED" }) {
  const { actor } = await requireSession();
  const tenants = await listTenantsAdmin(actor, status);
  if (tenants.length === 0) return <p className="text-sm text-muted-foreground">No centers match that filter.</p>;
  return (
    <div className="grid gap-4">
      {tenants.map((tenant) => (
        <article key={tenant.id} className="grid gap-3 rounded-2xl border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-2xl">{tenant.name}</h2>
              <p className="text-sm text-muted-foreground">{tenant.city} · {tenant.slug} · joined {formatDate(tenant.createdAt)} · {tenant._count.bookings} bookings</p>
            </div>
            <StatusPill value={tenant.status} />
          </div>
          <p className="text-sm">{tenant.branches.length} branches · plan {tenant.subscriptions[0]?.plan.name ?? "none"} · {tenant.verifications.length} verification files</p>
          <div className="flex flex-wrap gap-2">
            {tenant.verifications.map((doc) => (
              <a key={doc.id} className="text-sm text-primary" href={`/api/v1/verification/${doc.id}`}>{doc.documentType}</a>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            {(["APPROVE", "REJECT", "SUSPEND", "REACTIVATE"] as const).map((decision) => (
              <ConfirmForm key={decision} action={decisionAction} confirm={`${decision} ${tenant.name}?`} submit={decision.toLowerCase()}>
                <input type="hidden" name="tenantId" value={tenant.id} />
                <input type="hidden" name="decision" value={decision} />
                <input name="notes" placeholder="Notes" className="h-10 rounded-lg border px-2" />
              </ConfirmForm>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
