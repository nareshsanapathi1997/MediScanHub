import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

const pager = (page: import("@playwright/test").Page) => page.locator("[data-pagination]");

test("public test listing pages on the server and keeps filters and view", async ({ page }, testInfo) => {
  const mobile = testInfo.project.name === "mobile";
  await page.goto("/tests?kind=LAB&view=list&size=4");
  const status = pager(page).getByText(/^Showing \d+–\d+ of \d+ results$/);
  await expect(status).toHaveText(/^Showing 1–4 of (\d+) results$/);
  const total = Number((await status.textContent())!.match(/of (\d+)/)![1]);
  expect(total).toBeGreaterThan(4);
  await expect(page.locator("[data-list-view]")).toBeVisible();
  // Page 1: Previous is disabled, Next is a real link.
  await expect(pager(page).getByRole("link", { name: "Previous page" })).toHaveCount(0);
  if (!mobile) await expect(pager(page).locator("[aria-current=page]")).toHaveText("1");
  else await expect(pager(page).getByText("Page 1 of")).toBeVisible();

  await pager(page).getByRole("link", { name: "Next page" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page).toHaveURL(/kind=LAB/);
  await expect(page).toHaveURL(/view=list/);
  await expect(pager(page).getByText(/^Showing 5–\d+ of \d+ results$/)).toBeVisible();
  await expect(page.locator("[data-list-view]")).toBeVisible();

  if (!mobile) {
    // Number links jump straight to a page.
    await pager(page).getByRole("link", { name: "Page 1" }).click();
    await expect(page).not.toHaveURL(/page=/);
    await expect(pager(page).locator("[aria-current=page]")).toHaveText("1");
  }

  // A page past the end shows the last page instead of an empty list.
  await page.goto("/tests?kind=LAB&size=4&page=99");
  const last = Math.ceil(total / 4);
  await expect(pager(page).getByText(new RegExp(`^Showing ${(last - 1) * 4 + 1}–${total} of ${total} results$`))).toBeVisible();
  await expect(pager(page).getByRole("link", { name: "Next page" })).toHaveCount(0);
});

test("centers and packages show a page summary even on one page", async ({ page }) => {
  await page.goto("/centers");
  await expect(pager(page).getByText(/^Showing 1–\d+ of \d+ centers?$/)).toBeVisible();
  await expect(pager(page).getByRole("navigation")).toHaveCount(0);
  await page.goto("/centers?size=1");
  await expect(pager(page).getByText(/^Showing 1–1 of \d+ centers$/)).toBeVisible();
  await pager(page).getByRole("link", { name: "Next page" }).click();
  await expect(pager(page).getByText(/^Showing 2–2 of \d+ centers$/)).toBeVisible();
});

test("console listings page on the server", async ({ page }) => {
  await signIn(page, "super@mediscan.test");
  await page.goto("/console/admin/users?size=3");
  await expect(pager(page).getByText(/^Showing 1–3 of \d+ users$/)).toBeVisible();
  await pager(page).getByRole("link", { name: "Next page" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(pager(page).getByText(/^Showing 4–6 of \d+ users$/)).toBeVisible();

  await signIn(page, "owner.apex@mediscan.test");
  await page.goto("/console/org/staff?size=2&view=cards");
  await expect(pager(page).getByText(/^Showing 1–2 of \d+ people$/)).toBeVisible();
  await pager(page).getByRole("link", { name: "Next page" }).click();
  await expect(page).toHaveURL(/view=cards/);
  await expect(pager(page).getByText(/^Showing 3–4 of \d+ people$/)).toBeVisible();
});
