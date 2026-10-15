import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("directory, sign-in, and patient desk", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "The calm desk for a busy lab." })).toBeVisible();
  await page.getByRole("link", { name: "Centers" }).first().click();
  await expect(page.getByRole("heading", { name: "Diagnostic centers" })).toBeVisible();
  await signIn(page, "patient.asha@mediscan.test");
  await page.goto("/console/patient");
  await expect(page.getByRole("heading", { name: /Hello, Synth/i })).toBeVisible();
  await page.getByRole("link", { name: "Reports" }).first().click();
  await expect(page.getByRole("heading", { name: "Released reports" })).toBeVisible();
});

test("locked desk without a session", async ({ page }) => {
  await page.goto("/console/admin");
  await expect(page).toHaveURL(/\/login/);
});
