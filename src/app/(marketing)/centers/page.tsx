import Link from "next/link";
import { listCenters } from "@/lib/services/catalog";
import { PageHeader } from "@/components/widgets";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Centers" };

export default async function CentersPage({ searchParams }: { searchParams: Promise<{ city?: string }> }) {
  const { city } = await searchParams;
  const centers = await listCenters(city);
  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-4 py-10">
      <PageHeader eyebrow="Directory" title="Diagnostic centers" description="Only verified, active centers appear here. Pending applications stay private." />
      <form className="flex gap-2">
        <input name="city" defaultValue={city} placeholder="City" aria-label="City" className="h-10 rounded-lg border px-3" />
        <Button type="submit" className="h-10">Filter</Button>
      </form>
      <div className="grid gap-4 md:grid-cols-2">
        {centers.map((center) => (
          <Link key={center.id} href={`/centers/${center.slug}`} className="rounded-2xl border bg-card p-5" style={{ borderTop: `4px solid ${center.brandColor}` }}>
            <h2 className="font-display text-3xl">{center.name}</h2>
            <p className="text-sm text-muted-foreground">{center.city}, {center.state}</p>
            <ul className="mt-3 text-sm">{center.branches.map((branch) => <li key={branch.id}>{branch.name} · {branch.city}{branch.homeCollection ? " · home collection" : ""}</li>)}</ul>
          </Link>
        ))}
      </div>
      {centers.length === 0 ? <p className="text-sm text-muted-foreground">No active centers in that city.</p> : null}
    </main>
  );
}
