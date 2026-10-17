import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  FileText,
  Home,
  MapPin,
  Search,
  ShieldCheck,
  Syringe,
  Wallet,
} from "lucide-react";
import { listCentersPage, listPublicPackages, searchServices } from "@/lib/services/catalog";
import { buttonVariants } from "@/components/ui/button";
import { CenterCard, FaqList, MoreLink, PackageCard, SectionTitle, TestCard } from "@/components/marketing/cards";
import { HomeHero } from "@/components/marketing/home-hero";
import { cn } from "cn";

const faqs: Array<[string, string]> = [
  [
    "How do I book a test?",
    "Search by test name and city (Hyderabad, Bengaluru, and more), compare lab prices, pick a center and slot, give consent, and pay online via UPI or card. You get a booking code by SMS, email, and WhatsApp.",
  ],
  [
    "Will my results come on WhatsApp?",
    "No. WhatsApp is only for booking alerts and reminders. We send a secure link—you sign in to view and download your report. Results are never shared in chat.",
  ],
  [
    "When will my report be ready?",
    "Most pathology tests (CBC, LFT, KFT, thyroid profile, HbA1c) are ready within 24 hours. X-ray and ultrasound usually take about a day; CT and MRI typically 1–2 days after the scan.",
  ],
  [
    "Can someone collect the sample at home?",
    "Yes, where the center offers home collection. Choose “At home,” enter your address and pincode, and a trained phlebotomist visits your doorstep.",
  ],
  [
    "Is the report a diagnosis?",
    "No. The report shows your values against the reference range. Please share it with your doctor. Every report is checked by a pathologist or radiologist before release.",
  ],
];

const STEPS = [
  {
    icon: Search,
    title: "Find your test",
    body: "Search CBC, thyroid, MRI, or a full body package and compare prices across labs in your city.",
  },
  {
    icon: CalendarCheck,
    title: "Book and pay",
    body: "Pick a center slot or home collection, then pay online with UPI or card.",
  },
  {
    icon: Syringe,
    title: "Give your sample",
    body: "Visit the lab, or a phlebotomist collects at your pincode when home collection is available.",
  },
  {
    icon: FileText,
    title: "Get your report",
    body: "Download the pathologist- or radiologist-signed report from My reports—never via WhatsApp chat.",
  },
];

const PATHWAYS = [
  {
    image: "/marketing/path-lab.jpg",
    imageAlt: "Pathology lab sample tubes on a diagnostic bench",
    imageClassName: "object-[center_58%]",
    label: "Blood tests / Pathology",
    body: "CBC, LFT, KFT, thyroid profile, HbA1c, and more from nearby diagnostic labs.",
    href: "/tests?kind=LAB",
  },
  {
    image: "/marketing/path-imaging.jpg",
    imageAlt: "MRI scanner in a diagnostic imaging room",
    imageClassName: "object-[center_42%]",
    label: "Scans / Imaging",
    body: "Book X-ray, ultrasound (USG), CT, and MRI with timed slots at reviewed centers.",
    href: "/imaging",
  },
  {
    image: "/marketing/path-checkup.jpg",
    imageAlt: "Full body checkup kit with stethoscope and blood pressure cuff",
    imageClassName: "object-[center_62%]",
    label: "Full body checkup packages",
    body: "Yearly and preventive panels—blood work plus key scans—at a clear package price.",
    href: "/packages",
  },
  {
    image: "/marketing/path-home.jpg",
    imageAlt: "Phlebotomist preparing home blood sample collection",
    imageClassName: "object-top",
    label: "Home sample collection",
    body: "Enter your pincode; a trained phlebotomist visits when the center offers home collection.",
    href: "/home-collection",
  },
];

const QUICK_TESTS: Array<{ label: string; href: string }> = [
  { label: "CBC", href: "/tests?q=CBC" },
  { label: "Thyroid profile", href: "/tests?q=Thyroid" },
  { label: "HbA1c", href: "/tests?q=HbA1c" },
  { label: "LFT", href: "/tests?q=LFT" },
  { label: "KFT", href: "/tests?q=KFT" },
  { label: "Lipid profile", href: "/tests?q=Lipid" },
  { label: "Vitamin D", href: "/tests?q=Vitamin+D" },
  { label: "Ultrasound", href: "/imaging?q=Ultrasound" },
  { label: "X-ray", href: "/imaging?q=X-ray" },
  { label: "MRI", href: "/imaging?q=MRI" },
];

