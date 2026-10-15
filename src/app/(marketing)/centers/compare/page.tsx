import Link from "next/link";
import { listCenters, compareCenterMetrics } from "@/lib/services/catalog";
import { formatInr } from "@/lib/format";
import { PageHeader } from "@/components/widgets";

export const metadata = { title: "Compare centers" };

export default async function CompareCentersPage({ searchParams }: { searchParams: Promise<{ pick?: string }> }) {
  const query = await searchParams;
  const selected = (query.pick ?? "").split(",").filter(Boolean);
  const centers = await listCenters();
  const compared = await compareCenterMetrics(selected);
  return (
    <main className="mx-auto grid max-w-5xl gap-6 px-4 py-10">
      <PageHeader eyebrow="Directory" title="Compare centers" description="Select up to four active centers. Sample price is the lowest published test price at any branch today." />
      <form className="flex flex-wrap gap-2 text-sm">
        {centers.map((center) => (
          <label key={center.slug} className="flex items-center gap-2 rounded-full border px-3 py-1">
            <input type="checkbox" name="pick" value={center.slug} defaultChecked={selected.includes(center.slug)} />
            {center.name}
          </label>
        ))}
        <button type="submit" className="rounded-lg bg-primary px-3 py-1 text-primary-foreground">Compare</button>
      </form>
      {compared.length === 0 ? (
        <p className="text-sm text-muted-foreground">Choose at least one center above.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="p-2">Center</th>
                <th className="p-2">City</th>
                <th className="p-2">Branches</th>
                <th className="p-2">Home collection</th>
                <th className="p-2">From (sample test)</th>
                <th className="p-2">Profile</th>
              </tr>
            </thead>
            <tbody>
              {compared.map(({ center, branchCount, homeCollectionBranches, samplePricePaise }) => (
                <tr key={center.slug} className="border-b">
                  <td className="p-2 font-medium">{center.name}</td>
                  <td className="p-2">{center.city}</td>
                  <td className="p-2">{branchCount}</td>
                  <td className="p-2">{homeCollectionBranches > 0 ? `${homeCollectionBranches} branch${homeCollectionBranches === 1 ? "" : "es"}` : "Not listed"}</td>
                  <td className="p-2">{samplePricePaise != null ? formatInr(samplePricePaise) : "—"}</td>
                  <td className="p-2"><Link className="text-primary" href={`/centers/${center.slug}`}>View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
