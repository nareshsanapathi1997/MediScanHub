import Image from "next/image";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { homeHeroImage } from "@/lib/center-marketing";
import { cn } from "cn";

/** Full-bleed home hero: brand first, one headline, one line, one search CTA. */
export function HomeHero() {
  const hero = homeHeroImage();
  return (
    <section className="home-hero relative isolate overflow-hidden border-b">
      <Image
        src={hero.url}
        alt=""
        fill
        priority
        sizes="100vw"
        className={cn("home-hero-visual object-cover", hero.position)}
      />
      <div className="home-hero-veil absolute inset-0" aria-hidden />

      <div className="relative mx-auto flex h-full max-w-6xl flex-col justify-end px-4 pb-8 pt-10 sm:pb-10 sm:pt-12 lg:pb-11">
        <div className="grid max-w-2xl gap-4 sm:gap-5">
          <p className="home-rise font-display text-[clamp(2.4rem,6.5vw,4.25rem)] leading-[0.95] tracking-tight text-white">
            MediScan
          </p>
          <div className="grid gap-2.5">
            <h1 className="home-rise home-rise-delay-1 max-w-xl font-display text-[clamp(1.45rem,3vw,2.25rem)] leading-[1.15] tracking-tight text-balance text-white/95">
              Book blood tests and scans near you
            </h1>
            <p className="home-rise home-rise-delay-2 max-w-lg text-[15px] leading-relaxed text-teal-50/88 sm:text-base">
              Compare lab prices in Hyderabad, Bengaluru, and more. Book a slot or pincode home collection, pay with UPI, and download your doctor-signed report.
            </p>
          </div>

          <form
            action="/tests"
            role="search"
            className="home-rise home-rise-delay-3 home-search grid gap-2.5 rounded-2xl border border-white/20 bg-white/12 p-2.5 backdrop-blur-md sm:grid-cols-[1fr_1fr_auto] sm:gap-2 sm:p-2"
          >
            <label className="grid gap-1 px-1 text-sm font-medium text-teal-50/95 sm:px-2">
              Test or scan
              <input
                name="q"
                placeholder="CBC, thyroid, MRI, full body"
                className="h-11 rounded-xl border-0 bg-white px-3 font-normal text-foreground shadow-none outline-none ring-0 placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-teal-200"
              />
            </label>
            <label className="grid gap-1 px-1 text-sm font-medium text-teal-50/95 sm:px-2">
              City
              <input
                name="city"
                placeholder="Hyderabad, Bengaluru…"
                className="h-11 rounded-xl border-0 bg-white px-3 font-normal text-foreground shadow-none outline-none ring-0 placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-teal-200"
              />
            </label>
            <Button
              type="submit"
              size="lg"
              className="h-11 gap-2 self-end bg-white text-teal-950 hover:bg-teal-50 sm:h-[3.25rem] sm:min-w-[8.5rem] sm:px-6"
            >
              <Search aria-hidden className="size-4" />
              Search
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}
