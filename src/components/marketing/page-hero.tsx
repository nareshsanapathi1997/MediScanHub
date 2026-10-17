import { cn } from "cn";
import { pageHeroImage } from "@/lib/center-marketing";

type PageHeroProps = {
  eyebrow: string;
  title: string;
  description?: string;
  /** Stable seed into the shared 10-image defaults pool (e.g. "tests", "faq"). */
  pageKey: string;
  imageAlt?: string;
  actions?: React.ReactNode;
  className?: string;
};

/** Compact image strip for marketing directory pages — same teal veil language as the home hero. */
export function PageHero({
  eyebrow,
  title,
  description,
  pageKey,
  imageAlt = "",
  actions,
  className,
}: PageHeroProps) {
  const hero = pageHeroImage(pageKey);
  return (
    <section className={cn("page-hero relative isolate overflow-hidden border-b", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={hero.url}
        alt={imageAlt}
        width={1600}
        height={600}
        className={cn("page-hero-visual absolute inset-0 size-full object-cover", hero.position)}
        decoding="async"
        fetchPriority="high"
      />
      <div className="page-hero-veil absolute inset-0" aria-hidden />
      <div className="relative mx-auto flex h-full max-w-6xl flex-col justify-end gap-4 px-4 pb-7 pt-14 sm:pb-9 sm:pt-16">
        <div className="grid max-w-2xl gap-2.5">
          <p className="home-rise text-xs font-semibold tracking-[0.16em] text-teal-100/90 uppercase">{eyebrow}</p>
          <h1 className="home-rise home-rise-delay-1 font-display text-[clamp(1.75rem,4vw,2.75rem)] leading-[1.1] tracking-tight text-balance text-white">
            {title}
          </h1>
          {description ? (
            <p className="home-rise home-rise-delay-2 max-w-xl text-[15px] leading-relaxed text-teal-50/88 sm:text-base">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="home-rise home-rise-delay-3">{actions}</div> : null}
      </div>
    </section>
  );
}
