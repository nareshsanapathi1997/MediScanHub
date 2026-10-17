import { expect, test } from "@playwright/test";
import { confirmAction, expectToast, signIn } from "./helpers";

// One booking travels through every desk: patient → reception → lab technician → pathologist → patient.
test.describe.configure({ mode: "serial" });

let bookingUrl = "";
let code = "";
let reportUrl = "";
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(256, 7)]);

test("patient books a CBC, pays, and the visit is confirmed", async ({ page, isMobile }) => {
  await signIn(page, "patient.ravi@mediscan.test");
  await page.goto("/centers/apex-diagnostics?branch=40000000-0000-4000-8000-000000000001");
  await expect(page.getByRole("heading", { level: 1, name: "Apex Diagnostics" })).toBeVisible();
  const cbc = page.locator("li").filter({ has: page.getByRole("heading", { name: "Complete Blood Count" }) });
  await cbc.getByRole("link", { name: /^Add Complete Blood Count/ }).click();
  await expect(page).toHaveURL(/service=[0-9a-f]/, { timeout: 15000 });
  await expect(cbc.getByRole("link", { name: /Added/ })).toBeVisible({ timeout: 15000 });
  const selected = new URL(page.url());
  const book = page.locator("#book");
  // Pick the first upcoming IST day with an open center slot.
  for (const offset of [0, 1, 2, 3, 4]) {
    await expect(page.locator("#selection-panel").getByText("Estimated total")).toBeVisible();
    if (await book.getByRole("link", { name: /left/ }).count()) break;
    const day = new Date(Date.now() + 5.5 * 3600e3 + (offset + 1) * 864e5).toISOString().slice(0, 10);
    selected.searchParams.set("day", day);
    await page.goto(selected.pathname + selected.search);
  }
  // Desktop and mobile run in parallel; take different slots so they do not race for one seat.
  const open = book.getByRole("link", { name: /left/ });
  await (isMobile ? open.last() : open.first()).click();
  await expect(page).toHaveURL(/\/checkout/, { timeout: 20000 });
  await expect(page.getByRole("heading", { name: "Confirm the visit" })).toBeVisible();

  await page.getByLabel(/I agree that this center/).check();
  await page.getByRole("button", { name: /Create booking/ }).click();
  await expect(page).toHaveURL(/\/bookings\/[0-9a-f-]{36}$/, { timeout: 20000 });
  code = (await page.getByRole("heading", { level: 1 }).textContent())!.trim();
  expect(code).toMatch(/^MS-/);
  await page.getByRole("button", { name: /Pay .* and confirm/ }).click();
  await expect(page).toHaveURL(/paid=1/, { timeout: 20000 });
  await expect(page.getByText(/Payment captured/).first()).toBeVisible();
  await expect(page.getByText("Confirmed").first()).toBeVisible();
  bookingUrl = page.url().replace(/\?.*$/, "").replace(/.*\/bookings\//, "/console/org/bookings/");
});

test("reception checks the patient in and starts the visit", async ({ page }) => {
  await signIn(page, "desk.apex@mediscan.test");
  await page.goto(`/console/org/bookings?q=${code}`);
  await page.getByRole("link", { name: code }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: code })).toBeVisible();
  await expect(page.getByRole("button", { name: "Complete visit" })).toHaveCount(0);
  await confirmAction(page, "Check in");
  await expectToast(page, "Booking updated.");
  await confirmAction(page, "Start visit");
  await expectToast(page, "Booking updated.");
  await expect(page.getByText("In Progress").first()).toBeVisible();
  // Completing before the report is released is refused with a message, not an error page.
  await confirmAction(page, "Complete visit");
  await expectToast(page, "Release every report before completing the visit");
});

