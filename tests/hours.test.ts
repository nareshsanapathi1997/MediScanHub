import { describe, expect, it } from "vitest";
import { hoursRows, openStatus, parseHolidays, parseWeekForm, todayRange, weekPlan } from "@/lib/hours";

const weekday = { opensAt: "07:00", closesAt: "20:00" };
const jubilee = { opensAt: "07:00", closesAt: "20:00", weeklyHours: [{ opensAt: "08:00", closesAt: "14:00" }, weekday, weekday, weekday, weekday, weekday, weekday], holidays: ["2026-10-20"] };
const gachibowli = { opensAt: "07:00", closesAt: "20:00", weeklyHours: [null, weekday, weekday, weekday, weekday, weekday, weekday], holidays: [] };
const ist = (value: string) => new Date(`${value}+05:30`);

describe("opening hours", () => {
  it("falls back to daily hours without a weekly plan", () => {
    expect(weekPlan({ opensAt: "09:00", closesAt: "18:00" })).toEqual(Array(7).fill({ opensAt: "09:00", closesAt: "18:00" }));
  });

  it("uses Sunday hours on Sunday", () => {
    expect(openStatus([jubilee], ist("2026-10-18T13:00:00"))).toEqual({ open: true, label: "Open now · until 2:00 PM" });
    expect(openStatus([jubilee], ist("2026-10-18T15:00:00"))).toEqual({ open: false, label: "Closed · opens 7:00 AM tomorrow" });
    expect(openStatus([gachibowli], ist("2026-10-18T10:00:00"))).toEqual({ open: false, label: "Closed · opens 7:00 AM tomorrow" });
  });

  it("treats holidays as closed and finds the next open day", () => {
    expect(openStatus([jubilee], ist("2026-10-20T10:00:00")).open).toBe(false);
    expect(openStatus([jubilee], ist("2026-10-19T21:00:00")).label).toBe("Closed · opens 7:00 AM Wednesday");
    expect(todayRange([jubilee], ist("2026-10-20T10:00:00"))).toBeNull();
  });

  it("is open across branches when any branch is open", () => {
    expect(openStatus([gachibowli, jubilee], ist("2026-10-18T09:00:00")).open).toBe(true);
    expect(openStatus([], new Date()).label).toBe("Hours not listed");
  });

  it("groups days for the hours table", () => {
    expect(hoursRows(jubilee).map((row) => `${row.label}: ${row.text}`)).toEqual(["Mon – Sat: 7:00 AM – 8:00 PM", "Sun: 8:00 AM – 2:00 PM"]);
    expect(hoursRows(gachibowli).at(-1)?.text).toBe("Closed");
  });

  it("validates console input", () => {
    const fields: Record<string, string> = { "day-0-closed": "on" };
    for (let day = 1; day < 7; day += 1) Object.assign(fields, { [`day-${day}-open`]: "07:00", [`day-${day}-close`]: "20:00" });
    expect(parseWeekForm((name) => fields[name] ?? null)[0]).toBeNull();
    fields["day-3-close"] = "06:00";
    expect(() => parseWeekForm((name) => fields[name] ?? null)).toThrow(/Wednesday/);
    expect(parseHolidays("2026-11-08, 2026-10-20 2026-10-20")).toEqual(["2026-10-20", "2026-11-08"]);
    expect(() => parseHolidays("20 Oct")).toThrow(/YYYY-MM-DD/);
  });
});
