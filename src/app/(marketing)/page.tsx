import Link from "next/link";
import { listCenters, listPublicPackages, searchServices } from "@/lib/services/catalog";
import { formatInr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";

const faqs = [
  ["How do I book a test?", "Search by city and test, choose a center and a slot, confirm consent, then pay. The price is calculated on the server from the branch price list."],
  ["Will results arrive on WhatsApp?", "No. Messages only contain a secure link. Report values stay behind your sign-in."],
  ["Can a center run several branches?", "Yes. A center is a tenant. Staff only see the branches assigned to them, and the database enforces that boundary."],
  ["Is this a diagnosis?", "No. Reference flags compare a number with a configured range. A pathologist or radiologist releases the report."],
];

export default async function HomePage() {
  const [centers, tests, packages] = await Promise.all([
    listCenters(),
    searchServices({}),
    listPublicPackages(),
  ]);
  const popular = tests.slice(0, 6);
  return (
    <main>
      <section className="lab-grid relative overflow-hidden border-b">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-[1.2fr_0.8fr] lg:py-24">
          <div className="rise">
            <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">Diagnostic operations</p>
            <h1 className="mt-3 max-w-xl font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl">The calm desk for a busy lab.</h1>
            <p className="mt-4 max-w-xl text-lg text-muted-foreground">Search a test, hold a real slot, collect the sample, and release a report only after a named reviewer signs it. Built for centers that run more than one branch.</p>
            <form action="/tests" className="mt-8 grid gap-3 rounded-2xl border bg-card p-4 shadow-sm sm:grid-cols-[1fr_1fr_auto]">
              <label className="grid gap-1 text-sm">City<input name="city" placeholder="Hyderabad" className="h-10 rounded-lg border px-3" /></label>
              <label className="grid gap-1 text-sm">Test<input name="q" placeholder="CBC, TSH, ultrasound" className="h-10 rounded-lg border px-3" /></label>
              <Button type="submit" className="h-10 self-end">Search</Button>
            </form>
          </div>
          <aside className="rise grid content-end gap-3 rounded-3xl border bg-card p-6 shadow-sm" style={{ animationDelay: "120ms" }}>
            <p className="text-sm text-muted-foreground">Live from the directory</p>
            <p className="font-display text-5xl">{centers.length}</p>
            <p>verified centers open for booking</p>
            <p className="text-sm text-muted-foreground">{tests.length} published tests · {packages.length} packages</p>
            <Link href="/onboarding" className={buttonVariants({ variant: "outline" })}>Register a center</Link>
          </aside>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-14">
        <h2 className="font-display text-3xl">Tests people book first</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {popular.map((test) => (
            <article key={test.id} className="rounded-2xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">{test.tenant.city} · {test.category.name}</p>
              <h3 className="mt-1 font-display text-2xl">{test.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{test.description}</p>
              <p className="mt-3 text-sm">From {formatInr((test.prices[0]?.pricePaise ?? 0) - (test.prices[0]?.discountPaise ?? 0))} · {test.tatHours}h TAT</p>
              <Link href={`/centers/${test.tenant.slug}?service=${test.id}`} className="mt-3 inline-block text-sm font-medium text-primary">View {test.tenant.name}</Link>
            </article>
          ))}
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-6 px-4 pb-14">
        <h2 className="font-display text-3xl">Packages</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {packages.map((pkg) => (
            <article key={pkg.id} className="rounded-2xl border bg-card p-4">
              <h3 className="font-display text-2xl">{pkg.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{pkg.description}</p>
              <p className="mt-3 text-sm">{formatInr(pkg.pricePaise)} · {pkg.items.length} tests</p>
              <Link href={`/centers/${pkg.tenant.slug}?package=${pkg.id}`} className="mt-3 inline-block text-sm font-medium text-primary">{pkg.tenant.name}</Link>
            </article>
          ))}
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-14 md:grid-cols-3">
        {centers.map((center) => (
          <Link key={center.id} href={`/centers/${center.slug}`} className="rounded-2xl border bg-card p-4" style={{ borderTopColor: center.brandColor, borderTopWidth: 4 }}>
            <h3 className="font-display text-2xl">{center.name}</h3>
            <p className="text-sm text-muted-foreground">{center.city}, {center.state}</p>
            <p className="mt-2 text-sm">{center.branches.length} branches</p>
          </Link>
        ))}
      </section>
      <section className="mx-auto grid max-w-6xl gap-6 px-4 pb-14 md:grid-cols-4">
        {["Search a slot", "Consent and pay", "Collect and result", "Reviewer releases"].map((step, index) => (
          <div key={step} className="rounded-2xl bg-secondary p-4">
            <p className="text-xs text-muted-foreground">0{index + 1}</p>
            <h3 className="mt-2 font-display text-xl">{step}</h3>
          </div>
        ))}
      </section>
      <section className="mx-auto max-w-6xl px-4 pb-14">
        <h2 className="font-display text-3xl">Illustrative notes</h2>
        <p className="mt-2 text-sm text-muted-foreground">These are composites written for the product tour. They are not quotes from real patients.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {["The front desk stopped double-booking the 8:00 slot.", "Home collection shows up on the phlebotomist list with an address, not in a chat thread.", "The report link arrived without any numbers in the message."].map((quote) => (
            <blockquote key={quote} className="rounded-2xl border bg-card p-4 text-sm">{quote}</blockquote>
          ))}
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <h2 className="font-display text-3xl">Questions</h2>
        <div className="mt-4 grid gap-3">
          {faqs.map(([q, a]) => (
            <details key={q} className="rounded-xl border bg-card px-4 py-3">
              <summary className="cursor-pointer font-medium">{q}</summary>
              <p className="mt-2 text-sm text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
