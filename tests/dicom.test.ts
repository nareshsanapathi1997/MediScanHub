import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { ID } from "../prisma/ids";
import { loadActor } from "@/lib/services/auth";
import { prismaPrivileged } from "@/lib/db";
import { createBooking, transitionBooking } from "@/lib/services/booking";
import { hasDicomMagic, inspectDicomUpload, readDicomHeader } from "@/lib/dicom";
import { listReportFiles, openReportFile, readReportFile, signedReportFileLink, uploadDicomStudy } from "@/lib/services/report-files";
import { syntheticDicom, syntheticDicomZip } from "./helpers/dicom";

const actor = (userId: string, tenantId: string | null) => loadActor(userId, tenantId, null);

async function onDisk(name: string, bytes: Buffer) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "dicom-test-"));
  const file = path.join(dir, name);
  await writeFile(file, bytes);
  return { filePath: file, size: bytes.length, fileName: name, checksum: "test" };
}

/** Books and confirms an ultrasound for Ravi, which opens an imaging report in DRAFT. */
async function openImagingReport() {
  const equipment = await prismaPrivileged.equipment.findFirstOrThrow({ where: { branchId: ID.jubilee, modality: "US" } });
  const slot = await prismaPrivileged.availabilitySlot.findFirstOrThrow({ where: { equipmentId: equipment.id, bookedCount: 0, startsAt: { gt: new Date(Date.now() + 3600_000) } }, orderBy: { startsAt: "desc" } });
  const created = await createBooking(await actor(ID.ravi, null), { branchId: ID.jubilee, slotId: slot.id, serviceIds: [ID.usg], packageIds: [], visitType: "CENTER_VISIT", idempotencyKey: `dicom-${Date.now()}-${Math.random()}` });
  await transitionBooking(await actor(ID.ownerApex, ID.apex), created.bookingId, "CONFIRMED", "Paid at desk (test)");
  return prismaPrivileged.medicalReport.findFirstOrThrow({ where: { bookingId: created.bookingId, imagingOrderId: { not: null } }, include: { booking: true } });
}

describe("DICOM checks", () => {
  it("reads only safe study facts from a .dcm header", async () => {
    const dcm = syntheticDicom({ modality: "CT", studyDate: "20261012", bodyPart: "HEAD" });
    expect(hasDicomMagic(dcm)).toBe(true);
    expect(readDicomHeader(dcm)).toMatchObject({ modality: "CT", studyDate: "2026-10-12", bodyPart: "HEAD" });
    const { contentType, meta } = await inspectDicomUpload((await onDisk("head.dcm", dcm)).filePath, dcm.length, "head.dcm");
    expect(contentType).toBe("application/dicom");
    expect(meta).toEqual({ format: "dcm", modalities: ["CT"], studyDate: "2026-10-12", bodyParts: ["HEAD"], studyCount: 1, seriesCount: 1, imageCount: 1, otherFiles: 0 });
    expect(JSON.stringify(meta)).not.toMatch(/SYNTHETIC|SYN-000123|1\.2\.826/);
  });

  it("counts series and images in a zipped study and ignores DICOMDIR", async () => {
    const zip = syntheticDicomZip({ series: 3, perSeries: 4, extra: { "README.txt": Buffer.from("synthetic") } });
    const { contentType, meta } = await inspectDicomUpload((await onDisk("knee.zip", zip)).filePath, zip.length, "knee.zip");
    expect(contentType).toBe("application/zip");
    expect(meta).toMatchObject({ format: "zip", modalities: ["MR"], seriesCount: 3, imageCount: 12, otherFiles: 1, bodyParts: ["KNEE"] });
  });

  it("refuses files that are not DICOM, empty zips, wrong names and oversize uploads", async () => {
    const fake = Buffer.concat([Buffer.alloc(128), Buffer.from("NOPE"), Buffer.alloc(200)]);
    await expect(inspectDicomUpload((await onDisk("fake.dcm", fake)).filePath, fake.length, "fake.dcm")).rejects.toMatchObject({ status: 400, code: "UPLOAD" });
    const pdf = Buffer.from("%PDF-1.4 synthetic");
    await expect(inspectDicomUpload((await onDisk("a.dcm", pdf)).filePath, pdf.length, "a.dcm")).rejects.toMatchObject({ status: 400 });
    const empty = syntheticDicomZip({ series: 0, extra: { "notes.txt": Buffer.from("x") } });
    await expect(inspectDicomUpload((await onDisk("empty.zip", empty)).filePath, empty.length, "empty.zip")).rejects.toThrow(/no DICOM images/);
    const dcm = syntheticDicom();
    await expect(inspectDicomUpload((await onDisk("scan.pdf", dcm)).filePath, dcm.length, "scan.pdf")).rejects.toThrow(/\.dcm/);
    await expect(inspectDicomUpload((await onDisk("big.dcm", dcm)).filePath, 501 * 1024 * 1024, "big.dcm")).rejects.toMatchObject({ status: 413 });
    const broken = Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5]);
    await expect(inspectDicomUpload((await onDisk("broken.zip", broken)).filePath, broken.length, "broken.zip")).rejects.toMatchObject({ status: 400 });
  });
});

