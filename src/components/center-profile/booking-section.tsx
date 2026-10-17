import Link from "next/link";
import { AlertCircle, ArrowRight, CalendarDays, Home, Hospital, ShoppingBag, Sun, Sunrise, Sunset, X, type LucideIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { formatInr } from "@/lib/format";
import { modalityLabel, type ScanModality } from "@/domain/scan-scheduling";
import { cn } from "cn";
import { SectionHeading } from "./section-heading";
import { MobileBookingBar, SelectionPanel } from "./selection-chrome";
import { bookingTotal, profileHref, servicePrice, shiftDay, slotPeriod, type CenterBranch, type CenterProfile, type ProfileState } from "./utils";

type Slots = Array<{ id: string; startsAt: Date; endsAt: Date; capacity: number; bookedCount: number; label?: string; minutes?: number }>;
type ScanInfo = { modality: ScanModality | null; error: string | null; prep: string[] };

const timeFormat = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
const weekdayFormat = new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" });
const dayMonthFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
const longDayFormat = new Intl.DateTimeFormat("en-IN", { dateStyle: "full", timeZone: "Asia/Kolkata" });

const PERIODS: { id: "Morning" | "Afternoon" | "Evening"; icon: LucideIcon }[] = [
  { id: "Morning", icon: Sunrise },
  { id: "Afternoon", icon: Sun },
  { id: "Evening", icon: Sunset },
];

function noon(day: string) {
  return new Date(`${day}T12:00:00.000+05:30`);
}

export function BookingSection({ center, state, branch, slots, today, scan }: { center: CenterProfile; state: ProfileState; branch: CenterBranch | undefined; slots: Slots; today: string; scan: ScanInfo }) {
  const selection = bookingTotal(center, state);
  const hasSelection = selection.count > 0;
  const days = Array.from({ length: 14 }, (_, index) => shiftDay(today, index));
  const homeAvailable = Boolean(branch?.homeCollection) && !scan.modality;
  const pill = (active: boolean) => cn("inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors", active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground");

  return (
    <section id="book" className="grid min-w-0 scroll-mt-24 gap-5">
      <SectionHeading eyebrow="Book a visit" title="Pick a date and time" description="You confirm the details and pay at checkout. You can cancel any time before your visit." />

      <div className="grid gap-5 rounded-2xl border bg-card p-4 sm:p-6">
        {!branch ? <p className="text-sm text-muted-foreground">This center has no branch taking bookings right now.</p> : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {center.branches.length > 1 ? (
                <div className="grid gap-1.5">
                  <p className="text-sm font-medium" id="branch-label">Branch</p>
                  <nav aria-labelledby="branch-label" className="flex gap-1 overflow-x-auto rounded-xl bg-muted p-1">
                    {center.branches.map((item) => (
                      <Link key={item.id} href={profileHref(state, { branchId: item.id, visit: item.homeCollection ? state.visit : "CENTER_VISIT" }, "book")} scroll={false} aria-current={item.id === branch.id ? "true" : undefined} className={cn(pill(item.id === branch.id), "flex-1 justify-center")}>{item.name}</Link>
                    ))}
                  </nav>
                </div>
              ) : null}
              <div className="grid gap-1.5">
                <p className="text-sm font-medium" id="visit-label">Where</p>
                <nav aria-labelledby="visit-label" className="flex gap-1 rounded-xl bg-muted p-1">
                  <Link href={profileHref(state, { visit: "CENTER_VISIT" }, "book")} scroll={false} aria-current={state.visit === "CENTER_VISIT" ? "true" : undefined} className={cn(pill(state.visit === "CENTER_VISIT"), "flex-1 justify-center")}><Hospital className="size-4" aria-hidden />At the center</Link>
                  {homeAvailable ? (
                    <Link href={profileHref(state, { visit: "HOME_COLLECTION" }, "book")} scroll={false} aria-current={state.visit === "HOME_COLLECTION" ? "true" : undefined} className={cn(pill(state.visit === "HOME_COLLECTION"), "flex-1 justify-center")}><Home className="size-4" aria-hidden />At home</Link>
                  ) : (
                    <span className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-sm whitespace-nowrap text-muted-foreground/60" title={scan.modality ? "Scans are done at the center" : "Home collection is not offered at this branch"}><Home className="size-4" aria-hidden />At home</span>
                  )}
                </nav>
              </div>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium" id="day-label">Date</p>
                <form action={`/centers/${center.slug}#book`} method="get" className="flex items-center gap-2 text-sm">
                  {state.services.length ? <input type="hidden" name="service" value={state.services.join(",")} /> : null}
                  {state.packages.length ? <input type="hidden" name="package" value={state.packages.join(",")} /> : null}
                  <input type="hidden" name="branch" value={branch.id} />
                  {state.visit === "HOME_COLLECTION" ? <input type="hidden" name="visit" value={state.visit} /> : null}
                  {state.kind ? <input type="hidden" name="kind" value={state.kind} /> : null}
                  <label className="sr-only" htmlFor="other-day">Other date</label>
                  <input id="other-day" type="date" name="day" defaultValue={state.day} min={today} className="h-9 rounded-lg border bg-background px-2 text-sm" />
                  <button type="submit" className={cn(buttonVariants({ variant: "outline" }), "h-9 px-3")}>Go</button>
                </form>
              </div>
              <div role="group" aria-labelledby="day-label" className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
                {days.map((value, index) => (
                  <Link
                    key={value}
                    href={profileHref(state, { day: value }, "book")}
                    scroll={false}
                    aria-current={value === state.day ? "date" : undefined}
                    className={cn("grid min-w-[4.5rem] shrink-0 snap-start gap-0.5 rounded-xl border px-3 py-2 text-center text-xs transition-colors", value === state.day ? "border-primary bg-primary text-primary-foreground shadow-sm" : "bg-background hover:border-primary/50")}
                  >
                    <span className="opacity-80">{index === 0 ? "Today" : index === 1 ? "Tomorrow" : weekdayFormat.format(noon(value))}</span>
                    <span className="text-sm font-semibold">{dayMonthFormat.format(noon(value))}</span>
                  </Link>
                ))}
              </div>
            </div>

            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><CalendarDays className="size-4 text-primary" aria-hidden />{longDayFormat.format(noon(state.day))}</span>
              <span className="flex items-center gap-1.5">
                {state.visit === "HOME_COLLECTION" ? <Home className="size-4 text-primary" aria-hidden /> : <Hospital className="size-4 text-primary" aria-hidden />}
                {state.visit === "HOME_COLLECTION" ? "Home collection" : `Visit ${branch.name}`}
              </span>
            </p>

            {scan.error ? (
              <p role="alert" className="flex items-start gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{scan.error}</span>
              </p>
            ) : null}
            {scan.modality ? (
              <div className="grid gap-2 rounded-xl border border-info/30 bg-info/8 px-4 py-3 text-sm">
                <p className="font-medium">Showing {modalityLabel(scan.modality)} slots. Each slot is in the {modalityLabel(scan.modality)} room.</p>
                {scan.prep.length ? (
                  <div>
                    <p className="font-medium">How to prepare</p>
                    <ul className="list-disc pl-5 text-muted-foreground">{scan.prep.map((line) => <li key={line}>{line}</li>)}</ul>
                  </div>
                ) : null}
              </div>
            ) : null}
            {!hasSelection ? (
              <p role="status" className="flex items-start gap-2 rounded-xl bg-accent/60 px-4 py-3 text-sm text-accent-foreground">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>Add at least one test or package from the <a href="#services" className="font-medium underline underline-offset-2">list above</a>, then pick a time.</span>
              </p>
            ) : null}

            {slots.length === 0 ? (
              <div className="grid justify-items-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                <CalendarDays className="size-6 text-muted-foreground/70" aria-hidden />
                <p className="font-medium text-foreground">{scan.modality ? `No open ${modalityLabel(scan.modality)} slots on this day` : "No open slots on this day"}</p>
                <p>Try another date above.</p>
                {days.includes(shiftDay(state.day, 1)) ? <Link href={profileHref(state, { day: shiftDay(state.day, 1) }, "book")} scroll={false} className={cn(buttonVariants({ variant: "outline" }), "mt-1 h-9 gap-1.5 px-3")}>Next day<ArrowRight aria-hidden /></Link> : null}
              </div>
            ) : (
              <div className="grid gap-4">
                {PERIODS.map(({ id, icon: Icon }) => {
                  const group = slots.filter((slot) => slotPeriod(slot.startsAt) === id);
                  if (group.length === 0) return null;
                  return (
                    <div key={id} className="grid gap-2">
                      <h3 className="flex items-center gap-2 text-sm font-medium"><Icon className="size-4 text-primary" aria-hidden />{id}<span className="font-normal text-muted-foreground">· {group.length} slot{group.length === 1 ? "" : "s"}</span></h3>
                      <ul className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2">
                        {group.map((slot) => {
                          const left = slot.capacity - slot.bookedCount;
                          const label = (
                            <>
                              <span className="font-semibold">{timeFormat.format(slot.startsAt)}</span>
                              <span className={cn("text-xs", slot.capacity > 2 && left === 1 ? "font-medium text-destructive" : "text-muted-foreground")}>{[slot.minutes ? `${slot.minutes} min` : null, slot.capacity > 1 ? `${left} left` : null].filter(Boolean).join(" · ") || "Available"}</span>
                            </>
                          );
                          return (
                            <li key={slot.id}>
                              {hasSelection ? (
                                <Link
                                  href={`/checkout?branch=${branch.id}&slot=${slot.id}&services=${state.services.join(",")}&packages=${state.packages.join(",")}&visit=${state.visit}`}
                                  className="grid gap-0.5 rounded-xl border bg-background px-2 py-2.5 text-center text-sm transition-colors hover:border-primary hover:bg-primary/5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                                >
                                  {label}
                                </Link>
                              ) : (
                                <span aria-disabled="true" className="grid gap-0.5 rounded-xl border bg-muted/40 px-2 py-2.5 text-center text-sm opacity-60">{label}</span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
      <MobileBookingBar count={selection.count} totalPaise={selection.total} />
    </section>
  );
}

/** Sticky cart next to the services list on desktop; sits just above the slot picker on phones. */
export function BookingSummary({ center, state, branch, className }: { center: CenterProfile; state: ProfileState; branch: CenterBranch | undefined; className?: string }) {
  const selection = bookingTotal(center, state);
  const hasSelection = selection.count > 0;
  return (
    <SelectionPanel
      count={selection.count}
      className={cn("grid content-start gap-4 rounded-2xl border bg-card p-5 shadow-sm", hasSelection && "border-primary/40", className)}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-xl">Your booking</h3>
          <p className="text-xs text-muted-foreground">{branch ? `${branch.name} · ${longDayFormat.format(noon(state.day))}` : "Tests and packages for this visit"}</p>
        </div>
        {hasSelection ? (
          <span className="grid min-w-7 place-items-center rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground" aria-label={`${selection.count} items selected`}>
            {selection.count}
          </span>
        ) : null}
      </div>
      {hasSelection ? (
        <>
          <ul className="grid gap-2.5 text-sm">
            {selection.packages.map((pkg) => (
              <li key={pkg.id} className="flex items-start justify-between gap-3">
                <span className="min-w-0">{pkg.name}<span className="block text-xs text-muted-foreground">Package</span></span>
                <span className="flex shrink-0 items-center gap-1 tabular-nums">
                  {formatInr(pkg.pricePaise)}
                  <Link href={profileHref(state, { packages: state.packages.filter((id) => id !== pkg.id) })} scroll={false} aria-label={`Remove ${pkg.name}`} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="size-3.5" aria-hidden /></Link>
                </span>
              </li>
            ))}
            {selection.services.map((service) => {
              const price = servicePrice(service, state.branchId);
              return (
                <li key={service.id} className="flex items-start justify-between gap-3">
                  <span className="min-w-0">{service.name}</span>
                  <span className="flex shrink-0 items-center gap-1 tabular-nums">
                    {price ? formatInr(price.final) : "—"}
                    <Link href={profileHref(state, { services: state.services.filter((id) => id !== service.id) })} scroll={false} aria-label={`Remove ${service.name}`} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="size-3.5" aria-hidden /></Link>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="flex items-center justify-between border-t pt-3 font-medium"><span>Estimated total</span><span className="font-display text-2xl tabular-nums">{formatInr(selection.total)}</span></p>
          <a href="#book" className={cn(buttonVariants(), "h-10 gap-1.5")}>Choose a time slot<ArrowRight aria-hidden /></a>
          <p className="text-xs text-muted-foreground">Final price is confirmed at checkout.</p>
        </>
      ) : (
        <div className="grid justify-items-start gap-2 rounded-xl border border-dashed bg-muted/30 px-4 py-5 text-sm text-muted-foreground">
          <ShoppingBag className="size-5 text-muted-foreground/70" aria-hidden />
          <p className="font-medium text-foreground">Nothing added yet</p>
          <p>Tap “Add” on a test, scan or package. Your total shows here.</p>
        </div>
      )}
    </SelectionPanel>
  );
}
