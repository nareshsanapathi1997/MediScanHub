import type { IntegrationKind, Prisma } from "@prisma/client";
import { prismaPrivileged } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import type { Actor } from "@/domain/actor";
import { assertPermission } from "@/domain/actor";
import { getEnv } from "@/lib/env";

export async function logIntegration(input: {
  tenantId?: string | null;
  kind: IntegrationKind;
  direction: "INBOUND" | "OUTBOUND";
  referenceId?: string;
  payload: Prisma.InputJsonValue;
  status: string;
}) {
  return prismaPrivileged.integrationMessage.create({
    data: {
      tenantId: input.tenantId ?? null,
      kind: input.kind,
      direction: input.direction,
      referenceId: input.referenceId ?? null,
      payload: input.payload,
      status: input.status,
    },
  });
}

export async function listIntegrationMessages(actor: Actor, kind?: IntegrationKind) {
  if (actor.isSuperAdmin) {
    assertPermission(actor, "platform.read", null);
    return prismaPrivileged.integrationMessage.findMany({
      where: kind ? { kind } : undefined,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }
  const tenantId = actor.activeTenantId;
  if (!tenantId) throw new DomainError("TENANT_REQUIRED", "Choose a center first", 400);
  assertPermission(actor, "tenant.read", tenantId);
  return prismaPrivileged.integrationMessage.findMany({
    where: { tenantId, ...(kind ? { kind } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

/** HL7 ORM^O01 style placeholder — stores outbound payload for an interface engine. */
export async function sendHl7Order(actor: Actor, bookingId: string) {
  const tenantId = actor.activeTenantId;
  if (!tenantId) throw new DomainError("TENANT_REQUIRED", "Choose a center first", 400);
  assertPermission(actor, "bookings.read", tenantId);
  const booking = await prismaPrivileged.booking.findFirst({
    where: { id: bookingId, tenantId },
    include: { patient: { include: { user: true } }, branch: true, items: true },
  });
  if (!booking) throw new DomainError("NOT_FOUND", "Booking not found", 404);
  const payload = {
    messageType: "ORM^O01",
    patient: { name: booking.patient.user.name, id: booking.patientId },
    visit: { code: booking.publicCode, branch: booking.branch.name },
    tests: booking.items.map((item) => item.name),
  };
  return logIntegration({ tenantId, kind: "HL7", direction: "OUTBOUND", referenceId: booking.id, payload, status: "QUEUED" });
}

/** FHIR ServiceRequest bundle stub for EMR handoff. */
export async function sendFhirServiceRequest(actor: Actor, bookingId: string) {
  const tenantId = actor.activeTenantId;
  if (!tenantId) throw new DomainError("TENANT_REQUIRED", "Choose a center first", 400);
  assertPermission(actor, "bookings.read", tenantId);
  const booking = await prismaPrivileged.booking.findFirst({ where: { id: bookingId, tenantId }, include: { items: true } });
  if (!booking) throw new DomainError("NOT_FOUND", "Booking not found", 404);
  const payload = {
    resourceType: "Bundle",
    type: "collection",
    entry: booking.items.map((item) => ({
      resource: {
        resourceType: "ServiceRequest",
        status: "active",
        intent: "order",
        code: { text: item.name },
        subject: { reference: `Patient/${booking.patientId}` },
      },
    })),
  };
  return logIntegration({ tenantId, kind: "FHIR", direction: "OUTBOUND", referenceId: booking.id, payload, status: "QUEUED" });
}

/** ABDM health record link placeholder — requires national gateway credentials. */
export async function registerAbdmLink(actor: Actor, patientId: string) {
  const tenantId = actor.activeTenantId;
  if (!tenantId) throw new DomainError("TENANT_REQUIRED", "Choose a center first", 400);
  assertPermission(actor, "tenant.manage", tenantId);
  const env = getEnv();
  const payload = {
    hipId: env.ABDM_HIP_ID ?? "unset",
    patientReference: patientId,
    note: "Configure ABDM_HIP_ID and gateway credentials for live linking.",
  };
  return logIntegration({ tenantId, kind: "ABDM", direction: "OUTBOUND", referenceId: patientId, payload, status: env.ABDM_HIP_ID ? "QUEUED" : "NOT_CONFIGURED" });
}

export async function transmitStudyToPacs(actor: Actor, studyId: string) {
  const tenantId = actor.activeTenantId;
  if (!tenantId) throw new DomainError("TENANT_REQUIRED", "Choose a center first", 400);
  assertPermission(actor, "imaging.perform", tenantId);
  const study = await prismaPrivileged.imagingStudy.findFirst({
    where: { id: studyId, tenantId },
    include: { service: true, imagingOrder: { include: { booking: true } } },
  });
  if (!study) throw new DomainError("NOT_FOUND", "Study not found", 404);
  const endpoint = getEnv().PACS_ENDPOINT ?? process.env.PACS_ENDPOINT;
  const payload = {
    accession: study.accession,
    modality: study.imagingOrder.modality,
    patientId: study.imagingOrder.booking.patientId,
    studyInstanceUid: study.studyInstanceUid,
    endpoint: endpoint ?? "mock-pacs",
  };
  await prismaPrivileged.imagingStudy.update({ where: { id: study.id }, data: { pacsStatus: endpoint ? "QUEUED" : "TRANSMITTED" } });
  await logIntegration({ tenantId, kind: "PACS", direction: "OUTBOUND", referenceId: study.id, payload, status: endpoint ? "QUEUED" : "MOCK_SENT" });
  if (endpoint) {
    try {
      await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      await prismaPrivileged.imagingStudy.update({ where: { id: study.id }, data: { pacsStatus: "TRANSMITTED" } });
    } catch {
      await prismaPrivileged.imagingStudy.update({ where: { id: study.id }, data: { pacsStatus: "FAILED" } });
      throw new DomainError("PACS", "PACS endpoint did not accept the study", 502);
    }
  }
  return study;
}
