import { randomUUID } from "crypto";
import type { ReportFileKind } from "@prisma/client";
import { withScope } from "@/lib/scope";
import { DomainError } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { assertUpload, getObject, openObjectStream, putObject, putObjectFromFile, signFileLink, signReportLink } from "@/lib/adapters/storage";
import { inspectDicomUpload } from "@/lib/dicom";
import { sha256 } from "@/lib/crypto";
import { getReport, readReportPdf } from "@/lib/services/lab";
import type { Actor } from "@/domain/actor";
import { hasPermission } from "@/domain/actor";

function isNamedReferralDoctor(actor: Actor, booking: { tenantId: string; referralUserId?: string | null }) {
  return booking.referralUserId === actor.userId && hasPermission(actor, "referrals.read", booking.tenantId);
}

/** Largest report file a center can upload. Scans and multi-page PDFs are bigger than prescriptions. */
export const REPORT_FILE_MAX_MB = 20;
export const REPORT_FILE_KINDS: ReportFileKind[] = ["LAB_REPORT", "SCAN_IMAGE", "SCAN_REPORT", "OTHER"];
/** Files can be added or removed only before a reviewer verifies the report. */
export const OPEN_FOR_FILES = new Set(["DRAFT", "ENTERED", "REJECTED"]);
const RELEASED = new Set(["RELEASED", "AMENDED"]);

type Report = Awaited<ReturnType<typeof getReport>>;

/** Lab reports: technicians and pathologists. Imaging reports: radiology staff. */
export function canManageReportFiles(actor: Actor, report: Report) {
  // samples.read keeps radiology (which also holds reports.verify) out of lab reports.
  const lab = hasPermission(actor, "samples.read", report.tenantId) && (hasPermission(actor, "results.enter", report.tenantId) || hasPermission(actor, "reports.verify", report.tenantId));
  const imaging = hasPermission(actor, "imaging.report", report.tenantId) || hasPermission(actor, "imaging.perform", report.tenantId);
  if (report.imagingOrder && !report.labOrder) return imaging;
  if (report.labOrder && !report.imagingOrder) return lab;
  return lab || imaging;
}

function assertCanManage(actor: Actor, report: Report) {
  if (!canManageReportFiles(actor, report)) throw new DomainError("FORBIDDEN", "Your role cannot add files to this report", 403);
  if (!OPEN_FOR_FILES.has(report.status)) {
    throw new DomainError("REPORT_LOCKED", "This report is already verified. Send it back or amend it before changing files.", 409);
  }
}