describe("DICOM upload and download", () => {
  it("lets radiology upload a study, keeps it from the patient until release, then lets only that patient download the original", async () => {
    const report = await openImagingReport();
    const radio = await actor(ID.radioApex, ID.apex);
    const zip = syntheticDicomZip({ series: 2, perSeries: 2, modality: "US" });
    const row = await uploadDicomStudy(radio, { reportId: report.id, ...(await onDisk("usg-study.zip", zip)) });
    expect(row).toMatchObject({ kind: "SCAN_IMAGE", contentType: "application/zip", sizeBytes: zip.length });
    expect(row.dicomMeta).toMatchObject({ modalities: ["US"], seriesCount: 2, imageCount: 4 });
    // Lab staff and other centers cannot add DICOM to an imaging report.
    await expect(uploadDicomStudy(await actor(ID.techApex, ID.apex), { reportId: report.id, ...(await onDisk("x.dcm", syntheticDicom())) })).rejects.toMatchObject({ status: 403 });
    await expect(uploadDicomStudy(await actor(ID.ownerNimbus, ID.nimbus), { reportId: report.id, ...(await onDisk("x.dcm", syntheticDicom())) })).rejects.toMatchObject({ status: 404 });
    // DICOM only goes on imaging reports.
    const lab = await prismaPrivileged.medicalReport.findFirstOrThrow({ where: { bookingId: ID.bookingAsha, labOrderId: { not: null } } });
    await expect(uploadDicomStudy(await actor(ID.pathApex, ID.apex), { reportId: lab.id, ...(await onDisk("x.dcm", syntheticDicom())) })).rejects.toMatchObject({ status: 400 });

    const owner = await prismaPrivileged.patient.findUniqueOrThrow({ where: { id: report.booking.patientId } });
    const patient = await actor(owner.userId, null);
    await expect(readReportFile(patient, row.id)).rejects.toMatchObject({ status: 404 });
    expect(await listReportFiles(patient, report.id).catch(() => [])).toHaveLength(0);

    await prismaPrivileged.medicalReport.update({ where: { id: report.id }, data: { status: "RELEASED", releasedAt: new Date() } });
    try {
      expect((await listReportFiles(patient, report.id)).map((file) => file.id)).toContain(row.id);
      expect(await signedReportFileLink(patient, row.id)).toContain("/api/v1/files/signed?file=");
      const opened = await openReportFile(patient, row.id);
      expect(opened).toMatchObject({ contentType: "application/zip", size: zip.length, fileName: "usg-study.zip" });
      const downloaded = Buffer.from(await new Response(opened.stream).arrayBuffer());
      expect(downloaded.equals(zip)).toBe(true);
      const someoneElse = owner.userId === ID.asha ? ID.meera : ID.asha;
      await expect(readReportFile(await actor(someoneElse, null), row.id)).rejects.toMatchObject({ status: 404 });
      await expect(openReportFile(await actor(ID.ownerNimbus, ID.nimbus), row.id)).rejects.toMatchObject({ status: 404 });
    } finally {
      await prismaPrivileged.medicalReport.update({ where: { id: report.id }, data: { status: report.status, releasedAt: report.releasedAt } });
    }
  });
});
