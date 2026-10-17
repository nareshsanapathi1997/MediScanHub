import Link from "next/link";
import { MapPin } from "lucide-react";
import { listCentersPage } from "@/lib/services/catalog";
import { Pagination } from "@/components/pagination";
import { fetchPage, parsePage } from "@/lib/pagination";
import { Button } from "@/components/ui/button";
import { CenterCard, CenterList, EmptyResults } from "@/components/marketing/cards";
import { ViewToggle } from "@/components/view-toggle";
import { resolveView, viewHrefs } from "@/lib/view-mode";
import { PageHero } from "@/components/marketing/page-hero";

export const metadata = { title: "Centers" };

export default async function CentersPage({ searchParams }: { searchParams: Promise<{ city?: string; view?: string; page?: string }> }) {
  const params = await searchParams;
  const { city } = params;
  const [{ items: centers, total, args: paging }, view] = await Promise.all([fetchPage(parsePage(params), (args) => listCentersPage(city, args)), resolveView("centers", params.view)]);
  return (
    <main>
      <PageHero
        eyebrow="Centers"
        title="Diagnostic centers"
        description="Every center is reviewed by MediScan before it can take bookings. Open one to see its tests, prices, branches and open slots."
        pageKey="centers"
        imageAlt="Modern diagnostic center reception area"
        actions={<Link href="/centers/compare" className="text-sm font-medium text-teal-50 underline-offset-4 hover:underline">Compare prices</Link>}
      />
      <div className="home-canvas">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:py-10">
          <form role="search" className="flex max-w-lg gap-2">
            <label className="relative flex-1">
              <span className="sr-only">City</span>
              <MapPin className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input name="city" defaultValue={city} placeholder="City, e.g. Hyderabad" aria-label="City" className="h-11 w-full rounded-lg border bg-card pr-3 pl-9" />
            </label>
            <Button type="submit" className="h-11 px-5">Search</Button>
          </form>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground" role="status">{total} {total === 1 ? "center" : "centers"}{city ? <> in “{city}” · <Link href="/centers" className="font-medium text-primary hover:underline">Show all</Link></> : null}</p>
            <ViewToggle page="centers" view={view} hrefs={viewHrefs("/centers", params)} />
          </div>
          {centers.length === 0 ? (
            <EmptyResults title="No center in that city yet" body="Try a nearby city, or clear the search to see all centers." action={<Link href="/centers" className="text-sm font-medium text-primary hover:underline">Show all centers</Link>} />
          ) : view === "list" ? (
            <CenterList centers={centers} />
          ) : (
            <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {centers.map((center) => <CenterCard key={center.id} center={center} />)}
            </div>
          )}
          <Pagination pathname="/centers" params={params} page={paging.page} pageSize={paging.pageSize} total={total} noun={total === 1 ? "center" : "centers"} label="Center pages" />
        </div>
      </div>
    </main>
  );
}
