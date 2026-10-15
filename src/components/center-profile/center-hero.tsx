import Image from "next/image";
import { BadgeCheck, CalendarCheck, Clock, Home, Mail, MapPin, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { formatClock, initials, mapsUrl, safeColor, summarize, type CenterProfile } from "./utils";

export function CenterHero({ center }: { center: CenterProfile }) {
  const brand = safeColor(center.brandColor, "#0F766E");
  const homeCollection = center.branches.some((branch) => branch.homeCollection);
  const opens = center.branches.map((branch) => branch.opensAt).sort()[0];
  const closes = center.branches.map((branch) => branch.closesAt).sort().at(-1);
  const cover = center.coverImageUrl?.trim();
  return (
    <section className="relative isolate overflow-hidden border-b">
      {cover ? (
        <>
          <div aria-hidden className="absolute inset-0 -z-20">
            <Image src={cover} alt="" fill className="object-cover" priority sizes="100vw" />
          </div>
          <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-background/95 via-background/88 to-background/75" />
        </>
      ) : (
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            backgroundImage: `radial-gradient(60rem 28rem at 85% -10%, color-mix(in oklch, ${brand} 22%, transparent), transparent 70%), radial-gradient(40rem 24rem at 0% 110%, color-mix(in oklch, ${brand} 12%, transparent), transparent 70%)`,
          }}
        />
      )}
      <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-1" style={{ backgroundColor: brand }} />
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:py-16 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="grid gap-6">
          <div className="flex items-center gap-4">
            {center.logoUrl ? (
              // Owner-supplied https logos stay outside the image optimizer.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={center.logoUrl} alt={`${center.name} logo`} className="size-16 rounded-2xl border bg-card object-contain p-1.5 shadow-sm sm:size-20" />
            ) : (
              <div aria-hidden className="grid size-16 place-items-center rounded-2xl font-display text-2xl text-white shadow-sm sm:size-20 sm:text-3xl" style={{ backgroundColor: brand }}>
                {initials(center.name)}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="h-6 gap-1 px-2.5"><BadgeCheck aria-hidden />Verified on MediScan</Badge>
              <Badge variant="outline" className="h-6 bg-background/70 px-2.5">Accepting bookings</Badge>
              {homeCollection ? <Badge variant="secondary" className="h-6 gap-1 px-2.5"><Home aria-hidden />Home collection</Badge> : null}
            </div>
          </div>

          <div className="grid gap-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.16em] text-primary uppercase">
              <MapPin className="size-3.5" aria-hidden />
              {center.city}, {center.state}
            </p>
            <h1 className="font-display text-4xl tracking-tight text-balance sm:text-5xl">{center.name}</h1>
            <p className="max-w-2xl text-base text-muted-foreground text-pretty sm:text-lg">{summarize(center.about, 200)}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a href="#book" className={cn(buttonVariants({ size: "lg" }), "h-11 gap-2 px-5 text-base")}>
              <CalendarCheck aria-hidden />Book a visit
            </a>
            <a href="#services" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 bg-background/70 px-5 text-base")}>
              Browse tests &amp; packages
            </a>
          </div>
        </div>

        <aside aria-label="Quick contact" className="grid gap-3 rounded-2xl border bg-card/90 p-5 text-sm shadow-sm backdrop-blur lg:w-80">
          <p className="font-display text-lg">Reach {center.name}</p>
          <a href={`tel:${center.phone}`} className="flex items-center gap-3 rounded-lg p-1 hover:text-primary">
            <Phone className="size-4 text-primary" aria-hidden />{center.phone}
          </a>
          <a href={`mailto:${center.email}`} className="flex items-center gap-3 rounded-lg p-1 break-all hover:text-primary">
            <Mail className="size-4 shrink-0 text-primary" aria-hidden />{center.email}
          </a>
          {opens && closes ? (
            <p className="flex items-center gap-3 p-1">
              <Clock className="size-4 shrink-0 text-primary" aria-hidden />
              Open {formatClock(opens)} – {formatClock(closes)}
            </p>
          ) : null}
          <a href={mapsUrl({ address: center.address, city: center.city, state: center.state })} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 rounded-lg p-1 hover:text-primary">
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <span>{center.address}<span className="block text-xs text-muted-foreground">Open in Google Maps</span></span>
          </a>
        </aside>
      </div>
    </section>
  );
}
