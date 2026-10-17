import { WEEKDAYS, type DayHours } from "@/lib/hours";
import { cn } from "@/lib/utils";

const ORDER = [1, 2, 3, 4, 5, 6, 0];
const input = "h-9 min-w-0 rounded-md border bg-background px-2 text-sm";

/** Seven rows of open/close times with a Closed checkbox. Field names match parseWeekForm. */
export function WeekHoursFields({ idPrefix, plan, compact = false }: { idPrefix: string; plan: DayHours[]; compact?: boolean }) {
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-2 text-sm font-medium">Weekly hours</legend>
      {ORDER.map((day) => {
        const hours = plan[day];
        const name = WEEKDAYS[day];
        return (
          <div key={day} className={cn("grid items-center gap-2 rounded-lg px-1 py-1 text-sm odd:bg-muted/40", compact ? "grid-cols-[2.5rem_1fr_1fr_auto]" : "grid-cols-[6.5rem_1fr_1fr] sm:grid-cols-[7rem_9rem_9rem_auto]")}>
            <span className="font-medium">{compact ? name.slice(0, 3) : name}</span>
            <label className="sr-only" htmlFor={`${idPrefix}-${day}-open`}>{name} opens</label>
            <input id={`${idPrefix}-${day}-open`} className={input} type="time" name={`day-${day}-open`} defaultValue={hours?.opensAt ?? "07:00"} />
            <label className="sr-only" htmlFor={`${idPrefix}-${day}-close`}>{name} closes</label>
            <input id={`${idPrefix}-${day}-close`} className={input} type="time" name={`day-${day}-close`} defaultValue={hours?.closesAt ?? "20:00"} />
            <label className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", !compact && "col-span-3 sm:col-span-1")}>
              <input type="checkbox" name={`day-${day}-closed`} defaultChecked={!hours} className="size-4 accent-[var(--primary)]" aria-label={`${name} closed`} />
              {compact ? <span aria-hidden>Off</span> : <span aria-hidden>Closed</span>}
            </label>
          </div>
        );
      })}
    </fieldset>
  );
}
