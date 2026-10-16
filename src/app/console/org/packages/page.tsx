import { requireSession } from "@/server/session";
import { listTenantCatalog, tenantPackages } from "@/lib/services/catalog";
import { packageAction } from "@/server/actions";
import { formatInr } from "@/lib/format";
import { Gate, NeedTenant } from "@/components/guard";
import { FormBox } from "@/components/form-box";
import { PageHeader } from "@/components/widgets";

export const metadata = { title: "Packages" };

export default async function PackagesPage() {
  const { actor } = await requireSession();
  return (
    <Gate actor={actor} permission="catalog.manage">
      <NeedTenant actor={actor}>
        <PackagesBody />
      </NeedTenant>
    </Gate>
  );
}

async function PackagesBody() {
  const { actor } = await requireSession();
  const [packages, services] = await Promise.all([tenantPackages(actor), listTenantCatalog(actor)]);
  return (
    <>
      <PageHeader eyebrow="Packages" title="Health packages" description="Group tests into a package with one price, like a Full Body Checkup or Diabetes Care package." />
      {packages.map((pkg) => (
        <article key={pkg.id} className="rounded-2xl border bg-card p-4">
          <h2 className="font-display text-2xl">{pkg.name} · {formatInr(pkg.pricePaise)}</h2>
          <p className="text-sm text-muted-foreground">{pkg.items.map((item) => item.service.name).join(", ") || "No tests yet"}</p>
        </article>
      ))}
      <FormBox action={packageAction} submit="Save package">
        <label className="field">Name<input name="name" required /></label>
        <label className="field">Slug<input name="slug" required /></label>
        <label className="field">Description<textarea name="description" required rows={2} /></label>
        <label className="field">Price in rupees<input name="rupees" type="number" min="0" required /></label>
        <fieldset className="grid gap-2 text-sm">
          <legend>Included tests</legend>
          {services.filter((service) => service.kind === "LAB").map((service) => (
            <label key={service.id} className="flex gap-2"><input type="checkbox" name="serviceId" value={service.id} />{service.name}</label>
          ))}
        </fieldset>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="published" /> Publish</label>
      </FormBox>
    </>
  );
}
