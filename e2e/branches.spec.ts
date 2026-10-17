import { expect, test } from "@playwright/test";
import { expectToast, signIn } from "./helpers";

const chip = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const istToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

/** "10 Nov 2026"-style label for a day in the month after the current IST month. */
function nextMonthLabel(day: number) {
  const [year, month] = istToday().split("-").map(Number);
  return chip.format(new Date(Date.UTC(year!, month!, day)));
}

test("owner adds a branch with per-day hours and holidays picked on the calendar", async ({ page }, testInfo) => {
  const suffix = `${testInfo.project.name === "mobile" ? "M" : "C"}${Date.now().toString(36).slice(-3).toUpperCase()}`;
  const name = `E2E Branch ${suffix}`;
  await signIn(page, "owner.apex@mediscan.test");
  await page.goto("/console/org/branches");
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Add branch" }) });
  await form.getByLabel("Name").fill(name);
  await form.getByLabel("Short code").fill(suffix.slice(0, 6));
  await form.getByLabel("City").fill("Hyderabad");
  await form.getByLabel("State").fill("Telangana");
  await form.getByLabel("Phone").fill("+914040009999");
  await form.getByLabel("Address").fill("Synthetic test address, Kondapur");
  await form.getByLabel("Saturday closes").fill("18:00");
  await form.getByLabel("Sunday closed").check();

  const calendar = form.getByRole("group", { name: "Holidays (closed dates)" });
  // Past dates cannot be picked.
  const today = istToday();
  if (Number(today.slice(8)) > 1) {
    const first = chip.format(new Date(`${today.slice(0, 8)}01T00:00:00Z`));
    await expect(calendar.getByRole("button", { name: first, exact: true })).toBeDisabled();
  }
  await calendar.getByRole("button", { name: "Next month" }).click();
  const keep = nextMonthLabel(10);
  const drop = nextMonthLabel(12);
  await calendar.getByRole("button", { name: keep, exact: true }).click();
  await calendar.getByRole("button", { name: drop, exact: true }).click();
  await expect(calendar.getByRole("button", { name: `${keep}, closed` })).toHaveAttribute("aria-pressed", "true");
  // Remove one with its chip, and toggle one off and on again on the calendar.
  await calendar.getByRole("button", { name: `Remove ${drop}` }).click();
  await expect(calendar.getByRole("button", { name: `Remove ${drop}` })).toHaveCount(0);
  await calendar.getByRole("button", { name: `${keep}, closed` }).click();
  await expect(calendar.getByRole("button", { name: `Remove ${keep}` })).toHaveCount(0);
  await calendar.getByRole("button", { name: keep, exact: true }).click();
  await expect(calendar.getByRole("button", { name: `Remove ${keep}` })).toBeVisible();

  await form.getByRole("button", { name: "Add branch" }).click();
  await expectToast(page, "Saved.");
  // The picker clears after a successful save.
  await expect(calendar.getByRole("button", { name: `Remove ${keep}` })).toHaveCount(0);
  await expect(form.locator('input[name="holidays"]')).toHaveValue("");

  // The page reloads itself to show the new branch.
  await expect(page.getByRole("heading", { name, level: 2 })).toBeVisible({ timeout: 15000 });
  await page.waitForLoadState("load");
  const card = page.locator("form").filter({ has: page.getByRole("heading", { name }) });
  await expect(card.getByLabel("Saturday closes")).toHaveValue("18:00");
  await expect(card.getByLabel("Monday opens")).toHaveValue("07:00");
  await expect(card.getByLabel("Sunday closed")).toBeChecked();
  await expect(card.getByRole("button", { name: `Remove ${keep}` })).toBeVisible();
});