export async function uploadReportFile(
  actor: Actor,
  input: { reportId: string; kind: ReportFileKind; bookingItemId?: string | null; fileName: string; bytes: Buffer },
) {
  const report = await getReport(actor, input.reportId);
  assertCanManage(actor, report);
  if (!REPORT_FILE_KINDS.includes(input.kind)) throw new DomainError("UPLOAD", "Choose what kind of file this is", 400);
  const fileName = input.fileName.replace(/[\\/\r\n"]/g, "_").slice(0, 120) || "report";
  const { kind, contentType } = assertUpload(input.bytes, fileName, REPORT_FILE_MAX_MB);
  const itemId = input.bookingItemId || null;
  if (itemId && !report.booking.items.some((item) => item.id === itemId)) throw new DomainError("UPLOAD", "That test is not part of this booking", 400);
  const id = randomUUID();
  const storageKey = `tenants/${report.tenantId}/reports/${report.id}/files/${id}.${kind === "jpeg" ? "jpg" : kind}`;
  await putObject(storageKey, input.bytes, contentType);
  return withScope({ tenantId: report.tenantId, userId: actor.userId }, async (tx) => {
    const row = await tx.reportFile.create({
      data: { id, tenantId: report.tenantId, reportId: report.id, bookingItemId: itemId, kind: input.kind, fileName, contentType, sizeBytes: input.bytes.length, storageKey, checksum: sha256(input.bytes.toString("base64")), uploadedById: actor.userId },
    });
    await writeAudit(tx, { tenantId: report.tenantId, actorId: actor.userId, action: "UPLOAD", entityType: "ReportFile", entityId: id, metadata: { reportId: report.id, kind: input.kind, sizeBytes: input.bytes.length, contentType } });
    return row;
  });
}

/** Access check before a large upload is received, so a refused user never streams hundreds of MB. */
export async function assertCanUploadReportFile(actor: Actor, reportId: string) {
  const report = await getReport(actor, reportId);
  assertCanManage(actor, report);
  return report;
}

/**
 * Stores a DICOM file or a zipped DICOM study that has already been streamed to a temp file.
 * The file is checked (DICM magic or a zip holding DICOM images) and basic study facts are saved with it.
 */
export async function uploadDicomStudy(
  actor: Actor,
  input: { reportId: string; bookingItemId?: string | null; fileName: string; filePath: string; size: number; checksum: string },
) {
  const report = await assertCanUploadReportFile(actor, input.reportId);
  if (!report.imagingOrder) throw new DomainError("UPLOAD", "DICOM studies can be added only to imaging reports.", 400);
  const fileName = input.fileName.replace(/[\\/\r\n"]/g, "_").slice(0, 120) || "study.dcm";
  const { contentType, extension, meta } = await inspectDicomUpload(input.filePath, input.size, fileName);
  const itemId = input.bookingItemId || null;
  if (itemId && !report.booking.items.some((item) => item.id === itemId)) throw new DomainError("UPLOAD", "That scan is not part of this booking", 400);
  const id = randomUUID();
  const storageKey = `tenants/${report.tenantId}/reports/${report.id}/files/${id}.${extension}`;
  await putObjectFromFile(storageKey, input.filePath, contentType, input.size);
  return withScope({ tenantId: report.tenantId, userId: actor.userId }, async (tx) => {
    const row = await tx.reportFile.create({
      data: { id, tenantId: report.tenantId, reportId: report.id, bookingItemId: itemId, kind: "SCAN_IMAGE", fileName, contentType, sizeBytes: input.size, storageKey, checksum: input.checksum, dicomMeta: meta, uploadedById: actor.userId },
    });
    await writeAudit(tx, { tenantId: report.tenantId, actorId: actor.userId, action: "UPLOAD", entityType: "ReportFile", entityId: id, metadata: { reportId: report.id, kind: "SCAN_IMAGE", sizeBytes: input.size, contentType, images: meta.imageCount } });
    return row;
  });
}

export async function removeReportFile(actor: Actor, fileId: string) {
  const file = await findFile(actor, fileId);
  const report = await getReport(actor, file.reportId);
  assertCanManage(actor, report);
  await withScope({ tenantId: report.tenantId, userId: actor.userId }, async (tx) => {
    await tx.reportFile.update({ where: { id: file.id }, data: { removedAt: new Date() } });
    await writeAudit(tx, { tenantId: report.tenantId, actorId: actor.userId, action: "DELETE", entityType: "ReportFile", entityId: file.id, metadata: { reportId: report.id } });
  });
}

/** Files on a report the actor can open. Patients get files only for their own released reports. */
export async function listReportFiles(actor: Actor, reportId: string) {
  const report = await getReport(actor, reportId);
  const patientView = actor.patientId === report.booking.patientId && !canManageReportFiles(actor, report) && !hasPermission(actor, "reports.approve", report.tenantId);
  if (patientView && !RELEASED.has(report.status)) return [];
  const scope = patientView ? { userId: actor.userId, patientId: actor.patientId } : { tenantId: report.tenantId, userId: actor.userId };
  return withScope(scope, (tx) =>
    tx.reportFile.findMany({
      where: { reportId: report.id, removedAt: null },
      include: { bookingItem: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
  );
}

async function findFile(actor: Actor, fileId: string) {
  const asPatient = actor.patientId ? await withScope({ userId: actor.userId, patientId: actor.patientId }, (tx) => tx.reportFile.findFirst({ where: { id: fileId, removedAt: null } })) : null;
  if (asPatient) return asPatient;
  if (!actor.activeTenantId) throw new DomainError("NOT_FOUND", "File not found", 404);
  const row = await withScope({ tenantId: actor.activeTenantId, userId: actor.userId }, (tx) => tx.reportFile.findFirst({ where: { id: fileId, tenantId: actor.activeTenantId!, removedAt: null } }));
  if (!row) throw new DomainError("NOT_FOUND", "File not found", 404);
  return row;
}

/** Reads the bytes after re-checking access through the report: released-only for patients, own tenant for staff. */
export async function readReportFile(actor: Actor, fileId: string) {
  const file = await findFile(actor, fileId);
  const report = await getReport(actor, file.reportId);
  const staff = ["samples.read", "reports.verify", "reports.approve", "imaging.report", "imaging.perform"].some((permission) => hasPermission(actor, permission, report.tenantId));
  if (!staff && !RELEASED.has(report.status)) throw new DomainError("NOT_FOUND", "File not found", 404);
  const bytes = await getObject(file.storageKey);
  await withScope({ tenantId: report.tenantId, userId: actor.userId, patientId: actor.patientId }, (tx) =>
    writeAudit(tx, { tenantId: report.tenantId, actorId: actor.userId, action: "VIEW", entityType: "ReportFile", entityId: file.id, metadata: { reportId: report.id } }),
  );
  return { bytes, fileName: file.fileName, contentType: file.contentType };
}

/** Same checks as readReportFile, but streams the stored file (DICOM studies can be hundreds of MB). */
export async function openReportFile(actor: Actor, fileId: string) {
  const file = await findFile(actor, fileId);
  const report = await getReport(actor, file.reportId);
  const staff = ["samples.read", "reports.verify", "reports.approve", "imaging.report", "imaging.perform"].some((permission) => hasPermission(actor, permission, report.tenantId));
  if (!staff && !RELEASED.has(report.status)) throw new DomainError("NOT_FOUND", "File not found", 404);
  const { stream, size } = await openObjectStream(file.storageKey);
  await withScope({ tenantId: report.tenantId, userId: actor.userId, patientId: actor.patientId }, (tx) =>
    writeAudit(tx, { tenantId: report.tenantId, actorId: actor.userId, action: "VIEW", entityType: "ReportFile", entityId: file.id, metadata: { reportId: report.id } }),
  );
  return { stream, size, fileName: file.fileName, contentType: file.contentType };
}

/** Five-minute link for an uploaded file, issued only after the access check passes. */
export async function signedReportFileLink(actor: Actor, fileId: string) {
  const file = await findFile(actor, fileId);
  const report = await getReport(actor, file.reportId);
  const staff = ["samples.read", "reports.verify", "reports.approve", "imaging.report", "imaging.perform"].some((permission) => hasPermission(actor, permission, report.tenantId));
  if (!staff && !RELEASED.has(report.status)) throw new DomainError("NOT_FOUND", "File not found", 404);
  return `/api/v1/files/signed?file=${encodeURIComponent(signFileLink(file.id, 300))}`;
}

/** Five-minute link for the generated lab PDF. */
export async function signedReportPdfPath(actor: Actor, reportId: string) {
  const { version } = await readReportPdf(actor, reportId);
  return `/api/v1/files/signed?token=${encodeURIComponent(signReportLink(reportId, version, 300))}`;
}

/** Reports on one booking. Patients and named referral doctors get only released reports; clinical staff of the center get all. */
export async function listBookingReports(actor: Actor, booking: { id: string; tenantId: string; patientId: string; referralUserId?: string | null }) {
  const staff = actor.activeTenantId === booking.tenantId && ["samples.read", "reports.verify", "reports.approve", "imaging.report", "imaging.perform"].some((permission) => hasPermission(actor, permission, booking.tenantId));
  const include = {
    versions: { select: { version: true }, orderBy: { version: "desc" as const }, take: 1 },
    files: { where: { removedAt: null }, orderBy: { createdAt: "asc" as const }, include: { bookingItem: { select: { name: true } } } },
  };
  if (staff) {
    return withScope({ tenantId: booking.tenantId, userId: actor.userId }, (tx) => tx.medicalReport.findMany({ where: { bookingId: booking.id, tenantId: booking.tenantId }, include, orderBy: { createdAt: "asc" } }));
  }
  if (isNamedReferralDoctor(actor, booking)) {
    return withScope({ tenantId: booking.tenantId, userId: actor.userId }, (tx) =>
      tx.medicalReport.findMany({ where: { bookingId: booking.id, tenantId: booking.tenantId, status: { in: ["RELEASED", "AMENDED"] } }, include, orderBy: { createdAt: "asc" } }),
    );
  }
  if (actor.patientId !== booking.patientId) return [];
  return withScope({ userId: actor.userId, patientId: actor.patientId }, (tx) =>
    tx.medicalReport.findMany({ where: { bookingId: booking.id, booking: { patientId: actor.patientId! }, status: { in: ["RELEASED", "AMENDED"] } }, include, orderBy: { createdAt: "asc" } }),
  );
}
