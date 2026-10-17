import Link from "next/link";
import { listPublicPackagesPage } from "@/lib/services/catalog";
import { Pagination } from "@/components/pagination";
import { fetchPage, parsePage } from "@/lib/pagination";
import { EmptyResults, PackageCard, PackageList } from "@/components/marketing/cards";
import { ViewToggle } from "@/components/view-toggle";
import { resolveView, viewHrefs } from "@/lib/view-mode";
import { PageHero } from "@/components/marketing/page-hero";

export const metadata = { title: "Packages" };

export default async function PackagesPage({ searchParams }: { searchParams: Promise<{ view?: string; page?: string }> }) {
  const params = await searchParams;
  const [{ items: packages, total, args: paging }, view] = await Promise.all([fetchPage(parsePage(params), listPublicPackagesPage), resolveView("packages", params.view)]);
  return (
    <main>
      <PageHero
        eyebrow="Health checkups"
        title="Health checkup packages"
        description="Packages group common tests at one price. Good for a yearly full body checkup or diabetes follow-up."
        pageKey="packages"
        imageAlt="Full body checkup kit with stethoscope and blood pressure cuff"
      />
      <div className="home-canvas">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:py-10">
          {packages.length === 0 ? (
            <EmptyResults title="No packages yet" body="Centers have not published packages yet. You can still book single tests." action={<Link href="/tests" className="text-sm font-medium text-primary hover:underline">Find a test</Link>} />
          ) : (
            <div className="grid gap-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground" role="status">{total} {total === 1 ? "package" : "packages"}</p>
                <ViewToggle page="packages" view={view} hrefs={viewHrefs("/packages", params)} />
              </div>
              {view === "list" ? <PackageList packages={packages} /> : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {packages.map((pkg) => <PackageCard key={pkg.id} pkg={pkg} />)}
                </div>
              )}
              <Pagination pathname="/packages" params={params} page={paging.page} pageSize={paging.pageSize} total={total} noun={total === 1 ? "package" : "packages"} label="Package pages" />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
