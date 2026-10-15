import Link from "next/link";
import { CalendarCheck, Check, Clock, Home, Mail, MapPin, Navigation, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { SectionHeading } from "./section-heading";
import { formatClock, fullAddress, mapsUrl, profileHref, type CenterProfile, type ProfileState } from "./utils";

export function BranchesSection({ center, state }: { center: CenterProfile; state: ProfileState }) {
  if (center.branches.length === 0) return null;
  return (
    <section id="branches" className="mx-auto grid w-full max-w-6xl scroll-mt-24 gap-6 px-4">
      <SectionHeading
        eyebrow="Locations"
        title={center.branches.length === 1 ? "Visit our branch" : `${center.branches.length} branches near you`}
        description="Prices and slot availability follow the branch you choose."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {center.branches.map((branch) => {
          const selected = branch.id === state.branchId;
          return (
            <article key={branch.id} className={cn("grid content-between gap-5 rounded-2xl border bg-card p-5 transition-shadow hover:shadow-md", selected && "border-primary/60 ring-2 ring-primary/20")}>
              <div className="grid gap-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="font-display text-xl">{branch.name}</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {selected ? <Badge className="gap-1"><Check aria-hidden />Selected</Badge> : null}
                    {branch.homeCollection ? <Badge variant="secondary" className="gap-1"><Home aria-hidden />Home collection</Badge> : null}
                  </div>
                </div>
                <ul className="grid gap-2 text-sm text-muted-foreground">
                  <li className="flex gap-2.5"><MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /><span>{fullAddress(branch)}</span></li>
                  <li className="flex gap-2.5"><Clock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /><span>Open daily {formatClock(branch.opensAt)} – {formatClock(branch.closesAt)}</span></li>
                  <li className="flex gap-2.5"><Phone className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /><a href={`tel:${branch.phone}`} className="hover:text-primary">{branch.phone}</a></li>
                  {branch.email ? <li className="flex gap-2.5"><Mail className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /><a href={`mailto:${branch.email}`} className="break-all hover:text-primary">{branch.email}</a></li> : null}
                </ul>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={profileHref(state, { branchId: branch.id, visit: branch.homeCollection ? state.visit : "CENTER_VISIT" }, "book")} scroll className={cn(buttonVariants({ variant: selected ? "default" : "outline" }), "h-9 gap-1.5 px-3")}>
                  <CalendarCheck aria-hidden />{selected ? "View slots" : "Book here"}
                </Link>
                <a href={mapsUrl(branch)} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: "ghost" }), "h-9 gap-1.5 px-3")}>
                  <Navigation aria-hidden />Directions<span className="sr-only"> to {branch.name} (opens Google Maps)</span>
                </a>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
