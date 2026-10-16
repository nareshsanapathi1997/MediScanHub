import { ShieldCheck, FlaskConical, FileLock2, CalendarCheck2 } from "@/components/icons";

const points = [
  { icon: CalendarCheck2, title: "Real slots, server-checked", body: "Capacity is held on the server, so two people never get the same 8:00 slot." },
  { icon: FlaskConical, title: "Barcode-tracked samples", body: "Every tube is followed from collection to result with an audit trail." },
  { icon: FileLock2, title: "Reports after sign-off", body: "Results reach patients only after a second reviewer approves them." },
  { icon: ShieldCheck, title: "Strict tenant isolation", body: "Each center's data is fenced by row-level security in PostgreSQL." },
];

/** Two-column frame for sign-in, registration, and recovery pages. */
export function AuthShell({ eyebrow, title, description, children, footer, wide = false }: { eyebrow: string; title: string; description?: string; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  return (
    <main className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1fr_minmax(0,1.05fr)] lg:py-16">
      <aside className="relative hidden overflow-hidden rounded-3xl bg-gradient-to-br from-[oklch(0.32_0.07_200)] via-[oklch(0.38_0.08_190)] to-[oklch(0.45_0.09_175)] p-10 text-white shadow-xl lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-white/10 blur-2xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-16 size-80 rounded-full bg-teal-300/20 blur-3xl" />
        <div className="relative">
          <p className="text-xs font-semibold tracking-[0.18em] text-teal-100 uppercase">MediScan Hub</p>
          <p className="mt-4 font-display text-3xl leading-tight">One platform for every diagnostic desk.</p>
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
