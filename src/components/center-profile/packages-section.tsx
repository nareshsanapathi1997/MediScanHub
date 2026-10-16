import { Check, PackageCheck, Plus, Sparkles } from "lucide-react";
import { ProfileToggleLink } from "./profile-toggle-link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatInr } from "@/lib/format";
import { cn } from "cn";
import { SectionHeading } from "./section-heading";
import { profileHref, servicePrice, toggle, type CenterPackage, type CenterProfile, type ProfileState } from "./utils";

export function PackagesSection({ center, state }: { center: CenterProfile; state: ProfileState }) {
  if (center.packages.length === 0) return null;
  const servicesById = new Map(center.services.map((service) => [service.id, service]));
  return (
    <section id="packages" className="mx-auto grid w-full max-w-6xl scroll-mt-24 gap-6 px-4">
      <SectionHeading eyebrow="Health packages" title="Health checkup packages" description="Several tests at one price. Packages you add appear in “Your booking” below." />
      <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {center.packages.map((pkg) => <PackageCard key={pkg.id} pkg={pkg} state={state} servicesById={servicesById} />)}
      </ul>
    </section>
  );
}

function PackageCard({ pkg, state, servicesById }: { pkg: CenterPackage; state: ProfileState; servicesById: Map<string, CenterProfile["services"][number]> }) {
  const selected = state.packages.includes(pkg.id);
  // Only advertise savings when every included test has a known price for this branch.
  const prices = pkg.items.map((item) => {
    const service = servicesById.get(item.serviceId);
    return service ? servicePrice(service, state.branchId)?.final ?? null : null;
  });
  const separate = prices.length > 0 && prices.every((value): value is number => value !== null) ? prices.reduce((sum, value) => sum + value, 0) : null;
  const savings = separate !== null && separate > pkg.pricePaise ? separate - pkg.pricePaise : 0;
  return (
    <li className={cn("grid content-between gap-5 rounded-2xl border bg-card p-5 transition-shadow hover:shadow-md", selected && "border-primary/60 ring-2 ring-primary/20")}>
      <div className="grid gap-3">
        <div className="flex items-start justify-between gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><PackageCheck className="size-5" aria-hidden /></span>
          {savings > 0 ? <Badge variant="secondary" className="gap-1"><Sparkles aria-hidden />Save {formatInr(savings)}</Badge> : null}
        </div>
        <h3 className="font-display text-xl leading-snug">{pkg.name}</h3>
        <p className="text-sm text-muted-foreground">{pkg.description}</p>
        <div>
          <p className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">Includes {pkg.items.length} test{pkg.items.length === 1 ? "" : "s"}</p>
          <ul className="grid gap-1 text-sm">
            {pkg.items.map((item) => (
              <li key={item.id} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />{item.service.name}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t pt-4">
        <p className="flex items-baseline gap-2">
          <span className="font-display text-2xl">{formatInr(pkg.pricePaise)}</span>
          {savings > 0 && separate !== null ? <span className="text-xs text-muted-foreground line-through">{formatInr(separate)}</span> : null}
        </p>
        <ProfileToggleLink
          href={profileHref(state, { packages: toggle(state.packages, pkg.id) }, "packages")}
          selected={selected}
          itemName={pkg.name}
          className={cn(buttonVariants({ variant: selected ? "default" : "outline" }), "h-9 gap-1.5 px-3")}
        >
          {selected ? <Check aria-hidden /> : <Plus aria-hidden />}
          {selected ? "Added ✓" : "Add to booking"}
          <span className="sr-only"> {pkg.name}{selected ? " (click to remove)" : ""}</span>
        </ProfileToggleLink>
      </div>
    </li>
  );
}
