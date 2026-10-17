import { requireSession } from "@/server/session";
import { listCategories, listTenantCatalog } from "@/lib/services/catalog";
import { serviceAction } from "@/server/actions";
import { Gate, NeedTenant } from "@/components/guard";
import { FormBox } from "@/components/form-box";
import { EmptyState, PageHeader, Panel, StatusPill } from "@/components/widgets";
import { FlaskConical, ScanLine, Search } from "lucide-react";
import Link from "next/link";
import { formatInr } from "@/lib/format";
import { SCAN_MODALITIES, modalityLabel } from "@/domain/scan-scheduling";

export const metadata = { title: "Catalog" };

export default async function CatalogPage({ searchParams }: { searchParams: Promise<{ show?: string; q?: string }> }) {
  const { actor } = await requireSession();
  const query = await searchParams;
  return (
    <Gate actor={actor} permission="catalog.manage">
      <NeedTenant actor={actor}>
        <CatalogBody show={query.show} q={query.q} />
      </NeedTenant>
    </Gate>
  );
}

async function CatalogBody({ show, q }: { show?: string; q?: string }) {
  const { actor } = await requireSession();
  const [all, categories] = await Promise.all([listTenantCatalog(actor), listCategories()]);
  const labCount = all.filter((service) => service.kind === "LAB").length;
  const filters = [
    { key: "", label: "All", count: all.length },
    { key: "lab", label: "Lab tests", count: labCount },
    { key: "scans", label: "Scans", count: all.length - labCount },
    { key: "drafts", label: "Drafts", count: all.filter((service) => !service.published).length },
  ];
  const needle = (q ?? "").trim().toLowerCase();
  const services = all.filter((service) =>
    (show === "lab" ? service.kind === "LAB" : show === "scans" ? service.kind === "IMAGING" : show === "drafts" ? !service.published : true) &&
    (!needle || `${service.name} ${service.code} ${service.category.name}`.toLowerCase().includes(needle)));
  const lowest = (service: (typeof all)[number]) => {
    const prices = service.prices.map((price) => price.pricePaise - price.discountPaise);
    return prices.length ? Math.min(...prices) : null;
  };
  return (
    <>
      <PageHeader eyebrow="Catalog" title="Tests and scans" description="Add tests and scans. Turn on Publish so patients can find and book them." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-start">
        <Panel title="Your catalog" description={`${labCount} lab tests · ${all.length - labCount} scans`} className="overflow-hidden">
          <div className="mb-4 grid gap-3">
            <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 text-sm" aria-label="Filter catalog">
              {filters.map((filter) => {
                const active = (show ?? "") === filter.key;
                return (
                  <Link key={filter.label} href={filter.key ? `?show=${filter.key}` : "?"} aria-current={active ? "page" : undefined}
                    className={active ? "shrink-0 rounded-full bg-primary px-3.5 py-1.5 font-medium text-primary-foreground" : "shrink-0 rounded-full border px-3.5 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"}>
                    {filter.label} <span className="tabular-nums opacity-70">{filter.count}</span>
                  </Link>
                );
              })}
            </nav>
            <form role="search" className="relative">
              {show ? <input type="hidden" name="show" value={show} /> : null}
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input name="q" type="search" defaultValue={q} placeholder="Search by name, code or category" aria-label="Search catalog" className="h-10 w-full rounded-lg border bg-background pr-3 pl-9 text-sm" />
            </form>
          </div>
          {services.length === 0 ? (
            <div><EmptyState icon={FlaskConical} title={all.length ? "Nothing matches" : "No tests yet"} body={all.length ? "Try another filter or search." : "Add your first test or scan with the form. It stays hidden until you publish it."} /></div>
          ) : (
            <ul className="-mx-5 -mb-5 divide-y border-t">
              {services.map((service) => {
                const Icon = service.kind === "IMAGING" ? ScanLine : FlaskConical;
                return (
                  <li key={service.id} className="flex items-start gap-3 px-5 py-4">
                    <span className={service.kind === "IMAGING" ? "grid size-9 shrink-0 place-items-center rounded-xl bg-info/12 text-info" : "grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground"}><Icon className="size-4" aria-hidden /></span>
                    <div className="grid min-w-0 flex-1 gap-0.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="font-medium">{service.name}</h2>
                        <span className="flex items-center gap-2">
                          {lowest(service) != null ? <span className="text-sm font-semibold tabular-nums">{lowest(service)! > 0 ? `from ${formatInr(lowest(service)!)}` : "Free"}</span> : <Link href="/console/org/pricing" className="text-xs font-medium text-[oklch(0.5_0.12_65)] hover:underline dark:text-warning">Set price</Link>}
                          <StatusPill value={service.published ? "PUBLISHED" : "DRAFT"} />
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground"><span className="font-mono">{service.code}</span> · {service.kind === "IMAGING" ? modalityLabel(service.modality) : "Lab"} · {service.category.name} · Report in {service.tatHours}h</p>
                      <p className="text-sm text-muted-foreground">{service.description}</p>
                      {service.parameters.length > 0 ? <p className="text-xs text-muted-foreground">Parameters: {service.parameters.map((parameter) => `${parameter.name} (${parameter.unit ?? parameter.resultType})`).join(", ")}</p> : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
        <Panel title="Add a test or scan" description="Scans need a scan type so patients see the right room and slots." className="xl:sticky xl:top-20">
          <FormBox action={serviceAction} submit="Add to catalog">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <label className="field">Name<input name="name" required placeholder="e.g. Vitamin D (25-OH)" /></label>
              <label className="field">Web address name<input name="slug" required placeholder="vitamin-d" /></label>
              <label className="field">Code<input name="code" required placeholder="VITD" /></label>
              <label className="field">Category
                <select name="categoryId" required defaultValue={categories[0]?.id}>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </label>
              <label className="field">Type
                <select name="kind" defaultValue="LAB"><option value="LAB">Lab test</option><option value="IMAGING">Scan</option></select>
              </label>
              <label className="field">Scan type (scans only)
                <select name="modality" defaultValue="">
                  <option value="">Not a scan</option>
                  {Object.entries(SCAN_MODALITIES).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                </select>
              </label>
              <label className="field">Report time (hours)<input name="tatHours" type="number" min="1" defaultValue="24" /></label>
              <label className="field">Sample type<input name="sampleType" placeholder="e.g. Serum" /></label>
              <label className="field sm:col-span-2 xl:col-span-1">Description<textarea name="description" required rows={2} /></label>
              <label className="field sm:col-span-2 xl:col-span-1">Preparation<textarea name="preparation" rows={2} placeholder="e.g. No fasting needed." /></label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="published" /> Publish on the directory</label>
            </div>
          </FormBox>
        </Panel>
      </div>
    </>
  );
}
