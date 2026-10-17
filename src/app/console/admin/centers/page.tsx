import { requireSession } from "@/server/session";
import { listTenantsAdminPage } from "@/lib/services/admin";
import { decisionAction } from "@/server/actions";
import { deny } from "@/components/guard";
import { ConfirmForm } from "@/components/confirm-form";
import Link from "next/link";
import { ViewToggle } from "@/components/view-toggle";
import { ListView } from "@/components/list-view";
import { Pagination } from "@/components/pagination";
import { fetchPage, parsePage } from "@/lib/pagination";
import { resolveView, viewHrefs } from "@/lib/view-mode";
import { Building2, FileText } from "lucide-react";
import { sentenceCase } from "@/lib/format";
import { EmptyState, PageHeader, StatusPill } from "@/components/widgets";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Center review" };

export default async function CentersReviewPage({ searchParams }: { searchParams: Promise<{ status?: string; view?: string; page?: string }> }) {
  const { actor } = await requireSession();
  const query = await searchParams;
  const status = ["PENDING", "ACTIVE", "SUSPENDED", "REJECTED"].includes(query.status ?? "") ? query.status as "PENDING" | "ACTIVE" | "SUSPENDED" | "REJECTED" : undefined;
  const blocked = deny(actor, "tenants.review");
  if (blocked) return blocked;
  const [view, { items: tenants, total, args: paging }] = await Promise.all([
    resolveView("admin-centers", query.view),
    fetchPage(parsePage(query, 10), (args) => listTenantsAdminPage(actor, status, args)),
  ]);
  return (
    <>
      <PageHeader eyebrow="Review" title="Centers" description="Check documents and approve new centers. Approval starts a free trial. Suspended or rejected centers are hidden from patients." />
      <div className="flex flex-wrap items-center justify-between gap-3">
      <nav className="flex flex-wrap gap-2 text-sm" aria-label="Filter by status">
        {["", "PENDING", "ACTIVE", "SUSPENDED", "REJECTED"].map((value) => {
          const active = (status ?? "") === value;
          return (
            <Link key={value || "all"} href={value ? `/console/admin/centers?status=${value}` : "/console/admin/centers"} aria-current={active ? "page" : undefined}
              className={active ? "rounded-full bg-primary px-3.5 py-1.5 font-medium text-primary-foreground" : "rounded-full border px-3.5 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"}>
              {value ? sentenceCase(value) : "All"}
            </Link>
          );
        })}
      </nav>
      <ViewToggle page="admin-centers" view={view} hrefs={viewHrefs("/console/admin/centers", query)} />
      </div>
      <CenterList tenants={tenants} view={view} />
      {total > 0 ? <Pagination pathname="/console/admin/centers" params={query} page={paging.page} pageSize={paging.pageSize} total={total} noun={total === 1 ? "center" : "centers"} label="Center pages" /> : null}
    </>
  );
}

function CenterList({ tenants, view }: { tenants: Awaited<ReturnType<typeof listTenantsAdminPage>>["items"]; view: "cards" | "list" }) {
  if (tenants.length === 0) return <EmptyState icon={Building2} title="No centers here" body="No centers match that filter." />;
  const decisions = { PENDING: ["APPROVE", "REJECT"], ACTIVE: ["SUSPEND"], SUSPENDED: ["REACTIVATE"], REJECTED: ["APPROVE"] } as Record<string, Array<"APPROVE" | "REJECT" | "SUSPEND" | "REACTIVATE">>;
  if (view === "list") {
    return (
      <ListView label="Centers" columns={[{ key: "name", label: "Center" }, { key: "city", label: "City" }, { key: "status", label: "Status" }, { key: "branches", label: "Branches", align: "right" }, { key: "bookings", label: "Bookings", hideOnMobile: true }, { key: "files", label: "Files", hideOnMobile: true }, { key: "plan", label: "Plan", hideOnMobile: true }]}
        rows={tenants.map((tenant) => ({
          id: tenant.id,
          cells: {
            name: tenant.name,
            city: tenant.city,
            status: <StatusPill value={tenant.status} />,
            branches: <>{tenant.branches.length}<span className="md:hidden"> {tenant.branches.length === 1 ? "branch" : "branches"}</span></>,
            bookings: <>{tenant._count.bookings}<span className="md:hidden"> bookings</span></>,
            files: <>{tenant.verifications.length}<span className="md:hidden"> files</span></>,
            plan: tenant.subscriptions[0]?.plan.name ?? "No plan",
          },
          actions: (decisions[tenant.status] ?? []).map((decision) => (
            <ConfirmForm key={decision} action={decisionAction} confirm={`${sentenceCase(decision)} ${tenant.name}?`} submit={sentenceCase(decision)}>
              <input type="hidden" name="tenantId" value={tenant.id} />
              <input type="hidden" name="decision" value={decision} />
            </ConfirmForm>
          )),
        }))} />
    );
  }
  return (
    <ul className="grid gap-4 xl:grid-cols-2">
      {tenants.map((tenant) => (
        <li key={tenant.id} className="surface grid content-between gap-4 p-5">
          <div className="grid gap-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-display text-2xl">{tenant.name}</h2>
                <p className="text-sm text-muted-foreground">{tenant.city} · joined {formatDate(tenant.createdAt)}</p>
              </div>
              <StatusPill value={tenant.status} />
            </div>
            <dl className="grid grid-cols-3 gap-2 text-center">
              {[["Branches", tenant.branches.length], ["Bookings", tenant._count.bookings], ["Files", tenant.verifications.length]].map(([label, value]) => (
                <div key={label as string} className="rounded-lg bg-muted/40 py-2"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="font-display text-xl tabular-nums">{value}</dd></div>
              ))}
            </dl>
            <p className="text-sm">Plan: <span className="font-medium">{tenant.subscriptions[0]?.plan.name ?? "None"}</span></p>
            {tenant.verifications.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {tenant.verifications.map((doc) => (
                  <li key={doc.id}><a className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs hover:border-primary hover:text-primary" href={`/api/v1/verification/${doc.id}`}><FileText className="size-3.5" aria-hidden />{sentenceCase(doc.documentType)}</a></li>
                ))}
              </ul>
            ) : <p className="text-xs text-warning">No documents uploaded.</p>}
          </div>
          <div className="flex flex-wrap gap-3 border-t pt-4">
            {(decisions[tenant.status] ?? ["APPROVE", "REJECT", "SUSPEND", "REACTIVATE"]).map((decision) => (
              <ConfirmForm key={decision} action={decisionAction} confirm={`${sentenceCase(decision)} ${tenant.name}?`} submit={sentenceCase(decision)}>
                <input type="hidden" name="tenantId" value={tenant.id} />
                <input type="hidden" name="decision" value={decision} />
                <input name="notes" placeholder="Note (optional)" aria-label={`Note for ${decision.toLowerCase()}`} className="h-10 rounded-lg border bg-background px-2 text-sm" />
              </ConfirmForm>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
