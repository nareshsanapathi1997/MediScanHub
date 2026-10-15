import { type Page } from "@playwright/test";

export async function signIn(page: Page, email: string, password = "Synthetic#2026") {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 20000 }),
    page.getByRole("button", { name: "Sign in" }).click(),
  ]);
}
