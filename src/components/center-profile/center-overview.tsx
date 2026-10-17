import { SectionHeading } from "./section-heading";
import type { CenterProfile } from "./utils";

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
    <section id="about" className="mx-auto grid w-full max-w-6xl scroll-mt-24 gap-7 px-4 lg:grid-cols-[3fr_2fr] lg:gap-10">
      <div className="grid content-start gap-4">
        <SectionHeading eyebrow="About" title={`About ${center.name}`} />
        <div className="grid gap-3 text-[15px] leading-relaxed text-muted-foreground">
          {paragraphs.map((text, index) => <p key={index} className={index === 0 ? "text-base text-foreground/90 sm:text-lg sm:leading-relaxed" : undefined}>{text}</p>)}
        </div>
      </div>
      <dl className="grid content-start gap-4 rounded-2xl border bg-card/95 p-5 text-sm shadow-sm">
        <h3 className="font-display text-lg tracking-tight">Center details</h3>
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

