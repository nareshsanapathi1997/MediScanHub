import { describe, expect, it } from "vitest";
import { ID } from "../prisma/ids";
import { loadActor } from "@/lib/services/auth";
import { prismaPrivileged } from "@/lib/db";
import { putObject, readFileLink } from "@/lib/adapters/storage";
import { listReportFiles, readReportFile, removeReportFile, signedReportFileLink, uploadReportFile } from "@/lib/services/report-files";

const actor = (userId: string, tenantId: string | null) => loadActor(userId, tenantId, null);
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);
const pdf = Buffer.from("%PDF-1.4\n% synthetic scan report\n%%EOF\n");

async function reportFor(bookingId: string) {
  return prismaPrivileged.medicalReport.findFirstOrThrow({ where: { bookingId } });
}

describe("report file upload and download", () => {
  it("validates type, size and name before storing anything", async () => {
    const tech = await actor(ID.techApex, ID.apex);
    const report = await reportFor(ID.bookingAsha); // lab report, not yet verified
    const base = { reportId: report.id, kind: "LAB_REPORT" as const };
    await expect(uploadReportFile(tech, { ...base, fileName: "notes.txt", bytes: Buffer.from("plain text") })).rejects.toMatchObject({ status: 400, code: "UPLOAD" });
    await expect(uploadReportFile(tech, { ...base, fileName: "empty.pdf", bytes: Buffer.alloc(0) })).rejects.toMatchObject({ status: 400 });
    await expect(uploadReportFile(tech, { ...base, fileName: "scan.pdf", bytes: png })).rejects.toMatchObject({ status: 400 });
    await expect(uploadReportFile(tech, { ...base, fileName: "huge.pdf", bytes: Buffer.concat([pdf, Buffer.alloc(21 * 1024 * 1024)]) })).rejects.toMatchObject({ status: 400 });
    const item = await prismaPrivileged.bookingItem.findFirstOrThrow({ where: { bookingId: ID.bookingAsha } });
    const other = await prismaPrivileged.bookingItem.findFirstOrThrow({ where: { bookingId: { not: ID.bookingAsha } } });
    await expect(uploadReportFile(tech, { ...base, bookingItemId: other.id, fileName: "cbc.png", bytes: png })).rejects.toMatchObject({ status: 400 });
    const row = await uploadReportFile(tech, { ...base, bookingItemId: item.id, fileName: "cbc-printout.png", bytes: png });
    expect(row).toMatchObject({ contentType: "image/png", sizeBytes: png.length, bookingItemId: item.id });
    expect(row.storageKey).toContain(`tenants/${ID.apex}/reports/${report.id}/files/`);
    const audit = await prismaPrivileged.auditLog.findFirst({ where: { entityType: "ReportFile", entityId: row.id, action: "UPLOAD" } });
    expect(audit?.actorId).toBe(ID.techApex);
  });

  it("lets only the right staff of the same center upload", async () => {
    const report = await reportFor(ID.bookingAsha);
    const input = { reportId: report.id, kind: "LAB_REPORT" as const, fileName: "a.pdf", bytes: pdf };
    await expect(uploadReportFile(await actor(ID.radioApex, ID.apex), input)).rejects.toMatchObject({ status: 403 });
    await expect(uploadReportFile(await actor(ID.accountsApex, ID.apex), input)).rejects.toMatchObject({ status: 404 });
    await expect(uploadReportFile(await actor(ID.ownerNimbus, ID.nimbus), input)).rejects.toMatchObject({ status: 404 });
    await expect(uploadReportFile(await actor(ID.asha, null), input)).rejects.toMatchObject({ status: 404 });
  });

  it("keeps unreleased files from the patient and from other centers", async () => {
    const tech = await actor(ID.techApex, ID.apex);
    const report = await reportFor(ID.bookingAsha);
    const row = await uploadReportFile(tech, { reportId: report.id, kind: "OTHER", fileName: "draft.pdf", bytes: pdf });
    const staffCopy = await readReportFile(await actor(ID.pathApex, ID.apex), row.id);
    expect(staffCopy.bytes.subarray(0, 4).toString()).toBe("%PDF");
    await expect(readReportFile(await actor(ID.asha, null), row.id)).rejects.toMatchObject({ status: 404 });
    await expect(signedReportFileLink(await actor(ID.asha, null), row.id)).rejects.toMatchObject({ status: 404 });
    await expect(readReportFile(await actor(ID.ravi, null), row.id)).rejects.toMatchObject({ status: 404 });
    await expect(readReportFile(await actor(ID.ownerNimbus, ID.nimbus), row.id)).rejects.toMatchObject({ status: 404 });
    await removeReportFile(tech, row.id);
    await expect(readReportFile(tech, row.id)).rejects.toMatchObject({ status: 404 });
  });

  it("lets the patient download their own released file through a signed link, and nobody else", async () => {
    const report = await reportFor(ID.bookingMeera); // released
    // Released reports are locked for new uploads.
    await expect(uploadReportFile(await actor(ID.techApex, ID.apex), { reportId: report.id, kind: "LAB_REPORT", fileName: "late.pdf", bytes: pdf })).rejects.toMatchObject({ status: 409, code: "REPORT_LOCKED" });
    // A file uploaded before release (inserted directly, as the upload path is now locked).
    const key = `tenants/${ID.apex}/reports/${report.id}/files/test-released.pdf`;
    await putObject(key, pdf, "application/pdf");
    const file = await prismaPrivileged.reportFile.create({
      data: { tenantId: ID.apex, reportId: report.id, kind: "SCAN_REPORT", fileName: "usg-report.pdf", contentType: "application/pdf", sizeBytes: pdf.length, storageKey: key, checksum: "x", uploadedById: ID.radioApex },
    });
    const meera = await actor(ID.meera, null);
    const listed = await listReportFiles(meera, report.id);
    expect(listed.map((item) => item.id)).toContain(file.id);
    const path = await signedReportFileLink(meera, file.id);
    const token = decodeURIComponent(path.split("file=")[1]!);
    expect(readFileLink(token).fileId).toBe(file.id);
    const download = await readReportFile(meera, file.id);
    expect(download).toMatchObject({ fileName: "usg-report.pdf", contentType: "application/pdf" });
    const viewed = await prismaPrivileged.auditLog.findFirst({ where: { entityType: "ReportFile", entityId: file.id, action: "VIEW", actorId: ID.meera } });
    expect(viewed).not.toBeNull();
    await expect(readReportFile(await actor(ID.asha, null), file.id)).rejects.toMatchObject({ status: 404 });
    await expect(readReportFile(await actor(ID.ownerNimbus, ID.nimbus), file.id)).rejects.toMatchObject({ status: 404 });
    expect(() => readFileLink(token.slice(0, -2) + "xx")).toThrow();
  });
});
