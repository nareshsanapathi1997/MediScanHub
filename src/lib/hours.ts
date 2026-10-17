import { DomainError } from "@/lib/errors";
/** Weekday-aware opening hours. All times are IST "HH:MM"; weekday 0 is Sunday. */
export type DayHours = { opensAt: string; closesAt: string } | null;
export type HoursSource = { opensAt: string; closesAt: string; weeklyHours?: unknown; holidays?: string[] | null };

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

const IST_PARTS = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false });
const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function istNow(now = new Date()) {
  const parts = Object.fromEntries(IST_PARTS.formatToParts(now).map((part) => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, clock: `${parts.hour}:${parts.minute}`.replace(/^24/, "00"), weekday: SHORT.indexOf(parts.weekday) };
}

function validDay(value: unknown): DayHours | undefined {
  if (value === null) return null;
  if (!value || typeof value !== "object") return undefined;
  const { opensAt, closesAt } = value as Record<string, unknown>;
  if (typeof opensAt !== "string" || typeof closesAt !== "string" || !CLOCK.test(opensAt) || !CLOCK.test(closesAt) || opensAt >= closesAt) return undefined;
  return { opensAt, closesAt };
}

/** Seven days, Sunday first. Falls back to the daily hours when no weekly plan is stored. */
export function weekPlan(branch: HoursSource): DayHours[] {
  const daily = validDay({ opensAt: branch.opensAt, closesAt: branch.closesAt }) ?? null;
  const stored = Array.isArray(branch.weeklyHours) && branch.weeklyHours.length === 7 ? branch.weeklyHours : null;
  return Array.from({ length: 7 }, (_, day) => {
    if (!stored) return daily;
    const value = validDay(stored[day]);
    return value === undefined ? daily : value;
  });
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** Hours that apply on a given IST date, honouring holidays. */
export function hoursOn(branch: HoursSource, date: string, weekday: number): DayHours {
  if (branch.holidays?.includes(date)) return null;
  return weekPlan(branch)[weekday] ?? null;
}

export function formatClock(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  if (hour === undefined || Number.isNaN(hour)) return value;
  return `${hour % 12 || 12}:${String(minute ?? 0).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}

export type OpenStatus = { open: boolean; label: string };

/** Open-now status for one or more branches at the given instant. */
export function openStatus(branches: HoursSource[], now = new Date()): OpenStatus {
  if (branches.length === 0) return { open: false, label: "Hours not listed" };
  const today = istNow(now);
  const openNow = branches
    .map((branch) => hoursOn(branch, today.date, today.weekday))
    .filter((hours): hours is NonNullable<DayHours> => !!hours && hours.opensAt <= today.clock && today.clock < hours.closesAt)
    .sort((a, b) => b.closesAt.localeCompare(a.closesAt))[0];
  if (openNow) return { open: true, label: `Open now · until ${formatClock(openNow.closesAt)}` };
  for (let offset = 0; offset < 8; offset += 1) {
    const date = addDays(today.date, offset);
    const weekday = (today.weekday + offset) % 7;
    const next = branches
      .map((branch) => hoursOn(branch, date, weekday))
      .filter((hours): hours is NonNullable<DayHours> => !!hours && (offset > 0 || hours.opensAt > today.clock))
      .map((hours) => hours.opensAt)
      .sort()[0];
    if (next) {
      const when = offset === 0 ? "" : offset === 1 ? " tomorrow" : ` ${WEEKDAYS[weekday]}`;
      return { open: false, label: `Closed · opens ${formatClock(next)}${when}` };
    }
  }
  return { open: false, label: "Closed" };
}

/** Rows for an hours table: consecutive days with the same hours are grouped ("Mon – Sat"). */
export function hoursRows(branch: HoursSource) {
  const plan = weekPlan(branch);
  const order = [1, 2, 3, 4, 5, 6, 0];
  const rows: Array<{ days: number[]; hours: DayHours }> = [];
  for (const day of order) {
    const hours = plan[day] ?? null;
    const last = rows.at(-1);
    if (last && JSON.stringify(last.hours) === JSON.stringify(hours)) last.days.push(day);
    else rows.push({ days: [day], hours });
  }
  return rows.map(({ days, hours }) => ({
    days,
    label: days.length > 2 ? `${SHORT[days[0]!]} – ${SHORT[days.at(-1)!]}` : days.map((day) => SHORT[day]).join(", "),
    text: hours ? `${formatClock(hours.opensAt)} – ${formatClock(hours.closesAt)}` : "Closed",
  }));
}

/** Upcoming holidays, soonest first. */
export function upcomingHolidays(branch: HoursSource, now = new Date()) {
  const today = istNow(now).date;
  return [...(branch.holidays ?? [])].filter((date) => date >= today).sort();
}

/** Parses the console form: day-N-open / day-N-close / day-N-closed fields. */
export function parseWeekForm(get: (name: string) => string | null): DayHours[] {
  return Array.from({ length: 7 }, (_, day) => {
    if (get(`day-${day}-closed`) === "on") return null;
    const hours = validDay({ opensAt: get(`day-${day}-open`) ?? "", closesAt: get(`day-${day}-close`) ?? "" });
    if (!hours) throw new DomainError("HOURS", `Check the hours for ${WEEKDAYS[day]}: use HH:MM and close after opening.`, 400);
    return hours;
  });
}

export function parseHolidays(value: string) {
  const dates = value.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean);
  for (const date of dates) if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T00:00:00Z`).getTime())) throw new DomainError("HOURS", `"${date}" is not a date. Use YYYY-MM-DD.`, 400);
  return [...new Set(dates)].sort();
}

/** Earliest opening to latest closing across branches for today's IST date, or null if all are closed. */
export function todayRange(branches: HoursSource[], now = new Date()) {
  const today = istNow(now);
  const hours = branches.map((branch) => hoursOn(branch, today.date, today.weekday)).filter((item): item is NonNullable<DayHours> => !!item);
  if (hours.length === 0) return null;
  return { opensAt: hours.map((item) => item.opensAt).sort()[0]!, closesAt: hours.map((item) => item.closesAt).sort().at(-1)! };
}
