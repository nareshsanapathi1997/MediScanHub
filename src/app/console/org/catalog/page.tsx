import { requireSession } from "@/server/session";
import { listCategories, listTenantCatalog } from "@/lib/services/catalog";
import { serviceAction } from "@/server/actions";
import { Gate, NeedTenant } from "@/components/guard";
import { FormBox } from "@/components/form-box";
import { PageHeader, StatusPill } from "@/components/widgets";

export const metadata = { title: "Catalog" };

export default async function CatalogPage() {
  const { actor } = await requireSession();
  return (
    <Gate actor={actor} permission="catalog.manage">
      <NeedTenant actor={actor}>
        <CatalogBody />
      </NeedTenant>
    </Gate>
  );
}

async function CatalogBody() {
  const { actor } = await requireSession();
  const [services, categories] = await Promise.all([listTenantCatalog(actor), listCategories()]);
  return (
    <>
      <PageHeader eyebrow="Catalog" title="Tests and studies" description="Publishing makes a service searchable. Branch prices and preparation stay with the service." />
      <div className="grid gap-3">
        {services.map((service) => (
          <article key={service.id} className="rounded-2xl border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-2xl">{service.name}</h2>
              <StatusPill value={service.published ? "PUBLISHED" : "DRAFT"} />
            </div>
            <p className="text-sm text-muted-foreground">{service.code} · {service.kind} · {service.category.name} · TAT {service.tatHours}h</p>
            <p className="text-sm">{service.description}</p>
            {service.parameters.length > 0 ? <p className="text-xs text-muted-foreground">Parameters: {service.parameters.map((parameter) => `${parameter.name} (${parameter.unit ?? parameter.resultType})`).join(", ")}</p> : null}
          </article>
        ))}
      </div>
      <FormBox action={serviceAction} submit="Add service">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="field">Name<input name="name" required /></label>
          <label className="field">Slug<input name="slug" required /></label>
          <label className="field">Code<input name="code" required /></label>
          <label className="field">Category
            <select name="categoryId" required defaultValue={categories[0]?.id}>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <label className="field">Kind
            <select name="kind" defaultValue="LAB"><option value="LAB">Laboratory</option><option value="IMAGING">Imaging</option></select>
          </label>
          <label className="field">TAT hours<input name="tatHours" type="number" min="1" defaultValue="24" /></label>
          <label className="field">Sample type<input name="sampleType" /></label>
          <label className="field">Modality<input name="modality" placeholder="USG" /></label>
          <label className="field sm:col-span-2">Description<textarea name="description" required rows={2} /></label>
          <label className="field sm:col-span-2">Preparation<textarea name="preparation" rows={2} /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="published" /> Publish on the directory</label>
        </div>
      </FormBox>
    </>
  );
}
