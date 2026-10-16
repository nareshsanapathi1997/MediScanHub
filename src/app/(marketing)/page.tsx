import Link from "next/link";
import { listCenters, listPublicPackages, searchServices } from "@/lib/services/catalog";
import { formatInr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";

const faqs = [
  ["How do I book a test?", "Search for your test and city, pick a diagnostic center and a time slot, give consent and pay online. You get a booking code by SMS, email and WhatsApp."],
  ["Will my results come on WhatsApp?", "No. We only send a secure link. You sign in to see and download your report. Your results are never sent in a message."],
  ["When will my report be ready?", "Most blood tests (CBC, LFT, KFT, thyroid profile, HbA1c) are ready in 24 hours. X-ray and ultrasound reports usually take 1 day, CT and MRI 1–2 days."],
  ["Can someone collect the sample at home?", "Yes, at centers that offer home collection. Choose “Home collection” while booking and enter your address and pincode."],
  ["Is the report a diagnosis?", "No. The report shows your values and the normal range. Please show it to your doctor. A pathologist or radiologist checks every report before it is released."],
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
            <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">Diagnostic tests and scans</p>
            <h1 className="mt-3 max-w-xl font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl">Book blood tests and scans near you</h1>
            <p className="mt-4 max-w-xl text-lg text-muted-foreground">Compare trusted diagnostic centers in your city, book a time slot or home sample collection, pay online and download your report from your phone.</p>
            <form action="/tests" className="mt-8 grid gap-3 rounded-2xl border bg-card p-4 shadow-sm sm:grid-cols-[1fr_1fr_auto]">
              <label className="grid gap-1 text-sm">City<input name="city" placeholder="Hyderabad" className="h-10 rounded-lg border px-3" /></label>
              <label className="grid gap-1 text-sm">Test<input name="q" placeholder="CBC, thyroid profile, MRI" className="h-10 rounded-lg border px-3" /></label>
              <Button type="submit" className="h-10 self-end">Search</Button>
            </form>
          </div>
          <aside className="rise grid content-end gap-3 rounded-3xl border bg-card p-6 shadow-sm" style={{ animationDelay: "120ms" }}>
            <p className="text-sm text-muted-foreground">On MediScan Hub today</p>
            <p className="font-display text-5xl">{centers.length}</p>
            <p>verified centers taking bookings</p>
            <p className="text-sm text-muted-foreground">{tests.length} tests and scans · {packages.length} health packages</p>
            <Link href="/onboarding" className={buttonVariants({ variant: "outline" })}>List your diagnostic center</Link>
          </aside>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-14">
        <h2 className="font-display text-3xl">Popular tests</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {popular.map((test) => (
            <article key={test.id} className="rounded-2xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">{test.tenant.city} · {test.category.name}</p>
              <h3 className="mt-1 font-display text-2xl">{test.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{test.description}</p>
              <p className="mt-3 text-sm">From {formatInr((test.prices[0]?.pricePaise ?? 0) - (test.prices[0]?.discountPaise ?? 0))} · Report in {test.tatHours} hours</p>
              <Link href={`/centers/${test.tenant.slug}?service=${test.id}`} className="mt-3 inline-block text-sm font-medium text-primary">Book at {test.tenant.name}</Link>
            </article>
          ))}
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-6 px-4 pb-14">
        <h2 className="font-display text-3xl">Health checkup packages</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {packages.map((pkg) => (
            <article key={pkg.id} className="rounded-2xl border bg-card p-4">
              <h3 className="font-display text-2xl">{pkg.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{pkg.description}</p>
              <p className="mt-3 text-sm">{formatInr(pkg.pricePaise)} · {pkg.items.length} tests included</p>
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
            <p className="mt-2 text-sm">{center.branches.length} {center.branches.length === 1 ? "branch" : "branches"}</p>
          </Link>
        ))}
      </section>
      <section className="mx-auto grid max-w-6xl gap-6 px-4 pb-14 md:grid-cols-4">
        {["Search your test", "Pick a slot and pay", "Give your sample", "Download your report"].map((step, index) => (
          <div key={step} className="rounded-2xl bg-secondary p-4">
            <p className="text-xs text-muted-foreground">0{index + 1}</p>
            <h3 className="mt-2 font-display text-xl">{step}</h3>
          </div>
        ))}
      </section>
      <section className="mx-auto max-w-6xl px-4 pb-14">
        <h2 className="font-display text-3xl">What people tell us</h2>
        <p className="mt-2 text-sm text-muted-foreground">Sample comments written for this demo. They are not from real patients.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {["Booked a fasting blood sugar test for my father at 7 am. No waiting at the counter.", "The phlebotomist came home on time in Kukatpally and the thyroid report came the next day.", "I got a link on WhatsApp and downloaded the ultrasound report as a PDF."].map((quote) => (
            <blockquote key={quote} className="rounded-2xl border bg-card p-4 text-sm">{quote}</blockquote>
          ))}
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <h2 className="font-display text-3xl">Common questions</h2>
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
