import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

async function toggle(page: Page, to: "Card view" | "List view") {
  const group = page.getByRole("group", { name: "View" });
  await group.getByRole("button", { name: to }).click();
  await expect(group.getByRole("button", { name: to })).toHaveAttribute("aria-pressed", "true");
}

test("public listings switch between cards and list, and remember the choice", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/tests");
  const group = page.getByRole("group", { name: "View" });
  await expect(group.getByRole("button", { name: "Card view" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-list-view]")).toHaveCount(0);

  await toggle(page, "List view");
  await expect(page).toHaveURL(/view=list/);
  await expect(page.locator("[data-list-view]")).toBeVisible();
  await expect(page.getByRole("link", { name: /^Book Complete Blood Count/ }).first()).toBeVisible();

  // Remembered without the URL param (cookie, read on the server, so no flash).
  await page.goto("/tests");
  await expect(page.locator("[data-list-view]")).toBeVisible();
  await expect(group.getByRole("button", { name: "List view" })).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => window.localStorage.getItem("ms_view_tests"))).toBe("list");

  // Remembered per page: packages still opens as cards.
  await page.goto("/packages");
  await expect(page.getByRole("group", { name: "View" }).getByRole("button", { name: "Card view" })).toHaveAttribute("aria-pressed", "true");
  await toggle(page, "List view");
  await expect(page.locator("[data-list-view]")).toBeVisible();

  // Keyboard: Space on the focused segment switches back.
  await page.goto("/tests");
  await group.getByRole("button", { name: "Card view" }).focus();
  await page.keyboard.press(" ");
  await expect(page).toHaveURL(/view=cards/);
  await expect(page.locator("[data-list-view]")).toHaveCount(0);

  // Filters survive a view switch.
  await page.goto("/centers?city=Hyderabad");
  await toggle(page, "List view");
  await expect(page).toHaveURL(/city=Hyderabad/);
  await expect(page.getByRole("link", { name: "Apex Diagnostics" }).first()).toBeVisible();
});

test("console listings have the same toggle", async ({ page }) => {
  await signIn(page, "owner.apex@mediscan.test");
  await page.goto("/console/org/packages");
  await toggle(page, "List view");
  await expect(page.locator("[data-list-view]")).toBeVisible();
  await toggle(page, "Card view");
  await expect(page.locator("[data-list-view]")).toHaveCount(0);

  await signIn(page, "super@mediscan.test");
  await page.goto("/console/admin/centers");
  await toggle(page, "List view");
  await expect(page.locator("[data-list-view]")).toBeVisible();
  await expect(page.locator("[data-list-view] :text('Nimbus Labs'):visible").first()).toBeVisible();
});
