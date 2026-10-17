import Link from "next/link";
import { Check, Droplets, FlaskConical, Info, Plus, ScanLine, Search, Timer, X } from "lucide-react";
import { ProfileToggleLink } from "./profile-toggle-link";
import { buttonVariants } from "@/components/ui/button";
import { formatInr } from "@/lib/format";
import { modalityLabel } from "@/domain/scan-scheduling";
import { cn } from "cn";
import { SectionHeading } from "./section-heading";
import { profileHref, servicePrice, tatLabel, toggle, type CenterProfile, type CenterService, type ProfileState } from "./utils";

type Filter = "ALL" | "LAB" | "IMAGING";

function matches(service: CenterService, q: string) {
  const needle = q.toLowerCase();
  return [service.name, service.description, service.category.name, service.modality ?? "", service.sampleType ?? ""].some((text) => text.toLowerCase().includes(needle));
}

export function ServicesSection({ center, state }: { center: CenterProfile; state: ProfileState }) {
  const branch = center.branches.find((item) => item.id === state.branchId);
  const kinds = new Set(center.services.map((service) => service.kind));
  const showFilter = kinds.size > 1;
  const active: Filter = showFilter && state.kind ? state.kind : "ALL";
  const q = state.q?.trim() ?? "";
  const visible = center.services.filter((service) => (active === "ALL" || service.kind === active) && (!q || matches(service, q)));

  const groups = new Map<string, { name: string; description: string; items: CenterService[] }>();
  for (const service of visible) {
    const group = groups.get(service.category.id) ?? { name: service.category.name, description: service.category.description, items: [] };
    group.items.push(service);
    groups.set(service.category.id, group);
  }

  const filters: { id: Filter; label: string; count: number; icon?: typeof FlaskConical }[] = [
    { id: "ALL", label: "All", count: center.services.length },
    { id: "LAB", label: "Lab tests", count: center.services.filter((service) => service.kind === "LAB").length, icon: FlaskConical },
    { id: "IMAGING", label: "Scans", count: center.services.filter((service) => service.kind === "IMAGING").length, icon: ScanLine },
  ];

  return (
    <section id="services" className="grid min-w-0 scroll-mt-24 gap-5">
      <SectionHeading
        eyebrow="Tests & scans"
        title="Choose tests and scans"
        description={branch ? `Prices shown for the ${branch.name} branch, including any discount.` : "Prices include any discount."}
      />
      <div className="grid gap-3 rounded-2xl border bg-card p-3 sm:flex sm:items-center sm:justify-between">
        {showFilter ? (
          <nav aria-label="Filter services" className="flex gap-1 rounded-xl bg-muted p-1">
            {filters.filter((item) => item.id === "ALL" || item.count > 0).map(({ id, label, count, icon: Icon }) => (
              <Link
                key={id}
                href={profileHref(state, { kind: id === "ALL" ? undefined : id }, "services")}
                scroll={false}
                aria-current={active === id ? "true" : undefined}
                className={cn("inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors sm:flex-none", active === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                {Icon ? <Icon className="size-4" aria-hidden /> : null}{label}<span className="text-xs font-normal text-muted-foreground">{count}</span>
              </Link>
            ))}
          </nav>
        ) : <span />}
        <form action={`/centers/${center.slug}#services`} method="get" role="search" className="relative sm:w-72">
          {state.services.length ? <input type="hidden" name="service" value={state.services.join(",")} /> : null}
          {state.packages.length ? <input type="hidden" name="package" value={state.packages.join(",")} /> : null}
          {state.branchId ? <input type="hidden" name="branch" value={state.branchId} /> : null}
          <input type="hidden" name="day" value={state.day} />
          {state.kind ? <input type="hidden" name="kind" value={state.kind} /> : null}
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input type="search" name="q" defaultValue={q} placeholder="Search tests, e.g. thyroid" aria-label="Search tests and scans" className="h-10 w-full rounded-xl border bg-background pr-3 pl-9 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40" />
        </form>
      </div>

      {q ? (
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground" role="status">
          {visible.length} result{visible.length === 1 ? "" : "s"} for “{q}”
          <Link href={profileHref(state, { q: undefined }, "services")} scroll={false} className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs text-foreground hover:bg-muted"><X className="size-3" aria-hidden />Clear search</Link>
        </p>
      ) : null}

      {center.services.length === 0 ? <EmptyCatalog text="This center hasn't published individual tests yet." /> : null}
      {center.services.length > 0 && visible.length === 0 ? <EmptyCatalog text={q ? `No test or scan matches “${q}”. Try a shorter word, like “sugar” or “x-ray”.` : "Nothing in this group yet."} /> : null}

      {[...groups.entries()].map(([id, group]) => (
        <div key={id} className="grid gap-2">
          <div className="flex items-baseline justify-between gap-3 px-1">
            <h3 className="font-display text-xl">{group.name}</h3>
            <span className="text-xs text-muted-foreground">{group.items.length} {group.items.length === 1 ? "item" : "items"}</span>
          </div>
          {group.description ? <p className="-mt-1 px-1 text-sm text-muted-foreground">{group.description}</p> : null}
          <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
            {group.items.map((service) => <ServiceRow key={service.id} service={service} state={state} />)}
          </ul>
        </div>
      ))}
    </section>
  );
}

function ServiceRow({ service, state }: { service: CenterService; state: ProfileState }) {
  const price = servicePrice(service, state.branchId);
  const selected = state.services.includes(service.id);
  const Icon = service.kind === "IMAGING" ? ScanLine : FlaskConical;
  return (
    <li className={cn("grid gap-3 p-4 transition-colors sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6 sm:p-5", selected && "bg-primary/5")}>
      <div className="flex min-w-0 gap-3">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", service.kind === "IMAGING" ? "bg-info/12 text-info" : "bg-accent text-accent-foreground")}><Icon className="size-5" aria-hidden /></span>
        <div className="grid min-w-0 gap-1.5">
          <h4 className="leading-snug font-medium">{service.name}</h4>
          <p className="text-sm text-muted-foreground">{service.description}</p>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Timer className="size-3.5" aria-hidden />{tatLabel(service.tatHours)}</span>
            {service.sampleType ? <span className="inline-flex items-center gap-1"><Droplets className="size-3.5" aria-hidden />{service.sampleType}</span> : null}
            {service.modality ? <span className="inline-flex items-center gap-1"><ScanLine className="size-3.5" aria-hidden />{modalityLabel(service.modality)}</span> : null}
          </p>
          {service.preparation ? (
            <p className="flex gap-1.5 text-xs text-muted-foreground"><Info className="mt-px size-3.5 shrink-0 text-warning" aria-hidden /><span><span className="font-medium text-foreground">Preparation: </span>{service.preparation}</span></p>
          ) : null}
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 pl-13 sm:justify-end sm:pl-0">
        {price ? (
          <p className="grid text-right">
            <span className="font-display text-xl leading-tight">{formatInr(price.final)}</span>
            {price.discounted ? <span className="text-xs text-muted-foreground line-through">{formatInr(price.original)}</span> : null}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Price on request</p>
        )}
        <ProfileToggleLink
          href={profileHref(state, { services: toggle(state.services, service.id) }, "services")}
          selected={selected}
          itemName={service.name}
          className={cn(buttonVariants({ variant: selected ? "default" : "outline" }), "h-9 min-w-24 gap-1.5 px-3")}
        >
          {selected ? <Check aria-hidden /> : <Plus aria-hidden />}
          {selected ? "Added" : "Add"}
          <span className="sr-only"> {selected ? `${service.name} to booking (click to remove)` : `${service.name} to booking`}</span>
        </ProfileToggleLink>
      </div>
    </li>
  );
}

function EmptyCatalog({ text }: { text: string }) {
  return <p className="rounded-2xl border border-dashed bg-card px-6 py-10 text-center text-sm text-muted-foreground">{text}</p>;
}
