import { expect, type Page } from "@playwright/test";

export const PASSWORD = "Synthetic#2026";

export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 20000 }),
    page.getByRole("button", { name: "Sign in" }).click(),
  ]);
}

/** Click a ConfirmForm trigger, then confirm in the dialog. */
export async function confirmAction(page: Page, name: string | RegExp, scope = page.locator("main")) {
  await scope.getByRole("button", { name }).first().click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name }).click();
}

export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: text }).first()).toBeVisible();
}
