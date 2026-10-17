import { prisma } from "@/lib/db";
import { listSlots } from "@/lib/services/catalog";
import { withScope, type Tx } from "@/lib/scope";
import { DomainError } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import type { Actor } from "@/domain/actor";
import { assertBranchAccess, hasPermission } from "@/domain/actor";
import { coveredByShifts, isScanModality, modalityLabel, overlaps, planScanSlots, SLOT_MINUTES_RANGE, type ScanModality } from "@/domain/scan-scheduling";

function scopeOf(actor: Actor) {
  const tenantId = actor.activeTenantId;
  if (!tenantId) throw new DomainError("TENANT_REQUIRED", "Choose a center first", 400);
  return { tenantId, userId: actor.userId };
}

/** Owners, branch managers and radiology staff run the scan rooms. */
export function canManageScanRooms(actor: Actor, tenantId: string | null) {
  return hasPermission(actor, "imaging.perform", tenantId) || hasPermission(actor, "branches.manage", tenantId) || hasPermission(actor, "catalog.manage", tenantId);
}

function canViewScanRooms(actor: Actor, tenantId: string) {
  return canManageScanRooms(actor, tenantId) || hasPermission(actor, "imaging.read", tenantId) || hasPermission(actor, "bookings.manage", tenantId);
}

function assertManage(actor: Actor, tenantId: string) {
  if (!canManageScanRooms(actor, tenantId)) throw new DomainError("FORBIDDEN", "Only radiology staff or a manager can change scan rooms", 403);
}

async function findEquipment(tx: Tx, actor: Actor, tenantId: string, equipmentId: string) {
  const equipment = await tx.equipment.findFirst({ where: { id: equipmentId, tenantId } });
  if (!equipment) throw new DomainError("NOT_FOUND", "Scan room not found", 404);
  assertBranchAccess(actor, tenantId, equipment.branchId);
  return equipment;
}

/** Everything the scan-rooms page needs: machines, shifts, maintenance and the next week of slots. */
export async function listScanRooms(actor: Actor, days = 7) {
  const scope = scopeOf(actor);
  if (!canViewScanRooms(actor, scope.tenantId)) throw new DomainError("FORBIDDEN", "You do not have permission to see scan rooms", 403);
  const now = new Date();
  const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const membership = actor.memberships.find((item) => item.tenantId === scope.tenantId && item.status === "ACTIVE");
  const branchFilter = membership && membership.branchScope !== "all" ? { branchId: { in: membership.branchScope } } : {};
  return withScope(scope, (tx) =>
    tx.equipment.findMany({
      where: { tenantId: scope.tenantId, ...branchFilter },
      include: {
        branch: { select: { id: true, name: true } },
        schedules: { where: { endsAt: { gt: now }, startsAt: { lt: until } }, orderBy: { startsAt: "asc" }, include: { staff: { select: { id: true, name: true } } } },
        blocks: { where: { endsAt: { gt: now } }, orderBy: { startsAt: "asc" } },
        slots: { where: { kind: "IMAGING", startsAt: { gt: now, lt: until } }, orderBy: { startsAt: "asc" } },
      },
      orderBy: [{ branch: { name: "asc" } }, { modality: "asc" }, { name: "asc" }],
    }),
  );
}

export async function saveScanRoom(actor: Actor, input: { branchId: string; name: string; modality: string; room: string; slotMinutes?: number }) {
  const scope = scopeOf(actor);
  assertManage(actor, scope.tenantId);
  assertBranchAccess(actor, scope.tenantId, input.branchId);
  const name = input.name.trim();
  const room = input.room.trim();
  if (name.length < 2 || room.length < 1) throw new DomainError("VALIDATION", "Enter the machine name and room", 400);
  if (!isScanModality(input.modality)) throw new DomainError("VALIDATION", "Choose X-ray, CT, MRI or ultrasound", 400);
  const slotMinutes = Math.trunc(input.slotMinutes ?? 20);
  if (slotMinutes < SLOT_MINUTES_RANGE.min || slotMinutes > SLOT_MINUTES_RANGE.max) throw new DomainError("VALIDATION", `Slot length must be ${SLOT_MINUTES_RANGE.min} to ${SLOT_MINUTES_RANGE.max} minutes`, 400);
  return withScope(scope, async (tx) => {
    const branch = await tx.branch.findFirst({ where: { id: input.branchId, tenantId: scope.tenantId, deletedAt: null } });
    if (!branch) throw new DomainError("NOT_FOUND", "Branch not found", 404);
    const equipment = await tx.equipment.create({ data: { tenantId: scope.tenantId, branchId: branch.id, name, modality: input.modality, room, slotMinutes } });
    await writeAudit(tx, { tenantId: scope.tenantId, actorId: actor.userId, action: "CREATE", entityType: "Equipment", entityId: equipment.id, metadata: { modality: input.modality } });
    return equipment;
  });
}

