import { prismaPrivileged } from "@/lib/db";
import { withScope } from "@/lib/scope";
import { DomainError } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { getObject, putObject } from "@/lib/adapters/storage";
import { renderReportPdf } from "@/lib/pdf";
import { sha256 } from "@/lib/crypto";
import { enqueue } from "@/lib/services/notify";
import { getEnv } from "@/lib/env";
import type { Actor } from "@/domain/actor";
import { assertPermission, hasPermission } from "@/domain/actor";
import { REPORT_TRANSITIONS, SAMPLE_TRANSITIONS, assertTransition, permissionForReportTransition, permissionForSampleTransition } from "@/domain/state";
import type { ReportStatus, ResultFlag, SampleStatus } from "@prisma/client";
import { userPublicSelect } from "@/lib/user-public";

function scopeOf(actor: Actor) {
  const tenantId = actor.activeTenantId;
  if (!tenantId) throw new DomainError("TENANT_REQUIRED", "Choose a center first", 400);
  return { tenantId, userId: actor.userId, patientId: actor.patientId };
}

function ageYears(dob: Date) {
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const month = now.getUTCMonth() - dob.getUTCMonth();
  if (month < 0 || (month === 0 && now.getUTCDate() < dob.getUTCDate())) age -= 1;
  return age;
}

function flagValue(value: number, range: { low: unknown; high: unknown; criticalLow: unknown; criticalHigh: unknown } | null): ResultFlag | null {
  if (!range) return null;
  const low = range.low == null ? null : Number(range.low);
  const high = range.high == null ? null : Number(range.high);
  const criticalLow = range.criticalLow == null ? null : Number(range.criticalLow);
  const criticalHigh = range.criticalHigh == null ? null : Number(range.criticalHigh);
  if (criticalLow != null && value < criticalLow) return "CRITICAL";
  if (criticalHigh != null && value > criticalHigh) return "CRITICAL";
  if (low != null && value < low) return "LOW";
  if (high != null && value > high) return "HIGH";
  return "NORMAL";
}

export async function listSamples(actor: Actor, status?: SampleStatus) {
  const scope = scopeOf(actor);
  assertPermission(actor, "samples.read", scope.tenantId);
  return withScope(scope, (tx) =>
    tx.sample.findMany({
      where: { tenantId: scope.tenantId, ...(status ? { status } : {}) },
      include: { barcode: true, service: true, assignee: { select: { id: true, name: true } }, labOrder: { include: { booking: { include: { patient: { include: { user: { select: userPublicSelect } } }, branch: true } } } }, results: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  );
}

export async function getSample(actor: Actor, id: string) {
  const scope = scopeOf(actor);
  assertPermission(actor, "samples.read", scope.tenantId);
  const sample = await withScope(scope, (tx) =>
    tx.sample.findFirst({
      where: { id, tenantId: scope.tenantId },
      include: {
        barcode: true,
        events: { orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true } } } },
        service: { include: { parameters: { orderBy: { position: "asc" }, include: { ranges: true } } } },
        results: true,
        assignee: { select: { id: true, name: true } },
        labOrder: { include: { booking: { include: { patient: { include: { user: { select: { name: true } } } }, branch: true } }, reports: { select: { id: true, status: true } } } },
      },
    }),
  );
  if (!sample) throw new DomainError("NOT_FOUND", "Sample not found", 404);
  return sample;
}

