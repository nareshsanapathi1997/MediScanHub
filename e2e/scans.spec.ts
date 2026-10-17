import { expect, test, type Page } from "@playwright/test";
import { confirmAction, expectToast, signIn } from "./helpers";
import { syntheticDicom, syntheticDicomZip } from "../tests/helpers/dicom";

// A CT booking from slot choice to the patient downloading the DICOM study, plus scan-room management and CSRF checks.
test.describe.configure({ mode: "serial" });

const CT_BRAIN = "80000000-0000-4000-8000-000000000012";
const JUBILEE = "40000000-0000-4000-8000-000000000001";
const ZIP = syntheticDicomZip({ series: 2, perSeries: 3, modality: "CT", bodyPart: "HEAD" });
let code = "";
let reportPath = "";
const istDay = (offset: number) => new Date(Date.now() + 5.5 * 3600e3 + offset * 864e5).toISOString().slice(0, 10);

async function csrfToken(page: Page) {
  return (await page.context().cookies()).find((cookie) => cookie.name === "ms_csrf")!.value;
}

test("patient sees CT slots with preparation, books one and pays", async ({ page, isMobile }) => {
  await signIn(page, "patient.asha@mediscan.test");
  // Day 3 has no maintenance; desktop and mobile take different ends of the list.
  await page.goto(`/centers/apex-diagnostics?branch=${JUBILEE}&service=${CT_BRAIN}&day=${istDay(3)}#book`);
  const book = page.locator("#book");
  await expect(book.getByText("Showing CT scan slots")).toBeVisible({ timeout: 20000 });
  await expect(book.getByText(/Bring your old scans/)).toBeVisible();
  // Home collection is not offered for scans.
  await expect(book.locator('select[name="visit"] option[value="HOME_COLLECTION"]')).toHaveCount(0);
  const slots = book.getByRole("link", { name: /20 min/ });
  await expect(slots.first()).toBeVisible();
  await (isMobile ? slots.last() : slots.first()).click();
  await expect(page).toHaveURL(/\/checkout/, { timeout: 20000 });
  const scan = page.getByRole("region", { name: "Scan details" });
  await expect(scan.getByText("Ground floor, Room 4", { exact: false })).toBeVisible();
  await expect(scan.getByText(/CT Brain \(plain\): No fasting needed/)).toBeVisible();
  await page.getByLabel(/I agree that this center/).check();
  await page.getByRole("button", { name: /Create booking/ }).click();
  await expect(page).toHaveURL(/\/bookings\/[0-9a-f-]{36}$/, { timeout: 20000 });
  code = (await page.getByRole("heading", { level: 1 }).textContent())!.trim();
  await expect(page.getByRole("heading", { name: "Before your scan" })).toBeVisible();
  await expect(page.getByText(/CT scan in Ground floor, Room 4/)).toBeVisible();
  await page.getByRole("button", { name: /Pay .* and confirm/ }).click();
  await expect(page).toHaveURL(/paid=1/, { timeout: 20000 });
});

test("radiology scans the patient, uploads the DICOM study and releases the report", async ({ page }) => {
  await signIn(page, "radio.apex@mediscan.test");
  await page.goto("/console/imaging");
  const order = page.locator("article", { hasText: code });
  await expect(order.getByText(/Slot: .* CT scan · CT 128-slice, Ground floor, Room 4/)).toBeVisible();
  await order.getByRole("button", { name: "Check in" }).click();
  await expectToast(page, "Imaging updated.");
  // Wait for the reload to show the new state before the next click (the old toast can still be on screen).
  await expect(order.getByRole("button", { name: "Check in" })).toHaveCount(0, { timeout: 15000 });
  await order.getByRole("button", { name: "Mark acquired" }).click();
  await expect(order.getByRole("button", { name: "Mark acquired" })).toHaveCount(0, { timeout: 15000 });
  await expect(order.getByText(/ACQUIRED/)).toBeVisible();
  await page.locator("article", { hasText: code }).getByRole("link", { name: /Open report and upload files/ }).click();
  await expect(page).toHaveURL(/\/console\/lab\/reports\//, { timeout: 15000 });
  reportPath = new URL(page.url()).pathname;

  const dicom = page.getByRole("form", { name: "Upload DICOM study" });
  await dicom.locator('input[type="file"]').setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("not dicom") });
  await dicom.getByRole("button", { name: "Upload DICOM" }).click();
  await expect(dicom.getByRole("alert")).toContainText(/Only DICOM files/);
  await dicom.locator('input[type="file"]').setInputFiles({ name: "ct-brain-study.zip", mimeType: "application/zip", buffer: ZIP });
  await dicom.getByRole("button", { name: "Upload DICOM" }).click();
  await expectToast(page, /DICOM study uploaded\. 6 image\(s\) in 2 series/);
  const files = page.locator("section", { has: page.getByRole("heading", { name: "Report files" }) });
  await expect(files.getByText(/DICOM study \(zip\) · CT · study date 12 Oct 2026 · head · 2 series · 6 images/)).toBeVisible();

  // CSRF: a cookie-authenticated DELETE or upload without the token, or from another origin, is refused.
  const token = await csrfToken(page);
  const reportId = reportPath.split("/").pop()!;
  const put = (headers: Record<string, string>) =>
    page.request.put(`/api/v1/uploads/dicom?reportId=${reportId}&name=extra.dcm`, { headers: { "content-type": "application/octet-stream", ...headers }, data: syntheticDicom() });
  expect((await put({})).status()).toBe(403);
  expect((await put({ "x-csrf-token": token, origin: "https://evil.example" })).status()).toBe(403);
  expect((await put({ "x-csrf-token": token, "sec-fetch-site": "cross-site" })).status()).toBe(403);
  const created = await put({ "x-csrf-token": token });
  expect(created.status()).toBe(201);
  const extra = (await created.json()).data as { id: string; dicom: { imageCount: number } };
  expect(extra.dicom.imageCount).toBe(1);
  expect((await page.request.delete(`/api/v1/report-files/${extra.id}`)).status()).toBe(403);
  const cross = await page.request.delete(`/api/v1/report-files/${extra.id}`, { headers: { "x-csrf-token": token, origin: "https://evil.example" } });
  expect(cross.status()).toBe(403);
  expect((await cross.json()).error.code).toBe("CSRF_ORIGIN");
  expect((await page.request.delete(`/api/v1/report-files/${extra.id}`, { headers: { "x-csrf-token": "forged" } })).status()).toBe(403);
  expect((await page.request.delete(`/api/v1/report-files/${extra.id}`, { headers: { "x-csrf-token": token } })).status()).toBe(200);

  await page.reload();
  await confirmAction(page, "Submit for verification");
  await expectToast(page, "Report updated.");
  await confirmAction(page, "Verify");
  await expectToast(page, "Report updated.");
  await confirmAction(page, "Approve");
  await expectToast(page, "Report updated.");
  await confirmAction(page, "Release to patient");
  await expectToast(page, "Report updated.");
});