/** Taking a machine out of use hides its slots from patients. Existing bookings stay and are listed for follow-up. */
export async function setScanRoomActive(actor: Actor, equipmentId: string, active: boolean) {
  const scope = scopeOf(actor);
  assertManage(actor, scope.tenantId);
  return withScope(scope, async (tx) => {
    const equipment = await findEquipment(tx, actor, scope.tenantId, equipmentId);
    await tx.equipment.update({ where: { id: equipment.id }, data: { active } });
    await writeAudit(tx, { tenantId: scope.tenantId, actorId: actor.userId, action: "UPDATE", entityType: "Equipment", entityId: equipment.id, metadata: { active } });
  });
}

export async function addTechnicianShift(actor: Actor, input: { equipmentId: string; staffUserId: string; startsAt: Date; endsAt: Date }) {
  const scope = scopeOf(actor);
  assertManage(actor, scope.tenantId);
  if (Number.isNaN(input.startsAt.getTime()) || Number.isNaN(input.endsAt.getTime())) throw new DomainError("DATE", "Enter a valid date and time", 400);
  if (input.endsAt <= input.startsAt) throw new DomainError("DATE", "The shift must end after it starts", 400);
  if (input.endsAt.getTime() - input.startsAt.getTime() > 14 * 60 * 60 * 1000) throw new DomainError("DATE", "A shift can be at most 14 hours", 400);
  return withScope(scope, async (tx) => {
    const equipment = await findEquipment(tx, actor, scope.tenantId, input.equipmentId);
    const member = await tx.tenantMembership.findFirst({
      where: { tenantId: scope.tenantId, userId: input.staffUserId, status: "ACTIVE", role: { key: { in: ["RADIOLOGY", "CENTER_OWNER"] } } },
    });
    if (!member) throw new DomainError("STAFF", "Choose a radiology staff member of this center", 400);
    const clash = await tx.equipmentSchedule.findFirst({
      where: { tenantId: scope.tenantId, staffUserId: input.staffUserId, startsAt: { lt: input.endsAt }, endsAt: { gt: input.startsAt } },
      include: { equipment: { select: { name: true } } },
    });
    if (clash) throw new DomainError("SHIFT_CLASH", `This person is already on shift at ${clash.equipment.name} at that time`, 409);
    const shift = await tx.equipmentSchedule.create({ data: { tenantId: scope.tenantId, equipmentId: equipment.id, staffUserId: input.staffUserId, startsAt: input.startsAt, endsAt: input.endsAt } });
    await writeAudit(tx, { tenantId: scope.tenantId, actorId: actor.userId, action: "CREATE", entityType: "EquipmentSchedule", entityId: shift.id });
    return shift;
  });
}

export async function removeTechnicianShift(actor: Actor, shiftId: string) {
  const scope = scopeOf(actor);
  assertManage(actor, scope.tenantId);
  return withScope(scope, async (tx) => {
    const shift = await tx.equipmentSchedule.findFirst({ where: { id: shiftId, tenantId: scope.tenantId } });
    if (!shift) throw new DomainError("NOT_FOUND", "Shift not found", 404);
    await findEquipment(tx, actor, scope.tenantId, shift.equipmentId);
    await tx.equipmentSchedule.delete({ where: { id: shift.id } });
    await writeAudit(tx, { tenantId: scope.tenantId, actorId: actor.userId, action: "DELETE", entityType: "EquipmentSchedule", entityId: shift.id });
  });
}

