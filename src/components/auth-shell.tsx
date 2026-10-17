import { ShieldCheck, FlaskConical, FileLock2, CalendarCheck2 } from "@/components/icons";
import { authHeroImage } from "@/lib/center-marketing";
import { cn } from "cn";

const points = [
  { icon: CalendarCheck2, title: "Book a real time slot", body: "See open times at the center or at home, and keep your place once you book." },
  { icon: FlaskConical, title: "Samples tracked by barcode", body: "Every tube is followed from collection to result." },
  { icon: FileLock2, title: "Reports checked by a doctor", body: "You see results only after a pathologist or radiologist signs them." },
  { icon: ShieldCheck, title: "Your data stays private", body: "Each center sees only its own patients. Reports are never sent in a message." },
];

/** Two-column frame for sign-in, registration, and recovery pages. */
export function AuthShell({ eyebrow, title, description, children, footer, wide = false }: { eyebrow: string; title: string; description?: string; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  const hero = authHeroImage();
  return (
    <main className="home-canvas mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1fr_minmax(0,1.05fr)] lg:py-16">
      <aside className="relative hidden overflow-hidden rounded-3xl bg-[oklch(0.32_0.07_200)] p-10 text-white shadow-xl lg:flex lg:flex-col lg:justify-between">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={hero.url}
          alt=""
          width={800}
          height={1200}
          className={cn("absolute inset-0 size-full object-cover opacity-45", hero.position)}
          decoding="async"
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-[oklch(0.28_0.06_200_/_0.92)] via-[oklch(0.34_0.07_190_/_0.88)] to-[oklch(0.42_0.08_175_/_0.82)]" />
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-white/10 blur-2xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-16 size-80 rounded-full bg-teal-300/20 blur-3xl" />
        <div className="relative">
          <p className="text-xs font-semibold tracking-[0.18em] text-teal-100 uppercase">MediScan Hub</p>
          <p className="mt-4 font-display text-3xl leading-tight">Tests, scans and reports in one place.</p>
        </div>
        <ul className="relative mt-10 grid gap-5">
          {points.map(({ icon: Icon, title: heading, body }) => (
            <li key={heading} className="flex gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/15 ring-1 ring-white/20"><Icon className="size-4" aria-hidden /></span>
              <span><span className="block text-sm font-semibold">{heading}</span><span className="block text-sm text-white/75">{body}</span></span>
            </li>
          ))}
        </ul>
        <p className="relative mt-10 text-xs text-white/60">Synthetic demonstration environment. No real patient data.</p>
      </aside>
      <section className={wide ? "w-full" : "mx-auto w-full max-w-md lg:max-w-none"}>
        <div className="rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
          <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">{eyebrow}</p>
          <h1 className="mt-2 font-display text-3xl tracking-tight">{title}</h1>
          {description ? <p className="mt-2 text-sm text-muted-foreground">{description}</p> : null}
          <div className="mt-6">{children}</div>
        </div>
        {footer ? <div className="mt-4 text-center text-sm text-muted-foreground">{footer}</div> : null}
      </section>
    </main>
  );
}
