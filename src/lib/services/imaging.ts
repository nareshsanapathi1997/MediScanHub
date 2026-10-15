import type { ImagingOrderStatus, StudyStatus } from "@prisma/client";
import { withScope } from "@/lib/scope";
import { DomainError } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import type { Actor } from "@/domain/actor";
import { assertPermission } from "@/domain/actor";
import { IMAGING_TRANSITIONS, STUDY_TRANSITIONS, assertTransition } from "@/domain/state";
import { userPublicSelect } from "@/lib/user-public";

function scopeOf(actor: Actor) {
  const tenantId = actor.activeTenantId;
  if (!tenantId) throw new DomainError("TENANT_REQUIRED", "Choose a center first", 400);
  return { tenantId, userId: actor.userId };
}

export async function listImaging(actor: Actor) {
  const scope = scopeOf(actor);
  assertPermission(actor, "imaging.read", scope.tenantId);
  return withScope(scope, (tx) =>
    tx.imagingOrder.findMany({
      where: { tenantId: scope.tenantId },
      include: { studies: { include: { service: true, equipment: true } }, booking: { include: { patient: { include: { user: { select: userPublicSelect } } }, branch: true } }, reports: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  );
}

export async function transitionStudy(actor: Actor, studyId: string, to: StudyStatus) {
  const scope = scopeOf(actor);
  assertPermission(actor, to === "REPORTED" ? "imaging.report" : "imaging.perform", scope.tenantId);
  return withScope(scope, async (tx) => {
    const study = await tx.imagingStudy.findFirst({ where: { id: studyId, tenantId: scope.tenantId }, include: { imagingOrder: true } });
    if (!study) throw new DomainError("NOT_FOUND", "Study not found", 404);
    assertTransition(STUDY_TRANSITIONS, study.status, to, "Imaging study");
    const updated = await tx.imagingStudy.update({
      where: { id: study.id },
      data: { status: to, startedAt: to === "ACQUIRED" ? new Date() : study.startedAt, completedAt: to === "REPORTED" ? new Date() : study.completedAt },
    });
    const orderTo: ImagingOrderStatus | null = to === "ACQUIRED" ? "IN_PROGRESS" : to === "REPORTED" ? "REPORTED" : null;
    if (orderTo && IMAGING_TRANSITIONS[study.imagingOrder.status].includes(orderTo)) {
      await tx.imagingOrder.update({ where: { id: study.imagingOrderId }, data: { status: orderTo } });
    }
    await writeAudit(tx, { tenantId: scope.tenantId, actorId: actor.userId, action: "UPDATE", entityType: "ImagingStudy", entityId: study.id, metadata: { to, pacs: "NOT_INTEGRATED" } });
    return updated;
  });
}

export async function checkInImaging(actor: Actor, orderId: string) {
  const scope = scopeOf(actor);
  assertPermission(actor, "imaging.perform", scope.tenantId);
  return withScope(scope, async (tx) => {
    const order = await tx.imagingOrder.findFirst({ where: { id: orderId, tenantId: scope.tenantId } });
    if (!order) throw new DomainError("NOT_FOUND", "Imaging order not found", 404);
    assertTransition(IMAGING_TRANSITIONS, order.status, "CHECKED_IN", "Imaging order");
    return tx.imagingOrder.update({ where: { id: order.id }, data: { status: "CHECKED_IN" } });
  });
}

export async function saveEquipment(actor: Actor, input: { branchId: string; name: string; modality: string; room: string }) {
  const scope = scopeOf(actor);
  assertPermission(actor, "imaging.perform", scope.tenantId);
  return withScope(scope, async (tx) => {
    const equipment = await tx.equipment.create({ data: { tenantId: scope.tenantId, ...input } });
    await writeAudit(tx, { tenantId: scope.tenantId, actorId: actor.userId, action: "CREATE", entityType: "Equipment", entityId: equipment.id });
    return equipment;
  });
}

export async function scheduleEquipment(actor: Actor, input: { equipmentId: string; staffUserId?: string; startsAt: Date; endsAt: Date }) {
  const scope = scopeOf(actor);
  assertPermission(actor, "imaging.perform", scope.tenantId);
  if (input.endsAt <= input.startsAt) throw new DomainError("DATE", "Schedule end must be after the start", 400);
  return withScope(scope, async (tx) => {
    const equipment = await tx.equipment.findFirst({ where: { id: input.equipmentId, tenantId: scope.tenantId } });
    if (!equipment) throw new DomainError("NOT_FOUND", "Equipment not found", 404);
    if (input.staffUserId) {
      const staff = await tx.user.findFirst({ where: { id: input.staffUserId, memberships: { some: { tenantId: scope.tenantId, status: "ACTIVE" } } } });
      if (!staff) throw new DomainError("STAFF", "That person is not on this center's staff", 400);
    }
    return tx.equipmentSchedule.create({
      data: { tenantId: scope.tenantId, equipmentId: equipment.id, staffUserId: input.staffUserId, startsAt: input.startsAt, endsAt: input.endsAt },
    });
  });
}

export async function listEquipment(actor: Actor) {
  const scope = scopeOf(actor);
  assertPermission(actor, "imaging.read", scope.tenantId);
  return withScope(scope, (tx) => tx.equipment.findMany({ where: { tenantId: scope.tenantId, active: true }, include: { schedules: { orderBy: { startsAt: "asc" }, take: 8 }, branch: true } }));
}
