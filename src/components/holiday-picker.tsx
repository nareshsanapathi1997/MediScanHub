"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormBoxState } from "@/components/form-box";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

const MONTH = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
const CHIP = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const iso = (year: number, month: number, day: number) => new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
const todayIst = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
const asDate = (value: string) => new Date(`${value}T00:00:00Z`);

/** Month calendar for picking closed dates. Submits a comma-separated YYYY-MM-DD list in a hidden input. */
export function HolidayPicker({ name = "holidays", defaultValue = [], label = "Holidays (closed dates)" }: { name?: string; defaultValue?: string[]; label?: string }) {
  const [today] = useState(todayIst);
  const [dates, setDates] = useState<string[]>(() => [...new Set(defaultValue)].sort());
  const [view, setView] = useState(() => {
    const start = defaultValue.filter((date) => date >= today).sort()[0] ?? today;
    const [year, month] = start.split("-").map(Number);
    return { year: year!, month: month! - 1 };
  });
  const cells = useMemo(() => {
    const lead = (new Date(Date.UTC(view.year, view.month, 1)).getUTCDay() + 6) % 7;
    const count = new Date(Date.UTC(view.year, view.month + 1, 0)).getUTCDate();
    return [...Array.from({ length: lead }, () => null), ...Array.from({ length: count }, (_, index) => iso(view.year, view.month, index + 1))];
  }, [view]);
  const toggle = (date: string) => setDates((current) => (current.includes(date) ? current.filter((item) => item !== date) : [...current, date].sort()));
  const move = (step: number) => setView(({ year, month }) => {
    const next = new Date(Date.UTC(year, month + step, 1));
    return { year: next.getUTCFullYear(), month: next.getUTCMonth() };
  });
  // Inside a FormBox, clear the picks after a successful save (the browser resets the other fields itself).
  const formState = useFormBoxState();
  const initial = defaultValue.join(",");
  useEffect(() => {
    if (formState.idle || formState.error) return;
    setDates(initial ? initial.split(",") : []);
  }, [formState, initial]);
  const upcoming = dates.filter((date) => date >= today);
  const past = dates.length - upcoming.length;
  return (
    <div className="@container grid gap-2" role="group" aria-label={label}>
      <span className="text-sm font-medium">{label}</span>
      <input type="hidden" name={name} value={dates.join(",")} />
      <div className="grid gap-4 @lg:grid-cols-[17rem_1fr]">
        <div className="max-w-[17rem] rounded-xl border bg-background p-3">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => move(-1)} className="grid size-8 place-items-center rounded-lg hover:bg-muted" aria-label="Previous month"><ChevronLeft className="size-4" /></button>
            <span className="text-sm font-medium" aria-live="polite">{MONTH.format(new Date(Date.UTC(view.year, view.month, 1)))}</span>
            <button type="button" onClick={() => move(1)} className="grid size-8 place-items-center rounded-lg hover:bg-muted" aria-label="Next month"><ChevronRight className="size-4" /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">{DAYS.map((day) => <span key={day}>{day}</span>)}</div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((date, index) => {
              if (!date) return <span key={`blank-${index}`} />;
              const picked = dates.includes(date);
              const isPast = date < today;
              return (
                <button key={date} type="button" onClick={() => toggle(date)} disabled={isPast && !picked} aria-pressed={picked} aria-label={`${CHIP.format(asDate(date))}${picked ? ", closed" : ""}`}
                  className={cn("grid aspect-square place-items-center rounded-lg text-xs tabular-nums transition-colors",
                    picked ? "bg-destructive font-semibold text-white" : isPast ? "text-muted-foreground/40" : "hover:bg-muted",
                    date === today && !picked && "ring-1 ring-primary")}>
                  {Number(date.slice(8))}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid content-start gap-2">
          <p className="text-xs text-muted-foreground">Tap a date to mark the branch closed. Tap again to undo.</p>
          {upcoming.length === 0 ? <p className="text-sm text-muted-foreground">No upcoming holidays.</p> : (
            <ul className="flex flex-wrap gap-1.5">
              {upcoming.map((date) => (
                <li key={date} className="inline-flex items-center gap-1 rounded-full bg-destructive/10 py-1 pr-1 pl-2.5 text-xs font-medium text-destructive">
                  {CHIP.format(asDate(date))}
                  <button type="button" onClick={() => toggle(date)} className="grid size-5 place-items-center rounded-full hover:bg-destructive/20" aria-label={`Remove ${CHIP.format(asDate(date))}`}><X className="size-3" /></button>
                </li>
              ))}
            </ul>
          )}
          {past > 0 ? <p className="text-xs text-muted-foreground">{past} past date{past === 1 ? "" : "s"} kept for records.</p> : null}
        </div>
      </div>
    </div>
  );
}
