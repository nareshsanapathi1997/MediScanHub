import Link from "next/link";
import { CalendarCheck, Check, Clock, Home, Mail, MapPin, Navigation, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { SectionHeading } from "./section-heading";
import { istNow } from "@/lib/hours";
import { formatPhone, fullAddress, hoursRows, openStatus, upcomingHolidays, mapsUrl, profileHref, type CenterProfile, type ProfileState } from "./utils";

const holidayFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

export function BranchesSection({ center, state }: { center: CenterProfile; state: ProfileState }) {
  const weekday = istNow().weekday;
  if (center.branches.length === 0) return null;
  return (
    <section id="branches" className="mx-auto grid w-full max-w-6xl scroll-mt-24 gap-5 px-4">
      <SectionHeading
        eyebrow="Locations"
        title={center.branches.length === 1 ? "Visit our branch" : `${center.branches.length} branches near you`}
        description="Prices and open slots depend on the branch you choose."
      />
      <div className="grid gap-3 md:grid-cols-2">
        {center.branches.map((branch) => {
          const selected = branch.id === state.branchId;
          const status = openStatus([branch]);
          const holidays = upcomingHolidays(branch);
          return (
            <article key={branch.id} className={cn("grid content-between gap-5 rounded-2xl border bg-card/95 p-5 transition-shadow hover:shadow-md", selected && "border-primary/60 ring-2 ring-primary/20")}>
              <div className="grid gap-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="font-display text-xl tracking-tight">{branch.name}</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {selected ? <Badge className="gap-1"><Check aria-hidden />Selected</Badge> : null}
                    {branch.homeCollection ? <Badge variant="secondary" className="gap-1"><Home aria-hidden />Home collection</Badge> : null}
                  </div>
                </div>
                <ul className="grid gap-2 text-sm text-muted-foreground">
                  <li className="flex gap-2.5"><MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /><span>{fullAddress(branch)}</span></li>
                  <li className="flex gap-2.5">
                    <Clock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    <div className="grid flex-1 gap-1.5">
                      <span className={status.open ? "font-medium text-success" : "font-medium text-foreground"}>{status.label}</span>
                      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-xs" aria-label={`Opening hours, ${branch.name}`}>
                        {hoursRows(branch).map((row) => (
                          <div key={row.label} className={cn("contents", row.days.includes(weekday) && "font-semibold text-foreground")}>
                            <dt>{row.label}</dt>
                            <dd className={row.text === "Closed" ? "text-destructive" : undefined}>{row.text}</dd>
                          </div>
                        ))}
                      </dl>
                      {holidays.length > 0 ? <p className="text-xs">Closed on {holidays.slice(0, 2).map((date) => holidayFormat.format(new Date(`${date}T00:00:00+05:30`))).join(", ")}</p> : null}
                    </div>
                  </li>
                  <li className="flex gap-2.5"><Phone className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /><a href={`tel:${branch.phone}`} className="hover:text-primary">{formatPhone(branch.phone)}</a></li>
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
