import { Mail, MapPin, Phone, type LucideIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { formatPhone, fullAddress, mapsUrl, type CenterProfile } from "./utils";

export function ContactStrip({ center }: { center: CenterProfile }) {
  const items: { icon: LucideIcon; label: string; value: string; href: string; external?: boolean }[] = [
    { icon: Phone, label: "Call us", value: formatPhone(center.phone), href: `tel:${center.phone}` },
    { icon: Mail, label: "Email", value: center.email, href: `mailto:${center.email}` },
    { icon: MapPin, label: "Head office", value: fullAddress(center), href: mapsUrl(center), external: true },
  ];
  return (
    <section id="contact" aria-labelledby="contact-title" className="mx-auto w-full max-w-6xl scroll-mt-24 px-4">
      <div className="home-cta relative grid gap-6 overflow-hidden rounded-3xl border p-6 sm:p-8 lg:grid-cols-[1fr_2fr] lg:items-center">
        <div className="home-cta-glow absolute inset-0" aria-hidden />
        <div className="relative grid gap-3">
          <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">Contact</p>
          <h2 id="contact-title" className="font-display text-2xl tracking-tight text-balance sm:text-3xl">Questions before you book?</h2>
          <p className="text-[15px] leading-relaxed text-muted-foreground">The {center.name} team can help with test preparation, reports and home collection.</p>
          <a href="#services" className={cn(buttonVariants(), "mt-1 h-10 w-fit px-4")}>Book a test or scan</a>
        </div>
        <ul className="relative grid gap-3 sm:grid-cols-3">
          {items.map(({ icon: Icon, label, value, href, external }) => (
            <li key={label}>
              <a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="grid h-full content-start gap-2 rounded-2xl border bg-card/90 p-4 text-sm transition-shadow hover:shadow-md">
                <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4" aria-hidden /></span>
                <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
                <span className="break-words">{value}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
