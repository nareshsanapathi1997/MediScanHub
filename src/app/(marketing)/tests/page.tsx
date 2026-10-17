import Link from "next/link";
import { FlaskConical, ScanLine, Search } from "lucide-react";
import { searchServicesPage } from "@/lib/services/catalog";
import { Pagination } from "@/components/pagination";
import { fetchPage, parsePage } from "@/lib/pagination";
import { Button } from "@/components/ui/button";
import { EmptyResults, TestCard, TestList } from "@/components/marketing/cards";
import { PageHero } from "@/components/marketing/page-hero";
import { ViewToggle } from "@/components/view-toggle";
import { resolveView, viewHrefs } from "@/lib/view-mode";
import { cn } from "cn";

export const metadata = { title: "Tests" };

export default async function TestsPage({ searchParams }: { searchParams: Promise<{ q?: string; city?: string; kind?: string; view?: string; page?: string }> }) {
  const params = await searchParams;
  const kind = params.kind === "IMAGING" || params.kind === "LAB" ? params.kind : undefined;
  const [{ items: tests, total, args: paging }, view] = await Promise.all([
    fetchPage(parsePage(params), (args) => searchServicesPage({ query: params.q, city: params.city, kind }, args)),
    resolveView("tests", params.view),
  ]);
  const tab = (value: "LAB" | "IMAGING" | undefined) => {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.city) query.set("city", params.city);
    if (value) query.set("kind", value);
    const text = query.toString();
    return `/tests${text ? `?${text}` : ""}`;
  };
  const filtered = Boolean(params.q || params.city);
  return (
    <main>
      <PageHero
        eyebrow="Tests and scans"
        title="Find a test"
        description="Search by name, like CBC, thyroid profile, HbA1c, X-ray or MRI. Prices are in rupees and include the center's discount."
        pageKey="tests"
        imageAlt="Pathology sample tubes on a diagnostic lab bench"
      />
      <div className="home-canvas">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:py-10">
          <form role="search" className="grid gap-3 rounded-2xl border bg-card/90 p-3 shadow-sm sm:grid-cols-[1.4fr_1fr_auto] sm:p-4">
            {kind ? <input type="hidden" name="kind" value={kind} /> : null}
            <label className="grid gap-1 text-sm font-medium">Test or scan name<input name="q" defaultValue={params.q} placeholder="e.g. thyroid" className="h-11 rounded-lg border bg-background px-3 font-normal" /></label>
            <label className="grid gap-1 text-sm font-medium">City<input name="city" defaultValue={params.city} placeholder="e.g. Hyderabad" className="h-11 rounded-lg border bg-background px-3 font-normal" /></label>
            <Button type="submit" className="h-11 gap-2 self-end px-5"><Search aria-hidden />Search</Button>
          </form>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <nav aria-label="Type" className="flex gap-1 rounded-xl bg-muted p-1 text-sm">
              {([[undefined, "All", null], ["LAB", "Lab tests", FlaskConical], ["IMAGING", "Scans", ScanLine]] as const).map(([value, label, Icon]) => (
                <Link key={label} href={tab(value)} aria-current={kind === value ? "true" : undefined} className={cn("inline-flex h-9 items-center gap-1.5 rounded-lg px-3 font-medium transition-colors", kind === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                  {Icon ? <Icon className="size-4" aria-hidden /> : null}{label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-3">
              <p className="text-sm text-muted-foreground" role="status">{total} {total === 1 ? "result" : "results"}{filtered ? <> · <Link href={tab(kind)} className="font-medium text-primary hover:underline">Clear search</Link></> : null}</p>
              <ViewToggle page="tests" view={view} hrefs={viewHrefs("/tests", params)} />
            </div>
          </div>
          {tests.length === 0 ? (
            <EmptyResults title="No test found" body="Check the spelling or try a shorter name, like “thyroid” or “sugar”. You can also clear the city." action={<Link href="/tests" className="text-sm font-medium text-primary hover:underline">Show all tests</Link>} />
          ) : view === "list" ? (
            <TestList tests={tests} />
          ) : (
            <div className="grid gap-3">
              {tests.map((test) => <TestCard key={test.id} test={test} layout="row" showPrep />)}
            </div>
          )}
          <Pagination pathname="/tests" params={params} page={paging.page} pageSize={paging.pageSize} total={total} noun={total === 1 ? "result" : "results"} label="Test pages" />
        </div>
      </div>
    </main>
  );
}
