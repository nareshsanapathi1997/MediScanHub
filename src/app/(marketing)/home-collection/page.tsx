import Link from "next/link";
import { ArrowRight, Home, MapPin, ShieldCheck, Syringe, CalendarClock } from "lucide-react";
import { listHomeCollectionBranchesPage } from "@/lib/services/catalog";
import { Pagination } from "@/components/pagination";
import { fetchPage, parsePage } from "@/lib/pagination";
import { EmptyResults } from "@/components/marketing/cards";
import { ListView } from "@/components/list-view";
import { ViewToggle } from "@/components/view-toggle";
import { resolveView, viewHrefs } from "@/lib/view-mode";
import { PageHero } from "@/components/marketing/page-hero";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";

export const metadata = { title: "Home collection" };

const STEPS = [
  { icon: Home, text: "Choose a center that offers home collection." },
  { icon: CalendarClock, text: "Pick a time slot and enter your full address with pincode." },
  { icon: Syringe, text: "A trained phlebotomist visits, collects the sample and takes it to the lab." },
];

export default async function HomeCollectionPage({ searchParams }: { searchParams: Promise<{ view?: string; page?: string }> }) {
  const params = await searchParams;
  const [{ items: branches, total, args: paging }, view] = await Promise.all([fetchPage(parsePage(params), listHomeCollectionBranchesPage), resolveView("home-collection", params.view)]);
  const collectors = branches.map(({ tenant, ...branch }) => ({ center: tenant, branch }));
  return (
    <main>
      <PageHero
        eyebrow="Home collection"
        title="Sample collection at home"
        description="A trained phlebotomist comes to your home to collect the blood or urine sample. You get a message with the visit time."
        pageKey="home-collection"
        imageAlt="Home visit phlebotomist with a medical kit at the doorstep"
      />
      <div className="home-canvas">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:gap-10 sm:py-10">
          <section className="home-feature grid overflow-hidden rounded-2xl border lg:grid-cols-[1.05fr_0.95fr]" aria-label="How home collection works">
            <div className="grid content-center gap-4 p-6 sm:p-8">
              <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">At your doorstep</p>
              <h2 className="font-display text-2xl tracking-tight text-balance sm:text-3xl">Phlebotomist at your doorstep</h2>
              <p className="max-w-md text-[15px] leading-relaxed text-muted-foreground">
                Ideal for fasting blood work like LFT, KFT, and lipid profile—enter your pincode while booking and a trained collector visits when the lab supports home collection.
              </p>
              <Link href="/tests?kind=LAB" className={cn(buttonVariants({ size: "lg" }), "mt-1 w-fit gap-2")}>
                Find a home-friendly test
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
            <div className="relative min-h-56 bg-muted sm:min-h-64 lg:min-h-[20rem]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/marketing/path-home.jpg"
                alt="Phlebotomist preparing home blood sample collection"
                width={800}
                height={600}
                className="absolute inset-0 size-full object-cover object-top"
                decoding="async"
              />
            </div>
          </section>

          <ol className="grid gap-px overflow-hidden rounded-2xl border bg-border md:grid-cols-3">
            {STEPS.map(({ icon: Icon, text }, index) => (
              <li key={text} className="flex gap-4 bg-card p-5 sm:p-6">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary"><Icon className="size-5" aria-hidden /></span>
                <div>
                  <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Step {index + 1}</p>
                  <p className="mt-1.5 text-[15px] leading-relaxed">{text}</p>
                </div>
              </li>
            ))}
          </ol>

          <p className="flex items-start gap-2 rounded-2xl border border-primary/15 bg-primary/8 px-4 py-3 text-sm text-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            Your results are never sent in a message. You get a secure link and sign in to see the report.
          </p>

          <section className="grid gap-4" aria-labelledby="where">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 id="where" className="font-display text-2xl tracking-tight sm:text-3xl">Centers that come home</h2>
              <ViewToggle page="home-collection" view={view} hrefs={viewHrefs("/home-collection", params)} />
            </div>
            {collectors.length === 0 ? <EmptyResults title="No home collection right now" body="No center offers home collection at the moment. Please book a center visit instead, or check again later." /> : view === "list" ? (
              <ListView label="Centers that come home" columns={[{ key: "center", label: "Center" }, { key: "branch", label: "Branch" }, { key: "city", label: "City" }]}
                rows={collectors.map(({ center, branch }) => ({
                  id: branch.id,
                  href: `/centers/${center.slug}`,
                  cells: { center: center.name, branch: branch.name, city: branch.city },
                  actions: <Link className="inline-flex h-8 items-center gap-1 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90" href={`/centers/${center.slug}?branch=${branch.id}&visit=HOME_COLLECTION#services`}>Book home collection<span className="sr-only"> at {center.name}, {branch.name}</span></Link>,
                }))} />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {collectors.map(({ center, branch }) => (
                  <article key={branch.id} className="flex flex-col justify-between gap-4 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center">
                    <div className="grid gap-1">
                      <h3 className="font-display text-xl">{center.name}</h3>
                      <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="size-3.5" aria-hidden />{branch.name}, {branch.city}</p>
                    </div>
                    <Link className="inline-flex h-9 w-fit items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground hover:opacity-90" href={`/centers/${center.slug}?branch=${branch.id}&visit=HOME_COLLECTION#services`}>Book home collection<ArrowRight className="size-4" aria-hidden /></Link>
                  </article>
                ))}
              </div>
            )}
            <Pagination pathname="/home-collection" params={params} page={paging.page} pageSize={paging.pageSize} total={total} noun={total === 1 ? "branch" : "branches"} label="Branch pages" />
          </section>
        </div>
      </div>
    </main>
  );
}
