import Link from "next/link";
import { Check, Home, IndianRupee, MapPin, Minus, Network } from "lucide-react";
import { listCentersPage, compareCenterMetrics } from "@/lib/services/catalog";
import { formatInr } from "@/lib/format";
import { PageHero } from "@/components/marketing/page-hero";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Pagination } from "@/components/pagination";
import { fetchPage, parsePage } from "@/lib/pagination";
import { ViewToggle } from "@/components/view-toggle";
import { resolveView, viewHrefs } from "@/lib/view-mode";

export const metadata = { title: "Compare centers" };

type Compared = Awaited<ReturnType<typeof compareCenterMetrics>>[number];

const ROWS: Array<{ label: string; icon: typeof MapPin; value: (row: Compared) => React.ReactNode }> = [
  { label: "City", icon: MapPin, value: (row) => row.center.city },
  { label: "Branches", icon: Network, value: (row) => row.branchCount },
  {
    label: "Home collection",
    icon: Home,
    value: (row) => row.homeCollectionBranches > 0
      ? <span className="inline-flex items-center gap-1 text-success"><Check className="size-4" aria-hidden />{row.homeCollectionBranches} branch{row.homeCollectionBranches === 1 ? "" : "es"}</span>
      : <span className="inline-flex items-center gap-1 text-muted-foreground"><Minus className="size-4" aria-hidden />Not listed</span>,
  },
  { label: "Tests from", icon: IndianRupee, value: (row) => row.samplePricePaise != null ? <span className="font-semibold">{formatInr(row.samplePricePaise)}</span> : "—" },
];

export default async function CompareCentersPage({ searchParams }: { searchParams: Promise<{ pick?: string | string[]; view?: string; page?: string }> }) {
  const query = await searchParams;
  const selected = [query.pick ?? []].flat().flatMap((value) => value.split(",")).filter(Boolean);
  const [{ items: centers, total, args: paging }, view] = await Promise.all([fetchPage(parsePage(query), (args) => listCentersPage(undefined, args)), resolveView("compare-picker", query.view)]);
  // Picks made on other pages of the picker ride along as hidden fields.
  const pickedElsewhere = selected.filter((slug) => !centers.some((center) => center.slug === slug));
  const compared = await compareCenterMetrics(selected);
  const cheapest = Math.min(...compared.map((row) => row.samplePricePaise ?? Infinity));
  return (
    <main>
      <PageHero
        eyebrow="Directory"
        title="Compare centers"
        description="Pick up to four active centers. “Tests from” is the lowest published test price at any branch today."
        pageKey="centers-compare"
        imageAlt="Modern diagnostic center reception area"
        actions={<Link href="/centers" className="text-sm font-medium text-teal-50 underline-offset-4 hover:underline">Browse all centers</Link>}
      />
      <div className="home-canvas">
        <div className="mx-auto grid w-full max-w-6xl gap-7 px-4 py-8 sm:py-10">
          <form className="grid gap-4 rounded-2xl border bg-card/90 p-5 shadow-sm" aria-label="Choose centers">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium" id="compare-centers">Centers</span>
              <ViewToggle page="compare-picker" view={view} hrefs={viewHrefs("/centers/compare", query)} />
            </div>
            <fieldset aria-labelledby="compare-centers" className={view === "list" ? "-mx-5 divide-y border-y" : "grid gap-2 sm:grid-cols-2 lg:grid-cols-3"}>
              {centers.map((center) => (
                <label key={center.slug} className={view === "list"
                  ? "flex cursor-pointer items-center gap-3 px-5 py-2.5 text-sm transition-colors hover:bg-muted/50 has-[:checked]:bg-primary/5"
                  : "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5"}>
                  <input type="checkbox" name="pick" value={center.slug} defaultChecked={selected.includes(center.slug)} className="size-4 accent-[var(--primary)]" />
                  {view === "list" ? (
                    <span className="flex min-w-0 flex-1 items-center justify-between gap-3"><span className="truncate font-medium">{center.name}</span><span className="shrink-0 text-xs text-muted-foreground">{center.city} · {center.branches.length} {center.branches.length === 1 ? "branch" : "branches"}</span></span>
                  ) : (
                    <span className="grid min-w-0"><span className="truncate font-medium">{center.name}</span><span className="text-xs text-muted-foreground">{center.city}</span></span>
                  )}
                </label>
              ))}
            </fieldset>
            {pickedElsewhere.map((slug) => <input key={slug} type="hidden" name="pick" value={slug} />)}
            {view === "list" ? <input type="hidden" name="view" value="list" /> : null}
            {total > paging.pageSize ? <Pagination pathname="/centers/compare" params={query} page={paging.page} pageSize={paging.pageSize} total={total} noun="centers" label="Center pages" /> : null}
            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" className={buttonVariants()}>Compare</button>
              {selected.length ? <Link href="/centers/compare" className="text-sm text-muted-foreground hover:text-foreground">Clear</Link> : null}
            </div>
          </form>
          {compared.length === 0 ? (
            <p className="rounded-xl border border-dashed bg-card/60 p-8 text-center text-sm text-muted-foreground">Choose at least one center above, then tap Compare.</p>
          ) : (
            <>
              {/* Phones: one card per center. */}
              <ul className="grid gap-4 md:hidden" aria-label="Comparison">
                {compared.map((row) => (
                  <li key={row.center.slug} className="grid gap-4 rounded-2xl border bg-card p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="font-display text-xl tracking-tight">{row.center.name}</h2>
                      {row.samplePricePaise === cheapest && compared.length > 1 ? <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">Lowest price</span> : null}
                    </div>
                    <dl className="grid gap-2.5 text-sm">
                      {ROWS.map((item) => (
                        <div key={item.label} className="flex items-center justify-between gap-3 border-b pb-2.5 last:border-0 last:pb-0">
                          <dt className="flex items-center gap-2 text-muted-foreground"><item.icon className="size-4" aria-hidden />{item.label}</dt>
                          <dd className="text-right">{item.value(row)}</dd>
                        </div>
                      ))}
                    </dl>
                    <Link className={buttonVariants({ variant: "outline" })} href={`/centers/${row.center.slug}`}>View {row.center.name}</Link>
                  </li>
                ))}
              </ul>
              {/* Larger screens: centers side by side. */}
              <div className="hidden overflow-x-auto rounded-2xl border bg-card shadow-sm md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th scope="col" className="w-44 p-4 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase">Compare</th>
                      {compared.map((row) => (
                        <th key={row.center.slug} scope="col" className="p-4 text-left align-bottom">
                          {row.samplePricePaise === cheapest && compared.length > 1 ? <span className="mb-1 inline-block rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">Lowest price</span> : null}
                          <span className="block font-display text-lg tracking-tight">{row.center.name}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {ROWS.map((item) => (
                      <tr key={item.label} className="hover:bg-muted/30">
                        <th scope="row" className="p-4 text-left font-normal text-muted-foreground"><span className="inline-flex items-center gap-2"><item.icon className="size-4" aria-hidden />{item.label}</span></th>
                        {compared.map((row) => <td key={row.center.slug} className="p-4">{item.value(row)}</td>)}
                      </tr>
                    ))}
                    <tr>
                      <td />
                      {compared.map((row) => (
                        <td key={row.center.slug} className="p-4"><Link className={cn(buttonVariants({ variant: "outline", size: "sm" }))} href={`/centers/${row.center.slug}`}>View center</Link></td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