/** Blocks a machine for maintenance. Returns how many booked patients fall inside the block, so staff can call them. */
export async function addMaintenanceBlock(actor: Actor, input: { equipmentId: string; startsAt: Date; endsAt: Date; reason: string }) {
  const scope = scopeOf(actor);
  assertManage(actor, scope.tenantId);
  const reason = input.reason.trim();
  if (reason.length < 3) throw new DomainError("VALIDATION", "Write a short reason, like \"AMC service visit\"", 400);
  if (Number.isNaN(input.startsAt.getTime()) || Number.isNaN(input.endsAt.getTime())) throw new DomainError("DATE", "Enter a valid date and time", 400);
  if (input.endsAt <= input.startsAt) throw new DomainError("DATE", "The block must end after it starts", 400);
  return withScope(scope, async (tx) => {
    const equipment = await findEquipment(tx, actor, scope.tenantId, input.equipmentId);
    const block = await tx.equipmentBlock.create({ data: { tenantId: scope.tenantId, equipmentId: equipment.id, startsAt: input.startsAt, endsAt: input.endsAt, reason: reason.slice(0, 200), createdById: actor.userId } });
    const affected = await tx.booking.count({
      where: { tenantId: scope.tenantId, status: { in: ["PENDING", "CONFIRMED"] }, slot: { equipmentId: equipment.id, startsAt: { lt: input.endsAt }, endsAt: { gt: input.startsAt } } },
    });
    await writeAudit(tx, { tenantId: scope.tenantId, actorId: actor.userId, action: "CREATE", entityType: "EquipmentBlock", entityId: block.id, metadata: { equipmentId: equipment.id, affected } });
    return { block, affectedBookings: affected };
  });
}

export async function removeMaintenanceBlock(actor: Actor, blockId: string) {
  const scope = scopeOf(actor);
  assertManage(actor, scope.tenantId);
  return withScope(scope, async (tx) => {
    const block = await tx.equipmentBlock.findFirst({ where: { id: blockId, tenantId: scope.tenantId } });
    if (!block) throw new DomainError("NOT_FOUND", "Maintenance block not found", 404);
    await findEquipment(tx, actor, scope.tenantId, block.equipmentId);
    await tx.equipmentBlock.delete({ where: { id: block.id } });
    await writeAudit(tx, { tenantId: scope.tenantId, actorId: actor.userId, action: "DELETE", entityType: "EquipmentBlock", entityId: block.id });
  });
}

/**
 * Creates back-to-back scan slots on one machine. Every slot must sit inside a technician shift,
 * must not overlap a maintenance block, and must not overlap another slot on the same machine.
 */
export async function createScanSlots(actor: Actor, input: { equipmentId: string; day: string; from: string; to: string; minutes?: number; capacity: number }) {
  const scope = scopeOf(actor);
  assertManage(actor, scope.tenantId);
  return withScope(scope, async (tx) => {
    const equipment = await findEquipment(tx, actor, scope.tenantId, input.equipmentId);
    if (!equipment.active) throw new DomainError("SLOT", "This machine is out of use. Turn it back on first.", 400);
    const planned = planScanSlots({ day: input.day, from: input.from, to: input.to, minutes: input.minutes || equipment.slotMinutes, capacity: input.capacity });
    if (planned[0]!.startsAt <= new Date()) throw new DomainError("SLOT", "Slots must start in the future", 400);
    const first = planned[0]!.startsAt;
    const last = planned[planned.length - 1]!.endsAt;
    // Lock the machine row so two people creating slots at once cannot make overlapping slots.
    await tx.$executeRaw`SELECT id FROM "Equipment" WHERE id = ${equipment.id}::uuid FOR UPDATE`;
    const [shifts, blocks, existing] = await Promise.all([
      tx.equipmentSchedule.findMany({ where: { equipmentId: equipment.id, staffUserId: { not: null }, startsAt: { lt: last }, endsAt: { gt: first } } }),
      tx.equipmentBlock.findMany({ where: { equipmentId: equipment.id, startsAt: { lt: last }, endsAt: { gt: first } } }),
      tx.availabilitySlot.findMany({ where: { equipmentId: equipment.id, startsAt: { lt: last }, endsAt: { gt: first } } }),
    ]);
    if (!coveredByShifts(planned, shifts)) throw new DomainError("NO_TECHNICIAN", "No technician is on shift for part of this time. Add a shift first.", 400);
    if (planned.some((slot) => blocks.some((block) => overlaps(slot, block)))) throw new DomainError("MAINTENANCE", "This time overlaps a maintenance block", 409);
    if (planned.some((slot) => existing.some((row) => overlaps(slot, row)))) throw new DomainError("SLOT_CLASH", "Some of these times already have slots on this machine", 409);
    await tx.availabilitySlot.createMany({
      data: planned.map((slot) => ({ tenantId: scope.tenantId, branchId: equipment.branchId, kind: "IMAGING" as const, equipmentId: equipment.id, startsAt: slot.startsAt, endsAt: slot.endsAt, capacity: Math.trunc(input.capacity) })),
    });
    await writeAudit(tx, { tenantId: scope.tenantId, actorId: actor.userId, action: "CREATE", entityType: "AvailabilitySlot", metadata: { equipmentId: equipment.id, count: planned.length } });
    return { count: planned.length };
  });
}

