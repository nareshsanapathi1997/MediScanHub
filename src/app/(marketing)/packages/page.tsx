import Link from "next/link";
import { listPublicPackages } from "@/lib/services/catalog";
import { formatInr } from "@/lib/format";
import { PageHeader } from "@/components/widgets";

export const metadata = { title: "Packages" };

export default async function PackagesPage() {
  const packages = await listPublicPackages();
  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-4 py-10">
      <PageHeader eyebrow="Catalog" title="Packages" description="A package price is stored on the package, not summed in the browser." />
      <div className="grid gap-4 md:grid-cols-2">
        {packages.map((pkg) => (
          <article key={pkg.id} className="rounded-2xl border bg-card p-5">
            <h2 className="font-display text-3xl">{pkg.name}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{pkg.description}</p>
            <ul className="mt-3 list-disc pl-5 text-sm">{pkg.items.map((item) => <li key={item.serviceId}>{item.service.name}</li>)}</ul>
            <p className="mt-3">{formatInr(pkg.pricePaise)} at {pkg.tenant.name}</p>
            <Link href={`/centers/${pkg.tenant.slug}?package=${pkg.id}`} className="text-sm text-primary">Continue</Link>
          </article>
        ))}
      </div>
    </main>
  );
}
