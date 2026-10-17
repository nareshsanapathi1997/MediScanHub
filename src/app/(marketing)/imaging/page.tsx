import Link from "next/link";
import { CalendarClock, ClipboardCheck, FileText } from "lucide-react";
import { listScanModalities, searchServicesPage } from "@/lib/services/catalog";
import { Pagination } from "@/components/pagination";
import { fetchPage, parsePage } from "@/lib/pagination";
import { SCAN_MODALITIES, isScanModality } from "@/domain/scan-scheduling";
import { EmptyResults, TestCard, TestList } from "@/components/marketing/cards";
import { ViewToggle } from "@/components/view-toggle";
import { resolveView, viewHrefs } from "@/lib/view-mode";
import { PageHero } from "@/components/marketing/page-hero";
import { cn } from "cn";

export const metadata = { title: "Scans" };

const STEPS = [
  { icon: CalendarClock, title: "Pick a scan and a time", body: "Each scan type has its own room and time slots, so you see only real open times." },
  { icon: ClipboardCheck, title: "Follow the preparation", body: "Some scans need fasting or a full bladder. The steps are shown before you book and on your booking page." },
  { icon: FileText, title: "Get your report online", body: "A radiologist checks your scan. The report and the original scan files come to My reports." },
];

export default async function ImagingPage({ searchParams }: { searchParams: Promise<{ modality?: string; view?: string; page?: string }> }) {
  const params = await searchParams;
  const { modality } = params;
  const active = isScanModality(modality) ? modality : undefined;
  const [view, modalities, { items: shown, total, args: paging }] = await Promise.all([
    resolveView("scans", params.view),
    listScanModalities(),
    fetchPage(parsePage(params), (args) => searchServicesPage({ kind: "IMAGING", modality: active }, args)),
  ]);
  const present = Object.entries(SCAN_MODALITIES).filter(([code]) => modalities.includes(code));
  return (
    <main>
      <PageHero
        eyebrow="Scans"
        title="X-ray, ultrasound, CT and MRI"
        description="Book a scan at a center near you and see the preparation before you go."
        pageKey="imaging"
        imageAlt="MRI scanner in a diagnostic imaging room"
      />
      <div className="home-canvas">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:gap-10 sm:py-10">
          <ol className="grid gap-px overflow-hidden rounded-2xl border bg-border md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, body }, index) => (
              <li key={title} className="grid content-start gap-3 bg-card p-5 sm:p-6">
                <span className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-primary/12 text-primary"><Icon className="size-5" aria-hidden /></span>
                  <span className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Step {index + 1}</span>
                </span>
                <h2 className="font-display text-lg tracking-tight sm:text-xl">{title}</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
              </li>
            ))}
          </ol>
          <section className="grid gap-4" aria-labelledby="scans">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 id="scans" className="font-display text-2xl tracking-tight sm:text-3xl">Scans you can book</h2>
              {present.length > 1 ? (
                <nav aria-label="Scan type" className="flex flex-wrap gap-1 rounded-xl bg-muted p-1 text-sm">
                  {[[undefined, "All"] as const, ...present.map(([code, label]) => [code, label] as const)].map(([code, label]) => (
                    <Link key={label} href={code ? `/imaging?modality=${code}` : "/imaging"} aria-current={active === code ? "true" : undefined} className={cn("inline-flex h-9 items-center rounded-lg px-3 font-medium transition-colors", active === code ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{label}</Link>
                  ))}
                </nav>
              ) : null}
              <ViewToggle page="scans" view={view} hrefs={viewHrefs("/imaging", params)} />
            </div>
            {shown.length === 0 ? <EmptyResults title="No scan to book right now" body="Please check again later, or call the center." /> : view === "list" ? <TestList tests={shown} label="Scans" /> : (
              <div className="grid gap-3">{shown.map((study) => <TestCard key={study.id} test={study} layout="row" showPrep />)}</div>
            )}
            <Pagination pathname="/imaging" params={params} page={paging.page} pageSize={paging.pageSize} total={total} noun={total === 1 ? "scan" : "scans"} label="Scan pages" />
          </section>
        </div>
      </div>
    </main>
  );
}
