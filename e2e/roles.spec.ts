import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("center owner sees org overview", async ({ page }) => {
  await signIn(page, "owner.apex@mediscan.test");
  await page.goto("/console/org");
  await expect(page.getByRole("heading", { name: "Apex Diagnostics" })).toBeVisible();
});

test("patient sees inbox and family", async ({ page }) => {
  await signIn(page, "patient.asha@mediscan.test");
  await page.goto("/console/patient/notifications");
  await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
  await page.goto("/console/patient/family");
  await expect(page.getByRole("heading", { name: "Dependents" })).toBeVisible();
});

test("super admin sees platform desk", async ({ page }) => {
  await signIn(page, "super@mediscan.test");
  await page.goto("/console/admin");
  await expect(page.getByRole("heading", { name: /Network at a glance/i })).toBeVisible();
});

test("referral doctor desk without tenant switch", async ({ page }) => {
  await signIn(page, "doctor.rao@mediscan.test");
  await page.goto("/console/doctor");
  await expect(page.getByRole("heading", { name: /Patients who named you/i })).toBeVisible();
});

test("compare centers page loads", async ({ page }) => {
  await page.goto("/centers/compare");
  await expect(page.getByRole("heading", { name: "Compare centers" })).toBeVisible();
});
