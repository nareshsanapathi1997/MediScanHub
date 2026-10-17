import { Pagination } from "@/components/pagination";
import { fetchPage, parsePage } from "@/lib/pagination";
import { requireSession } from "@/server/session";
import { listTenantCatalog, tenantPackagesPage } from "@/lib/services/catalog";
import { packageAction } from "@/server/actions";
import { formatInr } from "@/lib/format";
import { Gate, NeedTenant } from "@/components/guard";
import { FormBox } from "@/components/form-box";
import { EmptyState, PageHeader, Panel, Workspace } from "@/components/widgets";
import { Package } from "lucide-react";
import { ViewToggle } from "@/components/view-toggle";
import { ListView } from "@/components/list-view";
import { resolveView, viewHrefs } from "@/lib/view-mode";

export const metadata = { title: "Packages" };

export default async function PackagesPage({ searchParams }: { searchParams: Promise<{ view?: string; page?: string }> }) {
  const params = await searchParams;
  const { actor } = await requireSession();
  return (
    <Gate actor={actor} permission="catalog.manage">
      <NeedTenant actor={actor}>
        <PackagesBody params={params} />
      </NeedTenant>
    </Gate>
  );
}

async function PackagesBody({ params }: { params: { view?: string; page?: string } }) {
  const view = await resolveView("org-packages", params.view);
  const viewToggle = <ViewToggle page="org-packages" view={view} hrefs={viewHrefs("/console/org/packages", params)} />;
  const { actor } = await requireSession();
  const [{ items: packages, total, args: paging }, services] = await Promise.all([fetchPage(parsePage(params, 10), (args) => tenantPackagesPage(actor, args)), listTenantCatalog(actor)]);
  return (
    <>
      <PageHeader eyebrow="Packages" title="Health packages" description="Group tests into a package with one price, like a Full Body Checkup or Diabetes Care package." />
      <Workspace aside={
        <Panel title="New package" description="Unpublished packages stay hidden from patients.">
          <FormBox action={packageAction} submit="Save package">
            <label className="field">Name<input name="name" required placeholder="Diabetes Care" /></label>
            <label className="field">Web address (slug)<input name="slug" required placeholder="diabetes-care" pattern="[a-z0-9-]+" /></label>
            <label className="field">Description<textarea name="description" required rows={2} /></label>
            <label className="field">Price (₹)<input name="rupees" type="number" min="0" required /></label>
            <fieldset className="grid gap-1.5 text-sm">
              <legend className="mb-1.5 font-medium">Included tests</legend>
              <div className="grid max-h-56 gap-1.5 overflow-y-auto pr-1">
                {services.filter((service) => service.kind === "LAB").map((service) => (
                  <label key={service.id} className="flex items-center gap-2.5 rounded-lg border px-3 py-2 has-[:checked]:border-primary has-[:checked]:bg-primary/5"><input type="checkbox" name="serviceId" value={service.id} className="size-4 accent-[var(--primary)]" />{service.name}</label>
                ))}
              </div>
            </fieldset>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="published" className="size-4 accent-[var(--primary)]" /> Publish now</label>
          </FormBox>
        </Panel>
      }>
        {packages.length === 0 ? <EmptyState icon={Package} title="No packages yet" body="Create a package to offer a group of tests at one price." /> : (
          <div className="grid gap-3">
            <div className="flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{total} package{total === 1 ? "" : "s"}</p>{viewToggle}</div>
            {view === "list" ? (
              <ListView label="Packages" columns={[{ key: "name", label: "Package" }, { key: "tests", label: "Tests" }, { key: "status", label: "Status" }, { key: "price", label: "Price", align: "right" }]}
                rows={packages.map((pkg) => ({
                  id: pkg.id,
                  cells: {
                    name: pkg.name,
                    tests: <span title={pkg.items.map((item) => item.service.name).join(", ")}>{pkg.items.length} test{pkg.items.length === 1 ? "" : "s"}</span>,
                    status: <span className={pkg.published ? "rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success" : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"}>{pkg.published ? "Published" : "Draft"}</span>,
                    price: <span className="font-semibold">{formatInr(pkg.pricePaise)}</span>,
                  },
                }))} />
            ) : (
              <ul className="grid gap-4 md:grid-cols-2">
                {packages.map((pkg) => (
                  <li key={pkg.id} className="surface grid content-start gap-3 p-5">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-display text-xl">{pkg.name}</h2>
                      <span className={pkg.published ? "rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success" : "rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"}>{pkg.published ? "Published" : "Draft"}</span>
                    </div>
                    <p className="font-display text-2xl tabular-nums">{formatInr(pkg.pricePaise)}</p>
                    <p className="text-xs font-medium text-muted-foreground">{pkg.items.length} test{pkg.items.length === 1 ? "" : "s"} included</p>
                    <ul className="flex flex-wrap gap-1.5">
                      {pkg.items.map((item) => <li key={item.service.name} className="rounded-full bg-muted px-2.5 py-1 text-xs">{item.service.name}</li>)}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
            <Pagination pathname="/console/org/packages" params={params} page={paging.page} pageSize={paging.pageSize} total={total} noun={total === 1 ? "package" : "packages"} />
          </div>
        )}
      </Workspace>
    </>
  );
}
