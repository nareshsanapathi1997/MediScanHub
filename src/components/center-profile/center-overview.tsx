import { Building2, FlaskConical, Home, LockKeyhole, PackageCheck, ScanLine, ShieldCheck, Timer, type LucideIcon } from "lucide-react";
import { SectionHeading } from "./section-heading";
import { formatClock, type CenterProfile } from "./utils";

export function CenterStats({ center }: { center: CenterProfile }) {
  const homeBranches = center.branches.filter((branch) => branch.homeCollection).length;
  const stats: { icon: LucideIcon; value: string; label: string }[] = [
    { icon: Building2, value: String(center.branches.length), label: center.branches.length === 1 ? "Branch" : "Branches" },
    { icon: FlaskConical, value: String(center.services.length), label: center.services.length === 1 ? "Test or scan" : "Tests & scans" },
    { icon: PackageCheck, value: String(center.packages.length), label: center.packages.length === 1 ? "Health package" : "Health packages" },
    homeBranches > 0
      ? { icon: Home, value: String(homeBranches), label: homeBranches === 1 ? "Home collection branch" : "Home collection branches" }
      : { icon: Timer, value: formatClock(center.branches[0]?.opensAt ?? "07:00"), label: "Opens daily from" },
  ];
  return (
    <section aria-label="Center at a glance" className="mx-auto mt-8 w-full max-w-6xl px-4">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border shadow-sm md:grid-cols-4">
        {stats.map(({ icon: Icon, value, label }) => (
          <div key={label} className="flex items-center gap-3 bg-card p-4 sm:p-5">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground"><Icon className="size-5" aria-hidden /></span>
            <div>
              <dd className="font-display text-2xl leading-none">{value}</dd>
              <dt className="mt-1 text-xs text-muted-foreground">{label}</dt>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function CenterAbout({ center }: { center: CenterProfile }) {
  const paragraphs = center.about.split(/\r?\n\s*\r?\n/).map((item) => item.trim()).filter(Boolean);
  const labServices = center.services.filter((service) => service.kind === "LAB").length;
  const imagingServices = center.services.filter((service) => service.kind === "IMAGING").length;
  const cities = [...new Set(center.branches.map((branch) => branch.city))];
  const facts = [
    { label: "Registered as", value: center.legalName },
    { label: "Headquarters", value: `${center.city}, ${center.state}` },
    { label: "Serving", value: cities.join(", ") || center.city },
    { label: "Offers", value: [labServices ? `${labServices} lab test${labServices === 1 ? "" : "s"}` : null, imagingServices ? `${imagingServices} imaging scan${imagingServices === 1 ? "" : "s"}` : null].filter(Boolean).join(" · ") || "Catalog coming soon" },
    ...(center.gstin ? [{ label: "GSTIN", value: center.gstin }] : []),
  ];
  return (
    <section id="about" className="mx-auto grid w-full max-w-6xl scroll-mt-24 gap-8 px-4 lg:grid-cols-[3fr_2fr]">
      <div className="grid content-start gap-4">
        <SectionHeading eyebrow="About" title={`About ${center.name}`} />
        <div className="grid gap-3 text-muted-foreground">
          {paragraphs.map((text, index) => <p key={index} className={index === 0 ? "text-base text-foreground/90 sm:text-lg" : undefined}>{text}</p>)}
        </div>
      </div>
      <dl className="grid content-start gap-4 rounded-2xl border bg-card p-5 text-sm">
        <h3 className="font-display text-lg">Center details</h3>
        {facts.map((fact) => (
          <div key={fact.label} className="grid gap-0.5 border-t pt-3 first-of-type:border-t-0 first-of-type:pt-0">
            <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

const TRUST: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: ShieldCheck, title: "Verified center", body: "Every center on MediScan is reviewed by our team before it can accept bookings." },
  { icon: LockKeyhole, title: "Secure digital reports", body: "Reports are delivered to your private MediScan account and shared only with your consent." },
  { icon: ScanLine, title: "Transparent pricing", body: "Prices and discounts are shown up front per branch. You see the total before you pay." },
  { icon: Timer, title: "Real-time slots", body: "Choose from live availability at your preferred branch and book in a few clicks." },
];

export function WhyChoose({ centerName }: { centerName: string }) {
  return (
    <section aria-labelledby="why-title" className="mx-auto w-full max-w-6xl px-4">
      <div className="grid gap-6 rounded-3xl border bg-gradient-to-br from-accent/60 via-card to-card p-6 sm:p-8">
        <SectionHeading eyebrow="Why book here" title={`Why choose ${centerName} on MediScan`} id="why-title" />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST.map(({ icon: Icon, title, body }) => (
            <li key={title} className="grid content-start gap-2">
              <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground"><Icon className="size-5" aria-hidden /></span>
              <h3 className="font-medium">{title}</h3>
              <p className="text-sm text-muted-foreground">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