/** Removes an empty scan slot. Slots with bookings must be rescheduled first. */
export async function removeScanSlot(actor: Actor, slotId: string) {
  const scope = scopeOf(actor);
  assertManage(actor, scope.tenantId);
  return withScope(scope, async (tx) => {
    const slot = await tx.availabilitySlot.findFirst({ where: { id: slotId, tenantId: scope.tenantId, kind: "IMAGING" } });
    if (!slot?.equipmentId) throw new DomainError("NOT_FOUND", "Slot not found", 404);
    await findEquipment(tx, actor, scope.tenantId, slot.equipmentId);
    const removed = await tx.availabilitySlot.deleteMany({ where: { id: slot.id, bookedCount: 0 } });
    if (removed.count !== 1) throw new DomainError("SLOT_BOOKED", "Patients are booked in this slot. Reschedule them first.", 409);
    await writeAudit(tx, { tenantId: scope.tenantId, actorId: actor.userId, action: "DELETE", entityType: "AvailabilitySlot", entityId: slot.id });
  });
}

/** Open scan slots for patients: right machine type, machine in use, not full, not blocked. */
export async function listScanSlots(branchId: string, day: string, modality: ScanModality) {
  const start = new Date(`${day}T00:00:00.000+05:30`);
  if (Number.isNaN(start.getTime())) throw new DomainError("DATE", "Choose a valid date", 400);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const slots = await prisma.availabilitySlot.findMany({
    where: { branchId, kind: "IMAGING", startsAt: { gte: new Date(), lt: end }, endsAt: { gt: start }, equipment: { active: true, modality } },
    orderBy: { startsAt: "asc" },
    include: { equipment: { select: { id: true, name: true, room: true, modality: true, blocks: { where: { startsAt: { lt: end }, endsAt: { gt: start } } } } } },
  });
  return slots
    .filter((slot) => slot.bookedCount < slot.capacity && !slot.equipment!.blocks.some((block) => overlaps(slot, block)))
    .map((slot) => ({ ...slot, label: `${modalityLabel(slot.equipment!.modality)} · ${slot.equipment!.room}`, minutes: Math.round((slot.endsAt.getTime() - slot.startsAt.getTime()) / 60000) }));
}

/** Slots a booking can move to: scan bookings stay on the same scan type; other visits use center or home slots. */
export async function listRescheduleSlots(booking: { branchId: string; tenantId: string; slotId: string | null; visitType: string }, day: string) {
  const current = booking.slotId
    ? await prisma.availabilitySlot.findFirst({ where: { id: booking.slotId, tenantId: booking.tenantId }, select: { kind: true, equipment: { select: { modality: true } } } })
    : null;
  if (current?.kind === "IMAGING" && isScanModality(current.equipment?.modality)) return listScanSlots(booking.branchId, day, current.equipment!.modality as ScanModality);
  return listSlots(booking.branchId, day, booking.visitType === "HOME_COLLECTION" ? "HOME" : "CENTER");
}
