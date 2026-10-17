import { requireSession } from "@/server/session";
import { listTenantCatalog, tenantBranches } from "@/lib/services/catalog";
import { priceAction } from "@/server/actions";
import { formatInr } from "@/lib/format";
import { Gate, NeedTenant } from "@/components/guard";
import { FormBox } from "@/components/form-box";
import { EmptyState, PageHeader, Panel, Workspace } from "@/components/widgets";
import { IndianRupee } from "lucide-react";
import { sentenceCase } from "@/lib/format";

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
  const priced = services.filter((service) => service.prices.length > 0);
  return (
    <>
      <PageHeader eyebrow="Pricing" title="Prices and discounts" description="Set the price of each test at each branch, in rupees. Patients pay the price shown here." />
      <Workspace aside={
        <Panel title="Set a price" description="Saving again for the same branch and test replaces the old price.">
          <FormBox action={priceAction} submit="Set price">
            <label className="field">Branch
              <select name="branchId" required>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>
            </label>
            <label className="field">Test or scan
              <select name="serviceId" required>{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="field">Price (₹)<input name="rupees" type="number" min="0" step="1" required /></label>
              <label className="field">Discount (₹)<input name="discount" type="number" min="0" step="1" defaultValue="0" /></label>
            </div>
          </FormBox>
        </Panel>
      }>
        <Panel title="Price list" description={`${priced.length} of ${services.length} tests have a price.`}>
          {priced.length === 0 ? <EmptyState icon={IndianRupee} title="No prices yet" body="Set a price so patients can book this test online." /> : (
            <div className="-mx-5 -mb-5 overflow-x-auto border-t">
              <table className="w-full min-w-[32rem] text-sm">
                <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr><th className="px-5 py-2.5 font-medium">Test</th>{branches.map((branch) => <th key={branch.id} className="px-5 py-2.5 text-right font-medium">{branch.name}</th>)}</tr>
                </thead>
                <tbody className="divide-y">
                  {priced.map((service) => (
                    <tr key={service.id} className="hover:bg-muted/30">
                      <th scope="row" className="px-5 py-3 text-left font-medium">{service.name}<span className="block text-xs font-normal text-muted-foreground">{service.category?.name ?? sentenceCase(service.kind)}</span></th>
                      {branches.map((branch) => {
                        const price = service.prices.filter((item) => item.branchId === branch.id).at(-1);
                        return (
                          <td key={branch.id} className="px-5 py-3 text-right tabular-nums">
                            {price ? (
                              <>
                                <span className="font-medium">{formatInr(price.pricePaise - price.discountPaise)}</span>
                                {price.discountPaise ? <span className="block text-xs text-muted-foreground line-through">{formatInr(price.pricePaise)}</span> : null}
                              </>
                            ) : <span className="text-muted-foreground">—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </Workspace>
    </>
  );
}
