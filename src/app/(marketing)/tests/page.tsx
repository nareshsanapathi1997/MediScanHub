import Link from "next/link";
import { searchServices } from "@/lib/services/catalog";
import { formatInr } from "@/lib/format";
import { PageHeader } from "@/components/widgets";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Tests" };

export default async function TestsPage({ searchParams }: { searchParams: Promise<{ q?: string; city?: string; kind?: string }> }) {
  const params = await searchParams;
  const kind = params.kind === "IMAGING" || params.kind === "LAB" ? params.kind : undefined;
  const tests = await searchServices({ query: params.q, city: params.city, kind });
  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-4 py-10">
      <PageHeader eyebrow="Tests and scans" title="Find a test" description="Search by test name, like CBC, LFT, KFT, thyroid profile, HbA1c, X-ray or MRI. Prices are in rupees and include the center's discount." />
      <form className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-4">
        <label className="field">Test or scan name<input name="q" defaultValue={params.q} className="rounded-lg border px-3" /></label>
        <label className="field">City<input name="city" defaultValue={params.city} className="rounded-lg border px-3" /></label>
        <label className="field">Type
          <select name="kind" defaultValue={params.kind ?? ""} className="h-10 rounded-lg border bg-background px-2">
            <option value="">All</option>
            <option value="LAB">Blood and urine tests</option>
            <option value="IMAGING">Scans (X-ray, ultrasound, CT, MRI)</option>
          </select>
        </label>
        <Button type="submit" className="h-10 self-end">Search</Button>
      </form>
      {tests.length === 0 ? <p className="text-sm text-muted-foreground">No test found. Check the spelling or try a shorter name, like “thyroid” or “sugar”.</p> : (
        <div className="grid gap-3">
          {tests.map((test) => (
            <article key={test.id} className="flex flex-col justify-between gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="font-display text-2xl">{test.name}</h2>
                <p className="text-sm text-muted-foreground">{test.tenant.name} · {test.tenant.city} · Report in {test.tatHours} hours</p>
                <p className="mt-1 text-sm">{test.description}</p>
              </div>
              <div className="text-sm">
                <p>{formatInr((test.prices[0]?.pricePaise ?? 0) - (test.prices[0]?.discountPaise ?? 0))}</p>
                <Link href={`/centers/${test.tenant.slug}?service=${test.id}`} className="text-primary">Book now</Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