test("patient downloads the original DICOM study; nobody else can", async ({ page }) => {
  await signIn(page, "patient.asha@mediscan.test");
  await page.goto("/console/patient/reports");
  const article = page.locator("article", { hasText: code });
  await expect(article.getByText(/DICOM study \(zip\) · CT · study date 12 Oct 2026/)).toBeVisible();
  const href = await article.getByRole("link", { name: /Download ct-brain-study.zip/ }).getAttribute("href");
  const redirect = await page.request.get(href!, { maxRedirects: 0 });
  expect(redirect.status()).toBe(302);
  expect(redirect.headers()["location"]).toContain("/api/v1/files/signed?file=");
  const response = await page.request.get(href!);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("application/zip");
  expect(response.headers()["content-disposition"]).toContain("attachment");
  expect(Buffer.from(await response.body()).equals(ZIP)).toBe(true);

  await signIn(page, "patient.ravi@mediscan.test");
  expect((await page.request.get(href!)).status()).toBe(404);
  expect((await page.request.get(redirect.headers()["location"]!)).status()).toBe(404);
  await signIn(page, "owner.nimbus@mediscan.test");
  expect((await page.request.get(redirect.headers()["location"]!)).status()).toBe(404);
});

test("radiographer adds a shift, maintenance and slots in the scan rooms page", async ({ page, isMobile }) => {
  test.skip(isMobile, "Runs once: both projects share one database.");
  await signIn(page, "radio3.apex@mediscan.test");
  await page.goto("/console/imaging/rooms");
  await expect(page.getByRole("heading", { level: 1, name: "Scan rooms" })).toBeVisible();
  const xr = page.locator("section", { has: page.getByRole("heading", { name: "Digital X-ray (DR) · X-ray" }) });
  await expect(xr.getByText(/Synth Radiographer Farah Khan/).first()).toBeVisible();
  const day = istDay(9);
  const slotsForm = xr.locator("form", { has: page.getByRole("heading", { name: "Create slots" }) });
  await slotsForm.getByLabel("Date").fill(day);
  await slotsForm.getByRole("button", { name: "Create slots" }).click();
  await expectToast(page, /No technician is on shift/);

  const shift = page.locator("section", { has: page.getByRole("heading", { name: "Digital X-ray (DR) · X-ray" }) }).locator("form", { has: page.getByRole("heading", { name: "Add a technician shift" }) });
  await shift.getByLabel("Date").fill(day);
  await shift.getByLabel("From").fill("08:00");
  await shift.getByLabel("To").fill("12:00");
  await shift.getByRole("button", { name: "Add shift" }).click();
  await expectToast(page, "Shift added.");

  const again = page.locator("section", { has: page.getByRole("heading", { name: "Digital X-ray (DR) · X-ray" }) }).locator("form", { has: page.getByRole("heading", { name: "Create slots" }) });
  await again.getByLabel("Date").fill(day);
  await again.getByLabel("From").fill("09:00");
  await again.getByLabel("To").fill("10:00");
  await again.getByRole("button", { name: "Create slots" }).click();
  await expectToast(page, "6 scan slot(s) created.");

  const block = page.locator("section", { has: page.getByRole("heading", { name: "Digital X-ray (DR) · X-ray" }) }).locator("form", { has: page.getByRole("heading", { name: "Block for maintenance" }) });
  await block.getByLabel("Date").fill(istDay(1));
  await block.getByLabel("From").fill("10:00");
  await block.getByLabel("To").fill("10:30");
  await block.getByLabel("Reason").fill("Detector calibration");
  await block.getByRole("button", { name: "Add block" }).click();
  await expectToast(page, /Maintenance block added/);
  await expect(page.getByText(/Detector calibration/).first()).toBeVisible();
});