test("technician moves the sample through the lab and enters every result", async ({ page }) => {
  await signIn(page, "tech.apex@mediscan.test");
  await page.goto(bookingUrl);
  await page.locator("main").getByRole("link", { name: /^BC/ }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Complete Blood Count" })).toBeVisible();
  for (const step of ["Mark collected", "Receive in lab", "Start processing"]) {
    await confirmAction(page, step);
    await expectToast(page, "Sample updated.");
  }
  // Resulting without values is refused.
  await confirmAction(page, "Mark resulted");
  await expectToast(page, /before marking the sample resulted/);
  const inputs = page.locator('input[name^="n:"]');
  await expect(inputs.first()).toBeVisible();
  const count = await inputs.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) await inputs.nth(index).fill(index === 0 ? "13.4" : "7.1");
  await page.getByRole("button", { name: "Save results" }).click();
  await expectToast(page, "Results saved");
  await confirmAction(page, "Mark resulted");
  await expectToast(page, "Sample updated.");

  await page.goto("/console/lab");
  await page.getByPlaceholder("Search booking or patient").fill(code);
  await page.getByRole("link", { name: code }).click();
  await expect(page).toHaveURL(/\/console\/lab\/reports\//, { timeout: 15000 });
  await confirmAction(page, "Submit for verification");
  await expectToast(page, "Report updated.");
  // Maker-checker: the person who entered results cannot verify them.
  await expect(page.getByRole("button", { name: "Verify" })).toHaveCount(0);

  // Upload the analyser printout. A text file is refused first.
  const files = page.locator("section", { has: page.getByRole("heading", { name: "Report files" }) });
  await files.locator('input[type="file"]').setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("not a report") });
  await files.getByRole("button", { name: "Upload file" }).click();
  await expectToast(page, /Only PDF, PNG and JPEG/);
  await files.locator('input[type="file"]').setInputFiles({ name: "cbc-printout.png", mimeType: "image/png", buffer: PNG });
  await files.getByRole("button", { name: "Upload file" }).click();
  await expectToast(page, /File uploaded/);
  await expect(files.getByText("cbc-printout.png", { exact: true }).first()).toBeVisible();
  reportUrl = new URL(page.url()).pathname;
});

test("pathologist verifies, approves, and releases the report", async ({ page }) => {
  await signIn(page, "path.apex@mediscan.test");
  await page.goto("/console/lab");
  await page.getByPlaceholder("Search booking or patient").fill(code);
  await page.getByRole("link", { name: code }).click();
  await expect(page).toHaveURL(/\/console\/lab\/reports\//, { timeout: 15000 });
  await expect(page.getByRole("heading", { level: 1, name: "Laboratory report" })).toBeVisible();
  await confirmAction(page, "Send back");
  // The browser refuses the empty required reason, so nothing is submitted.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).toBeHidden();
  await expect(page.getByText("Entered").first()).toBeVisible(); // required reason blocks the empty send-back
  await confirmAction(page, "Verify");
  await expectToast(page, "Report updated.");
  await confirmAction(page, "Approve");
  await expectToast(page, "Report updated.");
  await confirmAction(page, "Release to patient");
  await expectToast(page, "Report updated.");
  await expect(page.getByRole("link", { name: "Download PDF" })).toBeVisible();
});

test("patient sees the released report and can download the PDF", async ({ page }) => {
  await signIn(page, "patient.ravi@mediscan.test");
  await page.goto("/console/patient/reports");
  const row = page.locator("main").getByText(code).first();
  await expect(row).toBeVisible();
  const article = page.locator("article", { hasText: code });
  const pdfHref = await article.getByRole("link", { name: /Download report PDF/ }).getAttribute("href");
  // /open checks access, then redirects to a five-minute signed link.
  const redirect = await page.request.get(pdfHref!, { maxRedirects: 0 });
  expect(redirect.status()).toBe(302);
  expect(redirect.headers()["location"]).toContain("/api/v1/files/signed?token=");
  const response = await page.request.get(pdfHref!);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/pdf");
  await expect(article.getByText("cbc-printout.png", { exact: true }).first()).toBeVisible();
  const fileHref = await article.getByRole("link", { name: /Open cbc-printout.png/ }).getAttribute("href");
  const image = await page.request.get(fileHref!);
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toBe("image/png");

  // Another patient cannot open the same links.
  await signIn(page, "patient.asha@mediscan.test");
  expect((await page.request.get(fileHref!)).status()).toBe(404);
  expect((await page.request.get(pdfHref!)).status()).toBe(404);
  await page.goto(reportUrl);
  await expect(page.getByRole("heading", { name: "This desk is locked" })).toBeVisible();
});
