import Image from "next/image";
import { BadgeCheck, CalendarCheck, Clock, FlaskConical, Home, ImageOff, Mail, MapPin, Navigation, Phone, ScanLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { todayRange } from "@/lib/hours";
import { centerCoverSrc, imageObjectPosition } from "@/lib/center-marketing";
import { formatClock, formatPhone, fullAddress, initials, mapsUrl, openStatus, safeColor, summarize, type CenterProfile } from "./utils";

const approvedFormat = new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

/** Cover banner on top, identity and quick facts underneath, so cover artwork never sits behind text. */
export function CenterHero({ center }: { center: CenterProfile }) {
  const brand = safeColor(center.brandColor, "#0F766E");
  const homeCollection = center.branches.some((branch) => branch.homeCollection);
  const today = todayRange(center.branches);
  const status = openStatus(center.branches);
  const hasLab = center.services.some((service) => service.kind === "LAB");
  const hasScans = center.services.some((service) => service.kind === "IMAGING");
  const cover = centerCoverSrc(center);
  return (
    <section className="relative border-b">
      <div aria-hidden className="center-hero-cover relative overflow-hidden bg-[#0b3d3a]">
        {cover ? (
          <>
            <Image
              src={cover}
              alt=""
              fill
              className={cn("center-hero-visual object-cover", imageObjectPosition(cover))}
              priority
              sizes="100vw"
            />
            <div className="page-hero-veil absolute inset-0 opacity-55" />
          </>
        ) : (
          <div className="absolute inset-0 grid place-items-center gap-2 bg-gradient-to-br from-[#0b3d3a] via-[#0F766E] to-[#155E75] text-teal-50/90">
            <ImageOff className="size-8 opacity-70" />
            <p className="text-sm font-medium tracking-wide">No cover photo yet</p>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
      </div>

      <div className="home-canvas">
        <div className="mx-auto grid max-w-6xl gap-7 px-4 pb-9 lg:grid-cols-[1fr_22rem] lg:gap-10 lg:pb-11">
          <div className="grid content-start gap-4">
            <div className="relative z-10 -mt-12 flex items-end gap-4 sm:-mt-14">
              {center.logoUrl ? (
                // Owner-supplied https logos stay outside the image optimizer.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={center.logoUrl} alt={`${center.name} logo`} className="size-24 rounded-3xl border-4 border-background bg-card object-contain p-2 shadow-lg sm:size-28" />
              ) : (
                <div aria-hidden className="grid size-24 place-items-center rounded-3xl border-4 border-background font-display text-3xl text-white shadow-lg sm:size-28" style={{ backgroundColor: brand }}>
                  {initials(center.name)}
                </div>
              )}
            </div>

            <div className="grid gap-2.5">
              <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">Diagnostic center · {center.city}</p>
              <h1 className="font-display text-[clamp(1.85rem,4.5vw,3rem)] leading-[1.08] tracking-tight text-balance">{center.name}</h1>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><MapPin className="size-4 text-primary" aria-hidden />{center.city}, {center.state}</span>
                <span aria-hidden className="hidden sm:inline">·</span>
                <span>{center.branches.length} {center.branches.length === 1 ? "branch" : "branches"}</span>
                <span aria-hidden className="hidden sm:inline">·</span>
                <span className={cn("flex items-center gap-1.5 font-medium", status.open ? "text-success" : "text-muted-foreground")}>
                  <span aria-hidden className={cn("size-2 rounded-full", status.open ? "bg-success" : "bg-muted-foreground/50")} />{status.label}
                </span>
              </p>
              <ul aria-label="Highlights" className="flex flex-wrap gap-2">
                {center.verifiedAt ? (
                  <li><Badge className="h-7 gap-1.5 px-3" title={`Registration documents reviewed by MediScan${center.verifiedAt.getTime() > 0 ? ` in ${approvedFormat.format(center.verifiedAt)}` : ""}`}><BadgeCheck aria-hidden />Verified by MediScan</Badge></li>
                ) : null}
                {hasLab ? <li><Badge variant="secondary" className="h-7 gap-1.5 px-3"><FlaskConical aria-hidden />Lab tests</Badge></li> : null}
                {hasScans ? <li><Badge variant="secondary" className="h-7 gap-1.5 px-3"><ScanLine aria-hidden />Scans</Badge></li> : null}
                {homeCollection ? <li><Badge variant="secondary" className="h-7 gap-1.5 px-3"><Home aria-hidden />Home sample collection</Badge></li> : null}
              </ul>
              <p className="max-w-2xl text-[15px] leading-relaxed text-muted-foreground text-pretty sm:text-base">{summarize(center.about, 220)}</p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap">
              <a href="#services" className={cn(buttonVariants({ size: "lg" }), "col-span-2 h-11 gap-2 px-5 text-base sm:col-span-1")}>
                <CalendarCheck aria-hidden />Book a test or scan
              </a>
              <a href={`tel:${center.phone}`} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 gap-2 bg-background px-5 text-base")}>
                <Phone aria-hidden />Call center
              </a>
              <a href={mapsUrl(center)} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 gap-2 bg-background px-5 text-base lg:hidden")}>
                <Navigation aria-hidden />Directions
              </a>
            </div>
          </div>

          <aside aria-label="Quick contact" className="hidden content-start gap-1 self-start rounded-2xl border bg-card/95 p-5 text-sm shadow-sm backdrop-blur-sm md:grid lg:mt-4">
            <p className="mb-2 font-display text-lg tracking-tight">Contact &amp; timings</p>
            <a href={`tel:${center.phone}`} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted">
              <Phone className="size-4 shrink-0 text-primary" aria-hidden />{formatPhone(center.phone)}
            </a>
            <a href={`mailto:${center.email}`} className="flex items-center gap-3 rounded-lg px-2 py-2 break-all hover:bg-muted">
              <Mail className="size-4 shrink-0 text-primary" aria-hidden />{center.email}
            </a>
            {center.branches.length > 0 ? (
              <p className="flex items-center gap-3 px-2 py-2">
                <Clock className="size-4 shrink-0 text-primary" aria-hidden />
                <span>{today ? `Today ${formatClock(today.opensAt)} – ${formatClock(today.closesAt)}` : "Closed today"}</span>
              </p>
            ) : null}
            <p className="flex items-start gap-3 px-2 py-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <span>{fullAddress(center)}</span>
            </p>
            <a href={mapsUrl(center)} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: "outline" }), "mt-2 h-9 gap-1.5")}>
              <Navigation aria-hidden />Get directions<span className="sr-only"> (opens Google Maps)</span>
            </a>
          </aside>
        </div>
      </div>
    </section>
  );
}