export async function transitionSample(actor: Actor, sampleId: string, to: SampleStatus, reason?: string) {
  const sample = await getSample(actor, sampleId);
  if (to === "REJECTED" || to === "RECOLLECTION") {
    const allowed = hasPermission(actor, "samples.collect", sample.tenantId) || hasPermission(actor, "results.enter", sample.tenantId);
    if (!allowed) throw new DomainError("FORBIDDEN", "You do not have permission to do that", 403);
  } else {
    assertPermission(actor, permissionForSampleTransition(to), sample.tenantId);
  }
  assertTransition(SAMPLE_TRANSITIONS, sample.status, to, "Sample");
  if ((to === "REJECTED" || to === "RECOLLECTION") && !reason?.trim()) {
    throw new DomainError("REASON", "A reason is required when a sample is rejected", 400);
  }
  if (to === "RESULTED") {
    const entered = new Set(sample.results.filter((result) => result.status !== "DRAFT").map((result) => result.parameterId));
    const missing = sample.service.parameters.filter((parameter) => !entered.has(parameter.id));
    if (missing.length > 0) throw new DomainError("RESULT", `Enter ${missing.map((item) => item.name).join(", ")} before marking the sample resulted`, 409);
  }
  return withScope(scopeOf(actor), async (tx) => {
    const updated = await tx.sample.update({
      where: { id: sample.id },
      data: {
        status: to,
        rejectionReason: to === "REJECTED" ? reason : to === "PENDING" ? null : sample.rejectionReason,
        collectedAt: to === "COLLECTED" ? new Date() : sample.collectedAt,
        receivedAt: to === "RECEIVED" ? new Date() : sample.receivedAt,
      },
    });
    await tx.sampleEvent.create({ data: { tenantId: sample.tenantId, sampleId: sample.id, type: to, actorId: actor.userId, note: reason } });
    if (to === "RESULTED") {
      const siblings = await tx.sample.findMany({ where: { labOrderId: sample.labOrderId, tenantId: sample.tenantId } });
      if (siblings.every((item) => item.status === "RESULTED" || item.id === sample.id)) {
        await tx.labOrder.update({ where: { id: sample.labOrderId }, data: { status: "RESULTED" } });
      }
    }
    await writeAudit(tx, { tenantId: sample.tenantId, actorId: actor.userId, action: "UPDATE", entityType: "Sample", entityId: sample.id, metadata: { to, reason } });
    return updated;
  });
}

