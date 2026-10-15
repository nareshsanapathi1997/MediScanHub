import { requireSession } from "@/server/session";
import { listTenantCatalog, tenantBranches } from "@/lib/services/catalog";
import { priceAction } from "@/server/actions";
import { formatInr } from "@/lib/format";
import { Gate, NeedTenant } from "@/components/guard";
import { FormBox } from "@/components/form-box";
import { PageHeader } from "@/components/widgets";

export const metadata = { title: "Pricing" };

export default async function PricingPage() {
  const { actor } = await requireSession();
  return (
    <Gate actor={actor} permission="pricing.manage">
      <NeedTenant actor={actor}>
        <PricingBody />
      </NeedTenant>
    </Gate>
  );
}

async function PricingBody() {
  const { actor } = await requireSession();
  const [services, branches] = await Promise.all([listTenantCatalog(actor), tenantBranches(actor)]);
  return (
    <>
      <PageHeader eyebrow="Pricing" title="Branch prices and discounts" description="Checkout ignores any amount sent by the browser and uses the active branch price." />
      <div className="grid gap-2 text-sm">
        {services.flatMap((service) => service.prices.map((price) => (
          <p key={price.id}>{service.name} · {formatInr(price.pricePaise)}{price.discountPaise ? ` less ${formatInr(price.discountPaise)}` : ""}</p>
        )))}
      </div>
      <FormBox action={priceAction} submit="Set price">
        <label className="field">Branch
          <select name="branchId" required>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>
        </label>
        <label className="field">Service
          <select name="serviceId" required>{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select>
        </label>
        <label className="field">Price in rupees<input name="rupees" type="number" min="0" step="1" required /></label>
        <label className="field">Discount in rupees<input name="discount" type="number" min="0" step="1" defaultValue="0" /></label>
      </FormBox>
    </>
  );
}
