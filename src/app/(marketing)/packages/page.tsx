import Link from "next/link";
import { listPublicPackages } from "@/lib/services/catalog";
import { formatInr } from "@/lib/format";
import { PageHeader } from "@/components/widgets";

export const metadata = { title: "Packages" };

export default async function PackagesPage() {
  const packages = await listPublicPackages();
  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-4 py-10">
      <PageHeader eyebrow="Health checkups" title="Health checkup packages" description="Packages group common tests at one price. Good for a yearly full body checkup or diabetes follow-up." />
      <div className="grid gap-4 md:grid-cols-2">
        {packages.map((pkg) => (
          <article key={pkg.id} className="rounded-2xl border bg-card p-5">
            <h2 className="font-display text-3xl">{pkg.name}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{pkg.description}</p>
            <ul className="mt-3 list-disc pl-5 text-sm">{pkg.items.map((item) => <li key={item.serviceId}>{item.service.name}</li>)}</ul>
            <p className="mt-3">{formatInr(pkg.pricePaise)} at {pkg.tenant.name}</p>
            <Link href={`/centers/${pkg.tenant.slug}?package=${pkg.id}`} className="text-sm text-primary">Book this package</Link>
          </article>
        ))}
      </div>
    </main>
  );
}
