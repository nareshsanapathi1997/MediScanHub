import Link from "next/link";
import { Check, ClipboardList, Droplets, FlaskConical, Plus, ScanLine, Timer } from "lucide-react";
import { ProfileToggleLink } from "./profile-toggle-link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatInr } from "@/lib/format";
import { cn } from "cn";
import { SectionHeading } from "./section-heading";
import { profileHref, servicePrice, tatLabel, toggle, type CenterProfile, type CenterService, type ProfileState } from "./utils";

type Filter = "ALL" | "LAB" | "IMAGING";

export function ServicesSection({ center, state }: { center: CenterProfile; state: ProfileState }) {
  const branch = center.branches.find((item) => item.id === state.branchId);
  const kinds = new Set(center.services.map((service) => service.kind));
  const showFilter = kinds.size > 1;
  const active: Filter = showFilter && state.kind ? state.kind : "ALL";
  const visible = center.services.filter((service) => active === "ALL" || service.kind === active);

  const groups = new Map<string, { name: string; description: string; items: CenterService[] }>();
  for (const service of visible) {
    const group = groups.get(service.category.id) ?? { name: service.category.name, description: service.category.description, items: [] };
    group.items.push(service);
    groups.set(service.category.id, group);
  }

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: "ALL", label: "All", count: center.services.length },
    { id: "LAB", label: "Lab tests", count: center.services.filter((service) => service.kind === "LAB").length },
    { id: "IMAGING", label: "Imaging", count: center.services.filter((service) => service.kind === "IMAGING").length },
  ];

  return (
    <section id="services" className="mx-auto grid w-full max-w-6xl scroll-mt-24 gap-6 px-4">
      <SectionHeading
        eyebrow="Tests & scans"
        title="Diagnostic services"
        description={branch ? `Showing prices for ${branch.name}. Add one or more tests, then pick a slot below.` : "Add one or more tests, then pick a slot below."}
      />
      <p className="-mt-2 text-sm text-muted-foreground">
        Selected tests appear in <a href="#selection-panel" className="font-medium text-foreground underline underline-offset-2">Your booking</a> below — use the sticky panel on desktop or the bar at the bottom on mobile.
      </p>
      {showFilter ? (
        <nav aria-label="Filter services" className="flex flex-wrap gap-2">
          {filters.filter((item) => item.id === "ALL" || item.count > 0).map((item) => (
            <Link
              key={item.id}
              href={profileHref(state, { kind: item.id === "ALL" ? undefined : item.id }, "services")}
              aria-current={active === item.id ? "true" : undefined}
              className={cn("inline-flex h-9 items-center gap-2 rounded-full border px-4 text-sm transition-colors", active === item.id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}
            >
              {item.label}<span className="text-xs opacity-75">{item.count}</span>
            </Link>
          ))}
        </nav>
      ) : null}

      {center.services.length === 0 ? <EmptyCatalog text="This center hasn't published individual tests yet." /> : null}

      {[...groups.entries()].map(([id, group]) => (
        <div key={id} className="grid gap-3">
          <div>
            <h3 className="font-display text-xl">{group.name}</h3>
            {group.description ? <p className="text-sm text-muted-foreground">{group.description}</p> : null}
          </div>
          <ul className="grid gap-3 lg:grid-cols-2">
            {group.items.map((service) => <ServiceCard key={service.id} service={service} state={state} />)}
          </ul>
        </div>
      ))}
    </section>
  );
}

function ServiceCard({ service, state }: { service: CenterService; state: ProfileState }) {
  const price = servicePrice(service, state.branchId);
  const selected = state.services.includes(service.id);
  const Icon = service.kind === "IMAGING" ? ScanLine : FlaskConical;
  return (
    <li className={cn("grid content-between gap-4 rounded-2xl border bg-card p-4 transition-shadow hover:shadow-md sm:p-5", selected && "border-primary/60 ring-2 ring-primary/20")}>
      <div className="flex gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground"><Icon className="size-5" aria-hidden /></span>
        <div className="grid gap-2">
          <h4 className="leading-snug font-medium">{service.name}</h4>
          <p className="text-sm text-muted-foreground">{service.description}</p>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="gap-1"><Timer aria-hidden />{tatLabel(service.tatHours)}</Badge>
            {service.sampleType ? <Badge variant="outline" className="gap-1"><Droplets aria-hidden />{service.sampleType}</Badge> : null}
            {service.modality ? <Badge variant="outline">{service.modality}</Badge> : null}
            {service.parameters.length > 0 ? <Badge variant="outline" className="gap-1"><ClipboardList aria-hidden />{service.parameters.length} parameter{service.parameters.length === 1 ? "" : "s"}</Badge> : null}
          </div>
          {service.preparation ? (
            <p className="rounded-lg bg-muted/70 px-3 py-2 text-xs text-muted-foreground"><span className="font-medium text-foreground">Preparation: </span>{service.preparation}</p>
          ) : null}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t pt-3">
        <div>
          {price ? (
            <p className="flex items-baseline gap-2">
              <span className="font-display text-xl">{formatInr(price.final)}</span>
              {price.discounted ? <span className="text-xs text-muted-foreground line-through">{formatInr(price.original)}</span> : null}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Price on request</p>
          )}
        </div>
        <ProfileToggleLink
          href={profileHref(state, { services: toggle(state.services, service.id) }, "services")}
          selected={selected}
          itemName={service.name}
          className={cn(buttonVariants({ variant: selected ? "default" : "outline" }), "h-9 gap-1.5 px-3")}
        >
          {selected ? <Check aria-hidden /> : <Plus aria-hidden />}
          {selected ? "Added ✓" : "Add to booking"}
          <span className="sr-only"> {service.name}{selected ? " (click to remove)" : ""}</span>
        </ProfileToggleLink>
      </div>
    </li>
  );
}

export function EmptyCatalog({ text }: { text: string }) {
  return <p className="rounded-2xl border border-dashed bg-card px-6 py-8 text-center text-sm text-muted-foreground">{text}</p>;
}
