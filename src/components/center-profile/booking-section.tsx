import Link from "next/link";
import { AlertCircle, ArrowRight, CalendarDays, Home, Hospital, Sun, Sunrise, Sunset, X, type LucideIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { formatInr } from "@/lib/format";
import type { listSlots } from "@/lib/services/catalog";
import { cn } from "cn";
import { SectionHeading } from "./section-heading";
import { MobileBookingBar, SelectionPanel } from "./selection-chrome";
import { bookingTotal, profileHref, servicePrice, shiftDay, slotPeriod, type CenterBranch, type CenterProfile, type ProfileState } from "./utils";

type Slots = Awaited<ReturnType<typeof listSlots>>;

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

export function BookingSection({ center, state, branch, slots, today }: { center: CenterProfile; state: ProfileState; branch: CenterBranch | undefined; slots: Slots; today: string }) {
  const selection = bookingTotal(center, state);
  const hasSelection = selection.count > 0;
  const days = Array.from({ length: 7 }, (_, index) => shiftDay(today, index));
  const homeAvailable = Boolean(branch?.homeCollection);

  return (
    <section id="book" className="mx-auto grid w-full max-w-6xl scroll-mt-24 gap-6 px-4">
      <SectionHeading eyebrow="Book a visit" title={branch ? `Pick a slot at ${branch.name}` : "Pick a slot"} description="Choose your tests, branch and a time. You confirm and pay securely at checkout." />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr] lg:items-start">
        <div className="grid gap-5 rounded-2xl border bg-card p-5 sm:p-6">
          {!branch ? <p className="text-sm text-muted-foreground">This center has no active branches accepting bookings right now.</p> : (
            <>
              <form action={`/centers/${center.slug}#book`} method="get" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
                <input type="hidden" name="service" value={state.services.join(",")} />
                <input type="hidden" name="package" value={state.packages.join(",")} />
                {state.kind ? <input type="hidden" name="kind" value={state.kind} /> : null}
                <label className="grid gap-1.5 text-sm font-medium">Branch
                  <select name="branch" defaultValue={branch.id} className="h-10 rounded-lg border bg-background px-3 font-normal">
                    {center.branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm font-medium">Date
                  <input type="date" name="day" defaultValue={state.day} min={today} className="h-10 rounded-lg border bg-background px-3 font-normal" />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">Visit type
                  <select name="visit" defaultValue={state.visit} className="h-10 rounded-lg border bg-background px-3 font-normal">
                    <option value="CENTER_VISIT">At the center</option>
                    {homeAvailable ? <option value="HOME_COLLECTION">Home collection</option> : null}
                  </select>
                </label>
                <button className={cn(buttonVariants(), "h-10 px-4")} type="submit">Refresh slots</button>
              </form>

              <div role="group" aria-label="Quick date picker" className="flex gap-2 overflow-x-auto pb-1">
                {days.map((value, index) => (
                  <Link
                    key={value}
                    href={profileHref(state, { day: value }, "book")}
                    scroll={false}
                    aria-current={value === state.day ? "date" : undefined}
                    className={cn("grid min-w-20 shrink-0 gap-0.5 rounded-xl border px-3 py-2 text-center text-xs transition-colors", value === state.day ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted")}
                  >
                    <span className="opacity-75">{index === 0 ? "Today" : index === 1 ? "Tomorrow" : weekdayFormat.format(noon(value))}</span>
                    <span className="text-sm font-medium">{dayMonthFormat.format(noon(value))}</span>
                  </Link>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><CalendarDays className="size-4 text-primary" aria-hidden />{longDayFormat.format(noon(state.day))}</span>
                <span className="flex items-center gap-1.5">
                  {state.visit === "HOME_COLLECTION" ? <Home className="size-4 text-primary" aria-hidden /> : <Hospital className="size-4 text-primary" aria-hidden />}
                  {state.visit === "HOME_COLLECTION" ? "Home collection" : "Visit the center"}
                </span>
              </div>

              {!hasSelection ? (
                <p role="status" className="flex items-start gap-2 rounded-xl bg-accent/60 px-4 py-3 text-sm text-accent-foreground">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>Add at least one test or package from the <a href="#services" className="font-medium underline underline-offset-2">services list</a> to enable booking.</span>
                </p>
              ) : null}

              {slots.length === 0 ? (
                <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">No open slots that day. Try another date from the picker above.</p>
              ) : (
                <div className="grid gap-4">
                  {PERIODS.map(({ id, icon: Icon }) => {
                    const group = slots.filter((slot) => slotPeriod(slot.startsAt) === id);
                    if (group.length === 0) return null;
                    return (
                      <div key={id} className="grid gap-2">
                        <h3 className="flex items-center gap-2 text-sm font-medium"><Icon className="size-4 text-primary" aria-hidden />{id}</h3>
                        <ul className="flex flex-wrap gap-2">
                          {group.map((slot) => {
                            const left = slot.capacity - slot.bookedCount;
                            const label = (
                              <>
                                <span className="font-medium">{timeFormat.format(slot.startsAt)}</span>
                                <span className={cn("text-xs", left <= 2 ? "text-destructive" : "text-muted-foreground")}>{left} left</span>
                              </>
                            );
                            return (
                              <li key={slot.id}>
                                {hasSelection ? (
                                  <Link
                                    href={`/checkout?branch=${branch.id}&slot=${slot.id}&services=${state.services.join(",")}&packages=${state.packages.join(",")}&visit=${state.visit}`}
                                    className="grid min-w-24 gap-0.5 rounded-xl border bg-background px-3 py-2 text-center text-sm transition-colors hover:border-primary hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                                  >
                                    {label}
                                  </Link>
                                ) : (
                                  <span aria-disabled="true" className="grid min-w-24 gap-0.5 rounded-xl border bg-muted/40 px-3 py-2 text-center text-sm opacity-60">{label}</span>
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

        <SelectionPanel
          count={selection.count}
          className={cn(
            "grid gap-4 rounded-2xl border bg-card p-5 sm:p-6 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto",
            hasSelection && "border-primary/40 shadow-sm",
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-display text-xl">Your booking</h3>
              <p className="text-xs text-muted-foreground">Tests and packages for this visit</p>
            </div>
            {hasSelection ? (
              <span className="grid min-w-8 place-items-center rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground" aria-label={`${selection.count} items selected`}>
                {selection.count}
              </span>
            ) : null}
          </div>
          {hasSelection ? (
            <>
              <ul className="grid gap-2 text-sm">
                {selection.packages.map((pkg) => (
                  <li key={pkg.id} className="flex items-start justify-between gap-3">
                    <span>{pkg.name}<span className="block text-xs text-muted-foreground">Package</span></span>
                    <span className="flex items-center gap-2">
                      {formatInr(pkg.pricePaise)}
                      <Link href={profileHref(state, { packages: state.packages.filter((id) => id !== pkg.id) }, "book")} scroll={false} aria-label={`Remove ${pkg.name}`} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="size-3.5" aria-hidden /></Link>
                    </span>
                  </li>
                ))}
                {selection.services.map((service) => {
                  const price = servicePrice(service, state.branchId);
                  return (
                    <li key={service.id} className="flex items-start justify-between gap-3">
                      <span>{service.name}</span>
                      <span className="flex items-center gap-2">
                        {price ? formatInr(price.final) : "—"}
                        <Link href={profileHref(state, { services: state.services.filter((id) => id !== service.id) }, "book")} scroll={false} aria-label={`Remove ${service.name}`} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="size-3.5" aria-hidden /></Link>
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="flex items-center justify-between border-t pt-3 font-medium"><span>Estimated total</span><span className="font-display text-xl">{formatInr(selection.total)}</span></p>
              <p className="text-xs text-muted-foreground">Final price is confirmed at checkout. Pick a slot to continue.</p>
            </>
          ) : (
            <div className="grid gap-3 rounded-xl border border-dashed bg-muted/30 px-4 py-5 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Your booking is empty</p>
              <p>Add tests or packages above — they will show up here with your estimated total.</p>
              <a href="#services" className={cn(buttonVariants({ variant: "outline" }), "h-9 w-fit gap-1.5 px-3")}>Browse tests<ArrowRight aria-hidden /></a>
            </div>
          )}
        </SelectionPanel>
      </div>
      <MobileBookingBar count={selection.count} totalPaise={selection.total} />
    </section>
  );
}