const CITIES = ["Hyderabad", "Bengaluru", "Chennai", "Mumbai", "Pune", "Delhi NCR"];

export default async function HomePage() {
  const [{ items: centers, total: centerTotal }, tests, packages] = await Promise.all([
    listCentersPage(undefined, { skip: 0, take: 6 }),
    searchServices({}, 24),
    listPublicPackages(3),
  ]);
  const popular = [...new Map(tests.map((test) => [test.name, test])).values()].slice(0, 6);

  return (
    <main>
      <HomeHero />

      <section className="home-band border-b" aria-label="Why MediScan">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:py-7">
          <p className="home-reveal max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            Compare lab prices in Hyderabad, Bengaluru, and other cities. Pay online with UPI, get WhatsApp booking alerts (not results), and download pathologist- or radiologist-signed reports.
          </p>
          <ul className="home-reveal home-reveal-delay flex flex-wrap gap-x-6 gap-y-2.5 text-sm font-medium">
            <li className="inline-flex items-center gap-2"><ShieldCheck className="size-4 text-primary" aria-hidden />Reviewed centers</li>
            <li className="inline-flex items-center gap-2"><Wallet className="size-4 text-primary" aria-hidden />UPI &amp; online pay</li>
            <li className="inline-flex items-center gap-2"><FileText className="size-4 text-primary" aria-hidden />Doctor-signed reports</li>
            <li className="inline-flex items-center gap-2"><Home className="size-4 text-primary" aria-hidden />Pincode home collection</li>
          </ul>
        </div>
      </section>

      <section className="border-b" aria-label="Popular tests and cities">
        <div className="mx-auto grid max-w-6xl gap-3 px-4 py-5 sm:gap-3.5 sm:py-6">
          <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Popular tests</p>
          <nav className="flex flex-wrap items-baseline gap-x-1 gap-y-1 text-sm" aria-label="Popular Indian tests">
            {QUICK_TESTS.map((item, index) => (
              <span key={item.href} className="inline-flex items-baseline">
                {index > 0 ? <span className="mx-2 text-border" aria-hidden>·</span> : null}
                <Link href={item.href} className="font-medium text-foreground underline-offset-4 hover:text-primary hover:underline">
                  {item.label}
                </Link>
              </span>
            ))}
          </nav>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
              <MapPin className="size-3.5 text-primary" aria-hidden />
              Cities served
            </span>
            {CITIES.map((city) => (
              <Link key={city} href={`/centers?city=${encodeURIComponent(city)}`} className="hover:text-primary hover:underline">
                {city}
              </Link>
            ))}
          </p>
        </div>
      </section>

      <div className="home-canvas">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-10 sm:gap-14 sm:py-12">
          <section className="grid gap-6" aria-labelledby="browse">
            <SectionTitle
              id="browse"
              eyebrow="Start here"
              title="What do you need today?"
              description="Pathology, imaging, full body checkups, or home sample collection—compare prices, then book with UPI."
            />
            <ul className="grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2 lg:grid-cols-4">
              {PATHWAYS.map(({ image, imageAlt, imageClassName, label, body, href }, index) => (
                <li key={href} className="home-reveal bg-card" style={{ animationDelay: `${index * 70}ms` }}>
                  <Link
                    href={href}
                    className="group grid h-full content-start gap-4 transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none"
                  >
                    <span className="relative aspect-[16/9] overflow-hidden bg-muted">
                      <Image
                        src={image}
                        alt={imageAlt}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        className={cn(
                          "object-cover transition-transform duration-500 group-hover:scale-[1.03]",
                          imageClassName,
                        )}
                      />
                    </span>
                    <span className="grid gap-2 px-5 pb-5 sm:px-6 sm:pb-6">
                      <span className="flex items-start justify-between gap-3 font-display text-lg leading-snug tracking-tight sm:text-xl">
                        {label}
                        <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-300 group-hover:translate-x-1 group-hover:text-primary" aria-hidden />
                      </span>
                      <span className="text-sm leading-relaxed text-muted-foreground">{body}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="home-feature grid overflow-hidden rounded-2xl border lg:grid-cols-[1.05fr_0.95fr]" aria-labelledby="home-collection">
            <div className="grid content-center gap-4 p-6 sm:p-8 lg:p-9">
              <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">Home collection</p>
              <h2 id="home-collection" className="font-display text-2xl tracking-tight text-balance sm:text-3xl">
                Phlebotomist at your doorstep
              </h2>
              <p className="max-w-md text-[15px] leading-relaxed text-muted-foreground">
                Enter your pincode while booking. Where the lab supports home collection, a trained phlebotomist visits your address—ideal for fasting blood work like LFT, KFT, and lipid profile.
              </p>
              <Link href="/home-collection" className={cn(buttonVariants({ size: "lg" }), "mt-1 w-fit gap-2")}>
                Check home collection
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
            <div className="relative min-h-56 bg-muted sm:min-h-72 lg:min-h-[22rem]">
              <Image
                src="/marketing/feature-home.jpg"
                alt="Home visit phlebotomist with a medical kit"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover object-top"
              />
            </div>
          </section>

          <section className="home-steps grid gap-7" aria-labelledby="how">
            <SectionTitle id="how" eyebrow="How it works" title="From booking to report in four steps" />
            <ol className="relative grid gap-7 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
              <div className="home-steps-line pointer-events-none absolute top-[1.35rem] right-0 left-0 hidden h-px bg-border lg:block" aria-hidden />
              {STEPS.map(({ icon: Icon, title, body }, index) => (
                <li key={title} className="home-reveal relative grid content-start gap-3" style={{ animationDelay: `${index * 90}ms` }}>
                  <span className="relative z-10 flex size-10 items-center justify-center rounded-full border bg-card text-primary shadow-[0_0_0_6px_var(--background)]">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <div className="grid gap-1.5">
                    <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Step {index + 1}</p>
                    <h3 className="font-display text-lg tracking-tight sm:text-xl">{title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="grid gap-5" aria-labelledby="popular">
            <SectionTitle id="popular" eyebrow="Popular" title="Popular tests and scans" description="Demo catalog with synthetic prices—compare labs and book a slot." action={<MoreLink href="/tests">See all tests</MoreLink>} />
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {popular.map((test) => <TestCard key={test.id} test={test} />)}
            </div>
          </section>

          {packages.length ? (
            <section className="grid gap-5" aria-labelledby="packages">
              <SectionTitle
                id="packages"
                eyebrow="Checkups"
                title="Full body checkup packages"
                description="Preventive panels common in Indian cities—blood work and key markers at one package price."
                action={<MoreLink href="/packages">All packages</MoreLink>}
              />
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {packages.slice(0, 3).map((pkg) => <PackageCard key={pkg.id} pkg={pkg} />)}
              </div>
            </section>
          ) : null}

          <section className="grid gap-5" aria-labelledby="centers">
            <SectionTitle
              id="centers"
              eyebrow="Centers"
              title="Diagnostic centers on MediScan"
              description={`${centerTotal} ${centerTotal === 1 ? "center" : "centers"} across demo cities · book tests and scans online.`}
              action={<MoreLink href="/centers">All centers</MoreLink>}
            />
            <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {centers.map((center) => <CenterCard key={center.id} center={center} />)}
            </div>
          </section>

          <section className="home-feature grid overflow-hidden rounded-2xl border lg:grid-cols-[0.95fr_1.05fr]" aria-labelledby="for-centers">
            <div className="relative order-2 min-h-56 bg-muted sm:min-h-72 lg:order-1 lg:min-h-[22rem]">
              <Image
                src="/marketing/feature-center.jpg"
                alt="Modern diagnostic center reception area"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover object-[center_40%]"
              />
            </div>
            <div className="home-cta relative order-1 grid content-center gap-4 overflow-hidden p-6 sm:p-8 lg:order-2 lg:p-9">
              <div className="home-cta-glow absolute inset-0" aria-hidden />
              <div className="relative grid max-w-lg gap-4">
                <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">For diagnostic centers</p>
                <h2 id="for-centers" className="font-display text-2xl tracking-tight text-balance sm:text-3xl">
                  List your lab, publish prices, release signed reports
                </h2>
                <p className="text-[15px] leading-relaxed text-muted-foreground">
                  Run branches, catalog, slots, and home collection from one desk. Patients book online; you release doctor-signed reports securely.
                </p>
                <Link href="/onboarding" className={cn(buttonVariants({ size: "lg" }), "mt-1 w-fit gap-2")}>
                  List your center
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </div>
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-[0.85fr_1.4fr] lg:items-start lg:gap-10" aria-labelledby="faq">
            <SectionTitle
              id="faq"
              eyebrow="FAQ"
              title="Common questions"
              description="Still have a question? Write to us from the Contact page."
            />
            <FaqList items={faqs} />
          </section>
        </div>
      </div>
    </main>
  );
}