export async function listTechnicians(actor: Actor) {
  const scope = scopeOf(actor);
  const allowed = hasPermission(actor, "results.enter", scope.tenantId) || hasPermission(actor, "samples.read", scope.tenantId);
  if (!allowed) throw new DomainError("FORBIDDEN", "You do not have permission to do that", 403);
  return withScope(scope, (tx) =>
    tx.tenantMembership.findMany({
      where: { tenantId: scope.tenantId, status: "ACTIVE", role: { key: { in: ["LAB_TECHNICIAN", "PATHOLOGIST"] } } },
      include: { user: { select: userPublicSelect }, role: { select: { key: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
  );
}

export async function assignSampleTechnician(actor: Actor, sampleId: string, assigneeId: string) {
  const sample = await getSample(actor, sampleId);
  assertPermission(actor, "results.enter", sample.tenantId);
  return withScope(scopeOf(actor), async (tx) => {
    const member = await tx.tenantMembership.findFirst({
      where: {
        userId: assigneeId,
        tenantId: sample.tenantId,
        status: "ACTIVE",
        role: { key: { in: ["LAB_TECHNICIAN", "PATHOLOGIST"] } },
      },
    });
    if (!member) throw new DomainError("NOT_FOUND", "That person is not a technician at this center", 404);
    const updated = await tx.sample.update({ where: { id: sample.id }, data: { assigneeId } });
    await tx.sampleEvent.create({
      data: { tenantId: sample.tenantId, sampleId: sample.id, type: "ASSIGNED", actorId: actor.userId, note: "Technician assigned" },
    });
    await writeAudit(tx, { tenantId: sample.tenantId, actorId: actor.userId, action: "UPDATE", entityType: "Sample", entityId: sample.id, metadata: { assigneeId } });
    return { id: updated.id, assigneeId: updated.assigneeId };
  });
}

export async function enterResults(
  actor: Actor,
  sampleId: string,
  values: Array<{ parameterId: string; numericValue?: number; textValue?: string; structured?: Record<string, string> }>,
) {
  const sample = await getSample(actor, sampleId);
  assertPermission(actor, "results.enter", sample.tenantId);
  if (!["PROCESSING", "RESULTED"].includes(sample.status)) {
    throw new DomainError("INVALID_TRANSITION", "Receive and start processing the sample before entering results", 409);
  }
  const locked = await withScope(scopeOf(actor), (tx) => tx.medicalReport.findFirst({ where: { tenantId: sample.tenantId, labOrderId: sample.labOrderId, status: { in: ["VERIFIED", "APPROVED", "RELEASED"] } }, select: { status: true } }));
  if (locked) throw new DomainError("REPORT_LOCKED", `The report is ${locked.status.toLowerCase()}. Send it back or amend it before changing results.`, 409);
  const patient = sample.labOrder.booking.patient;
  const age = ageYears(patient.dateOfBirth);
  return withScope(scopeOf(actor), async (tx) => {
    const saved = [];
    for (const value of values) {
      const parameter = sample.service.parameters.find((item) => item.id === value.parameterId);
      if (!parameter) throw new DomainError("PARAMETER", "Unknown parameter for this test", 400);
      const range = parameter.ranges.find((item) => {
        const sexOk = !item.sex || item.sex === patient.sex;
        const minOk = item.ageMinYears == null || age >= item.ageMinYears;
        const maxOk = item.ageMaxYears == null || age <= item.ageMaxYears;
        return sexOk && minOk && maxOk;
      }) ?? parameter.ranges[0] ?? null;
      let flag: ResultFlag | null = null;
      if (parameter.resultType === "NUMERIC") {
        if (value.numericValue == null || Number.isNaN(value.numericValue)) throw new DomainError("RESULT", `${parameter.name} needs a numeric value`, 400);
        flag = flagValue(value.numericValue, range);
      } else if (parameter.resultType === "QUALITATIVE") {
        if (!value.textValue?.trim()) throw new DomainError("RESULT", `${parameter.name} needs a text value`, 400);
        flag = range?.textValue && value.textValue.trim().toLowerCase() === range.textValue.toLowerCase() ? "NORMAL" : range?.textValue ? "ABNORMAL" : null;
      } else if (!value.structured && !value.textValue) {
        throw new DomainError("RESULT", `${parameter.name} needs a structured value`, 400);
      }
      const row = await tx.labResult.upsert({
        where: { sampleId_parameterId: { sampleId: sample.id, parameterId: parameter.id } },
        update: { numericValue: value.numericValue, textValue: value.textValue, structured: value.structured, flag, status: "ENTERED", enteredById: actor.userId, enteredAt: new Date() },
        create: {
          tenantId: sample.tenantId,
          sampleId: sample.id,
          parameterId: parameter.id,
          numericValue: value.numericValue,
          textValue: value.textValue,
          structured: value.structured,
          flag,
          status: "ENTERED",
          enteredById: actor.userId,
          enteredAt: new Date(),
        },
      });
      saved.push(row);
    }
    await tx.sampleEvent.create({ data: { tenantId: sample.tenantId, sampleId: sample.id, type: "RESULTS_ENTERED", actorId: actor.userId, note: `${saved.length} parameter(s)` } });
    await writeAudit(tx, { tenantId: sample.tenantId, actorId: actor.userId, action: "UPDATE", entityType: "LabResult", entityId: sample.id, metadata: { count: saved.length } });
    return saved;
  });
}

async function loadReport(actor: Actor, id: string) {
  if (actor.patientId) {
    const own = await withScope({ userId: actor.userId, patientId: actor.patientId }, (tx) =>
      tx.medicalReport.findFirst({
        // Patients only ever see released reports; an unreleased one is "not found", same as under RLS.
        where: { id, booking: { patientId: actor.patientId! }, status: { in: ["RELEASED", "AMENDED"] } },
        include: reportInclude,
      }),
    );
    if (own) return own;
    const staffElsewhere = Boolean(actor.activeTenantId) && ["samples.read", "reports.verify", "reports.approve", "reports.release", "imaging.report"].some((permission) => hasPermission(actor, permission, actor.activeTenantId));
    if (!staffElsewhere) throw new DomainError("NOT_FOUND", "Report not found", 404);
  }
  const scope = scopeOf(actor);
  const allowed = ["samples.read", "reports.verify", "reports.approve", "reports.release", "imaging.report"].some((permission) => hasPermission(actor, permission, scope.tenantId));
  if (!allowed) throw new DomainError("NOT_FOUND", "Report not found", 404);
  const report = await withScope(scope, (tx) => tx.medicalReport.findFirst({ where: { id, tenantId: scope.tenantId }, include: reportInclude }));
  if (!report) throw new DomainError("NOT_FOUND", "Report not found", 404);
  return report;
}

const reportInclude = {
  approvals: { orderBy: { createdAt: "asc" as const }, include: { approver: { select: { name: true } } } },
  versions: { orderBy: { version: "desc" as const } },
  files: { where: { removedAt: null }, orderBy: { createdAt: "asc" as const }, include: { bookingItem: { select: { name: true } } } },
  booking: { include: { patient: { include: { user: { select: userPublicSelect } } }, branch: true, tenant: true, items: true } },
  labOrder: { include: { samples: { include: { service: { include: { parameters: { select: { id: true, name: true } } } }, results: { include: { parameter: { include: { ranges: true } } } } } } } },
  imagingOrder: { include: { studies: { include: { service: true } } } },
};

export async function getReport(actor: Actor, id: string) {
  return loadReport(actor, id);
}

export async function listReports(actor: Actor, status?: ReportStatus) {
  if (actor.patientId && !actor.activeTenantId) {
    return withScope({ userId: actor.userId, patientId: actor.patientId }, (tx) =>
      tx.medicalReport.findMany({
        where: { booking: { patientId: actor.patientId! }, status: status ?? { in: ["RELEASED", "AMENDED"] } },
        include: reportInclude,
        orderBy: { updatedAt: "desc" },
      }),
    );
  }
  const scope = scopeOf(actor);
  const allowed = ["samples.read", "reports.approve", "imaging.report"].some((permission) => hasPermission(actor, permission, scope.tenantId));
  if (!allowed) throw new DomainError("FORBIDDEN", "You do not have permission to do that", 403);
  return withScope(scope, (tx) =>
    tx.medicalReport.findMany({
      where: { tenantId: scope.tenantId, ...(status ? { status } : {}) },
      include: reportInclude,
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
  );
}

function reportRows(report: Awaited<ReturnType<typeof loadReport>>) {
  const rows: Array<{ name: string; value: string; unit: string; range: string; flag: string }> = [];
  for (const sample of report.labOrder?.samples ?? []) {
    for (const result of sample.results) {
      if (result.status === "DRAFT") continue;
      const range = result.parameter.ranges[0];
      const rangeText = range?.textValue ?? (range?.low != null || range?.high != null ? `${range?.low ?? ""} – ${range?.high ?? ""}` : "—");
      rows.push({
        name: `${sample.service.name}: ${result.parameter.name}`,
        value: result.numericValue != null ? String(result.numericValue) : result.textValue ?? "Structured",
        unit: result.parameter.unit ?? "",
        range: rangeText,
        flag: result.flag ?? "—",
      });
    }
  }
  if (report.imagingOrder) {
    const narrative = [...report.approvals].reverse().find((approval) => approval.comment)?.comment;
    rows.push({ name: report.imagingOrder.modality, value: narrative || "See signatory note", unit: "", range: "—", flag: "—" });
  }
  return rows;
}

export async function transitionReport(actor: Actor, reportId: string, to: ReportStatus, comment?: string) {
  const report = await loadReport(actor, reportId);
  if (actor.patientId === report.booking.patientId && !hasPermission(actor, permissionForReportTransition(to), report.tenantId)) {
    throw new DomainError("FORBIDDEN", "Patients cannot change report status", 403);
  }
  assertPermission(actor, permissionForReportTransition(to), report.tenantId);
  if (report.imagingOrder && !report.labOrder && actor.memberships.some((membership) => membership.tenantId === report.tenantId && membership.roleKey === "PATHOLOGIST") && !hasPermission(actor, "imaging.report", report.tenantId)) {
    // Pathologists may approve imaging in this deployment because they hold reports.approve.
  }
  assertTransition(REPORT_TRANSITIONS, report.status, to, "Report");
  if ((to === "REJECTED" || to === "AMENDED") && !comment?.trim()) {
    throw new DomainError("REASON", to === "REJECTED" ? "Say why the report is sent back" : "Describe the amendment", 400);
  }
  const clinicalGate = to === "VERIFIED" || to === "APPROVED" || to === "RELEASED";
  if (clinicalGate) {
    const samples = report.labOrder?.samples ?? [];
    if (report.labOrder && samples.length === 0) throw new DomainError("REPORT", "This report has no samples with results", 409);
    if (samples.some((sample) => sample.status !== "RESULTED")) throw new DomainError("REPORT", "All samples must be resulted first", 409);
    for (const sample of samples) {
      const entered = new Set(sample.results.filter((result) => result.status !== "DRAFT").map((result) => result.parameterId));
      const missing = sample.service.parameters.filter((parameter) => !entered.has(parameter.id));
      if (sample.results.length === 0 || missing.length > 0) {
        throw new DomainError("REPORT", `Enter every parameter for ${sample.service.name} first${missing.length ? ` (missing: ${missing.map((item) => item.name).join(", ")})` : ""}`, 409);
      }
    }
    if (report.imagingOrder && !report.labOrder) {
      const studies = report.imagingOrder.studies.filter((study) => study.status !== "CANCELLED");
      if (studies.length === 0 || studies.some((study) => study.status === "SCHEDULED")) throw new DomainError("REPORT", "Acquire every imaging study first", 409);
    }
  }
  // Maker-checker: whoever entered results cannot verify or approve the same report.
  if (to === "VERIFIED" || to === "APPROVED") {
    const enteredBy = new Set((report.labOrder?.samples ?? []).flatMap((sample) => sample.results.map((result) => result.enteredById)).filter(Boolean));
    if (enteredBy.has(actor.userId)) throw new DomainError("SEGREGATION", "A different reviewer must sign off results you entered", 403);
  }
  if (to === "RELEASED" && !report.approvals.some((approval) => approval.decision === "APPROVED" && approval.createdAt > (report.releasedAt ?? new Date(0)))) {
    throw new DomainError("REPORT", "An authorized approval is required before release", 409);
  }
  const updated = await withScope({ tenantId: report.tenantId, userId: actor.userId }, async (tx) => {
    const nextVersion = to === "RELEASED" ? report.currentVersion + 1 : report.currentVersion;
    // Compare-and-set on the validated status so concurrent approvals or releases apply once.
    const claimed = await tx.medicalReport.updateMany({
      where: { id: report.id, tenantId: report.tenantId, status: report.status, currentVersion: report.currentVersion },
      data: { status: to, currentVersion: nextVersion, releasedAt: to === "RELEASED" ? new Date() : report.releasedAt },
    });
    if (claimed.count !== 1) throw new DomainError("CONFLICT", "This report was changed by someone else. Reload and try again.", 409);
    const row = await tx.medicalReport.findUniqueOrThrow({ where: { id: report.id } });
    await tx.reportApproval.create({ data: { tenantId: report.tenantId, reportId: report.id, approverId: actor.userId, decision: to, comment } });
    await writeAudit(tx, { tenantId: report.tenantId, actorId: actor.userId, action: to === "RELEASED" ? "RELEASE" : to === "APPROVED" ? "APPROVE" : "UPDATE", entityType: "MedicalReport", entityId: report.id, metadata: { to } });
    return row;
  });
  if (to === "RELEASED") {
    const fresh = await prismaPrivileged.medicalReport.findUniqueOrThrow({ where: { id: report.id }, include: reportInclude });
    const bytes = await renderReportPdf({
      centerName: fresh.booking.tenant.name,
      branchName: fresh.booking.branch.name,
      patientName: fresh.booking.patient.user.name,
      synthetic: fresh.booking.patient.isSynthetic,
      publicCode: fresh.booking.publicCode,
      title: fresh.title,
      version: fresh.currentVersion,
      approvedBy: actor.name,
      releasedAt: fresh.releasedAt ?? new Date(),
      rows: reportRows(fresh),
      disclaimer: "Reference flags compare a value with the center's configured range. They are not a diagnosis or a treatment recommendation. This report was released only after an authorized review.",
    });
    const key = `tenants/${fresh.tenantId}/reports/${fresh.id}/v${fresh.currentVersion}.pdf`;
    await putObject(key, bytes, "application/pdf");
    await withScope({ tenantId: fresh.tenantId, userId: actor.userId }, async (tx) => {
      await tx.reportVersion.create({
        data: { tenantId: fresh.tenantId, reportId: fresh.id, version: fresh.currentVersion, storageKey: key, checksum: sha256(bytes.toString("base64")), note: comment, createdById: actor.userId },
      });
      const reportPayload = { publicCode: fresh.booking.publicCode, centerName: fresh.booking.tenant.name, link: `${getEnv().APP_URL}/console/patient/reports` };
      await enqueue(tx, {
        tenantId: fresh.tenantId,
        userId: fresh.booking.patient.userId,
        channel: "EMAIL",
        templateKey: "report_ready",
        to: fresh.booking.patient.user.email,
        payload: reportPayload,
      });
      await enqueue(tx, {
        tenantId: fresh.tenantId,
        userId: fresh.booking.patient.userId,
        channel: "IN_APP",
        templateKey: "report_ready",
        to: fresh.booking.patient.user.email,
        payload: reportPayload,
      });
      if (fresh.booking.patient.user.phone) {
        await enqueue(tx, {
          tenantId: fresh.tenantId,
          userId: fresh.booking.patient.userId,
          channel: "WHATSAPP",
          templateKey: "report_ready",
          to: fresh.booking.patient.user.phone,
          payload: { publicCode: fresh.booking.publicCode, centerName: fresh.booking.tenant.name, link: `${getEnv().APP_URL}/console/patient/reports` },
        });
      }
    });
  }
  return updated;
}

export async function readReportPdf(actor: Actor, reportId: string, version?: number) {
  const report = await loadReport(actor, reportId);
  const staff = hasPermission(actor, "samples.read", report.tenantId) || hasPermission(actor, "reports.approve", report.tenantId) || hasPermission(actor, "imaging.report", report.tenantId);
  if (!staff && report.status !== "RELEASED" && report.status !== "AMENDED") {
    throw new DomainError("FORBIDDEN", "This report has not been released", 403);
  }
  const chosen = version ? report.versions.find((item) => item.version === version) : report.versions[0];
  if (!chosen) throw new DomainError("NOT_FOUND", "No released file is available yet", 404);
  const bytes = await getObject(chosen.storageKey);
  await withScope({ tenantId: report.tenantId, userId: actor.userId, patientId: actor.patientId }, (tx) =>
    writeAudit(tx, { tenantId: report.tenantId, actorId: actor.userId, action: "VIEW", entityType: "MedicalReport", entityId: report.id, metadata: { version: chosen.version } }),
  );
  return { bytes, filename: `${report.booking.publicCode}-v${chosen.version}.pdf`, version: chosen.version };
}
