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
  await expect(page.getByRole("heading", { name: "Family members", exact: true })).toBeVisible();
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

const desks: Array<{ email: string; home: RegExp; heading: RegExp; locked: string }> = [
  { email: "super@mediscan.test", home: /\/console\/admin$/, heading: /Network at a glance/, locked: "/console/finance" },
  { email: "owner.apex@mediscan.test", home: /\/console\/org$/, heading: /Apex Diagnostics/, locked: "/console/admin/users" },
  { email: "manager.apex@mediscan.test", home: /\/console/, heading: /./, locked: "/console/admin" },
  { email: "desk.apex@mediscan.test", home: /\/console/, heading: /./, locked: "/console/lab" },
  { email: "phleb.apex@mediscan.test", home: /\/console/, heading: /./, locked: "/console/finance" },
  { email: "tech.apex@mediscan.test", home: /\/console\/lab$/, heading: /Samples and reports/, locked: "/console/org/staff" },
  { email: "path.apex@mediscan.test", home: /\/console/, heading: /./, locked: "/console/finance" },
  { email: "radio.apex@mediscan.test", home: /\/console/, heading: /./, locked: "/console/lab" },
  { email: "accounts.apex@mediscan.test", home: /\/console/, heading: /./, locked: "/console/lab" },
  { email: "doctor.rao@mediscan.test", home: /\/console/, heading: /./, locked: "/console/desk" },
  { email: "patient.asha@mediscan.test", home: /\/console\/patient$/, heading: /Hello, Asha/, locked: "/console/org/bookings" },
];

for (const desk of desks) {
  test(`${desk.email} lands on its desk and is locked out of ${desk.locked}`, async ({ page }) => {
    await signIn(page, desk.email);
    await expect(page).toHaveURL(desk.home);
    await expect(page.getByRole("heading", { level: 1 }).first()).toHaveText(desk.heading);
    await page.goto(desk.locked);
    await expect(page.getByRole("heading", { level: 1, name: "This desk is locked" })).toBeVisible();
  });
}

test("a patient cannot open another patient's booking or report", async ({ page }) => {
  await signIn(page, "patient.ravi@mediscan.test");
  const booking = await page.goto("/bookings/90000000-0000-4000-8000-000000000001");
  // The page streams, so notFound() may arrive after a 200 header; assert on content instead.
  expect([200, 404]).toContain(booking?.status());
  await expect(page.getByText("MS-ASHA01")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("That page is not on this desk");
  const api = await page.request.get("/api/v1/bookings/90000000-0000-4000-8000-000000000001");
  expect(api.status()).toBe(404);
});

const APEX_TENANT = "30000000-0000-4000-8000-000000000001";
const NIMBUS_TENANT = "30000000-0000-4000-8000-000000000002";

async function readJson(page: import("@playwright/test").Page, path: string) {
  const res = await page.request.get(path);
  expect(res.status(), `${path} should answer 200`).toBe(200);
  return res.text();
}

test("another center's owner cannot read Apex records through the API", async ({ page }) => {
  await signIn(page, "owner.nimbus@mediscan.test");
  expect((await page.request.get("/api/v1/bookings/90000000-0000-4000-8000-000000000001")).status()).toBe(404);
  // Lists answer 200 with only Nimbus data: bookings, samples, reports, patients (via bookings and the export).
  const bookings = await readJson(page, "/api/v1/bookings");
  expect(bookings).toContain("MS-NIMB01");
  for (const body of [bookings, await readJson(page, "/api/v1/samples"), await readJson(page, "/api/v1/reports"), await readJson(page, "/api/v1/exports/bookings")]) {
    expect(body).not.toContain("MS-ASHA01");
    expect(body).not.toContain(APEX_TENANT);
    expect(body.toLowerCase()).not.toContain("asha"); // an Apex-only patient
  }
});

test("an Apex owner cannot read Nimbus records through the API", async ({ page }) => {
  await signIn(page, "owner.apex@mediscan.test");
  for (const path of ["/api/v1/bookings", "/api/v1/samples", "/api/v1/reports", "/api/v1/exports/bookings"]) {
    const body = await readJson(page, path);
    expect(body).not.toContain("MS-NIMB01");
    expect(body).not.toContain(NIMBUS_TENANT);
  }
});
