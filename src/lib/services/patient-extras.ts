import type { Prisma, Sex } from "@prisma/client";
import type { Paging } from "@/lib/pagination";
import { prismaPrivileged } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import type { Actor } from "@/domain/actor";
import { renderTemplate } from "@/lib/services/notify";

function requirePatient(actor: Actor) {
  if (!actor.patientId) throw new DomainError("PATIENT", "A patient profile is required", 400);
  return actor.patientId;
}

export async function listDependents(actor: Actor) {
  const patientId = requirePatient(actor);
  return prismaPrivileged.patientDependent.findMany({ where: { guardianPatientId: patientId }, orderBy: { name: "asc" } });
}

export async function listDependentsPage(actor: Actor, paging: Paging) {
  const patientId = requirePatient(actor);
  const where = { guardianPatientId: patientId };
  const [items, total] = await Promise.all([
    prismaPrivileged.patientDependent.findMany({ where, orderBy: [{ name: "asc" }, { id: "asc" }], skip: paging.skip, take: paging.take }),
    prismaPrivileged.patientDependent.count({ where }),
  ]);
  return { items, total };
}

export async function saveDependent(actor: Actor, input: { id?: string; name: string; dateOfBirth: Date; sex: Sex; relation: string }) {
  const patientId = requirePatient(actor);
  if (input.id) {
    const row = await prismaPrivileged.patientDependent.findFirst({ where: { id: input.id, guardianPatientId: patientId } });
    if (!row) throw new DomainError("NOT_FOUND", "Family member not found", 404);
    return prismaPrivileged.patientDependent.update({
      where: { id: row.id },
      data: { name: input.name.trim(), dateOfBirth: input.dateOfBirth, sex: input.sex, relation: input.relation.trim() },
    });
  }
  return prismaPrivileged.patientDependent.create({
    data: { guardianPatientId: patientId, name: input.name.trim(), dateOfBirth: input.dateOfBirth, sex: input.sex, relation: input.relation.trim() },
  });
}

export async function deleteDependent(actor: Actor, id: string) {
  const patientId = requirePatient(actor);
  const row = await prismaPrivileged.patientDependent.findFirst({ where: { id, guardianPatientId: patientId } });
  if (!row) throw new DomainError("NOT_FOUND", "Family member not found", 404);
  await prismaPrivileged.patientDependent.delete({ where: { id: row.id } });
}

export async function listChronicConditions(actor: Actor) {
  const patientId = requirePatient(actor);
  return prismaPrivileged.patientChronicCondition.findMany({ where: { patientId }, orderBy: { condition: "asc" } });
}

export async function saveChronicCondition(actor: Actor, input: { condition: string; since?: Date; notes?: string }) {
  const patientId = requirePatient(actor);
  return prismaPrivileged.patientChronicCondition.create({
    data: { patientId, condition: input.condition.trim(), since: input.since ?? null, notes: input.notes?.trim() || null },
  });
}

export async function deleteChronicCondition(actor: Actor, id: string) {
  const patientId = requirePatient(actor);
  const row = await prismaPrivileged.patientChronicCondition.findFirst({ where: { id, patientId } });
  if (!row) throw new DomainError("NOT_FOUND", "Condition not found", 404);
  await prismaPrivileged.patientChronicCondition.delete({ where: { id: row.id } });
}

export async function getWallet(actor: Actor) {
  const patientId = requirePatient(actor);
  const wallet = await prismaPrivileged.patientWallet.upsert({
    where: { patientId },
    create: { patientId, balancePaise: 0 },
    update: {},
  });
  const transactions = await prismaPrivileged.walletTransaction.findMany({ where: { patientId }, orderBy: { createdAt: "desc" }, take: 50 });
  return { wallet, transactions };
}

/** Wallet balance plus one page of its transactions. */
export async function getWalletPage(actor: Actor, paging: Paging) {
  const patientId = requirePatient(actor);
  const wallet = await prismaPrivileged.patientWallet.upsert({ where: { patientId }, create: { patientId, balancePaise: 0 }, update: {} });
  const where = { patientId };
  const [items, total] = await Promise.all([
    prismaPrivileged.walletTransaction.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: paging.skip, take: paging.take }),
    prismaPrivileged.walletTransaction.count({ where }),
  ]);
  const [credits, debits] = await Promise.all([
    prismaPrivileged.walletTransaction.aggregate({ where: { patientId, amountPaise: { gt: 0 } }, _sum: { amountPaise: true } }),
    prismaPrivileged.walletTransaction.aggregate({ where: { patientId, amountPaise: { lt: 0 } }, _sum: { amountPaise: true } }),
  ]);
  return { wallet, items, total, earned: credits._sum.amountPaise ?? 0, used: -(debits._sum.amountPaise ?? 0) };
}

export async function creditWallet(patientId: string, amountPaise: number, reason: string, bookingId?: string) {
  if (amountPaise <= 0) return;
  await prismaPrivileged.$transaction(async (tx) => {
    await tx.patientWallet.upsert({ where: { patientId }, create: { patientId, balancePaise: amountPaise }, update: { balancePaise: { increment: amountPaise } } });
    await tx.walletTransaction.create({ data: { patientId, amountPaise, reason, bookingId: bookingId ?? null } });
  });
}

export async function debitWallet(patientId: string, amountPaise: number, reason: string, bookingId?: string) {
  if (amountPaise <= 0) return;
  await prismaPrivileged.$transaction(async (tx) => {
    const wallet = await tx.patientWallet.findUnique({ where: { patientId } });
    const balance = wallet?.balancePaise ?? 0;
    if (balance < amountPaise) throw new DomainError("WALLET", "Insufficient wallet balance", 409);
    await tx.patientWallet.update({ where: { patientId }, data: { balancePaise: { decrement: amountPaise } } });
    await tx.walletTransaction.create({ data: { patientId, amountPaise: -amountPaise, reason, bookingId: bookingId ?? null } });
  });
}

export function formatChronicSummary(conditions: Array<{ condition: string; since: Date | null }>) {
  if (!conditions.length) return "";
  return conditions
    .map((row) => (row.since ? `${row.condition} (since ${row.since.toISOString().slice(0, 10)})` : row.condition))
    .join("; ");
}

export async function listInsurance(actor: Actor) {
  const patientId = requirePatient(actor);
  return prismaPrivileged.insurancePolicy.findMany({ where: { patientId }, orderBy: { createdAt: "desc" } });
}

export async function listInsurancePage(actor: Actor, paging: Paging) {
  const patientId = requirePatient(actor);
  const where = { patientId };
  const [items, total] = await Promise.all([
    prismaPrivileged.insurancePolicy.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: paging.skip, take: paging.take }),
    prismaPrivileged.insurancePolicy.count({ where }),
  ]);
  return { items, total };
}

export async function saveInsurance(actor: Actor, input: { provider: string; policyNumber: string; tpaName?: string; validUntil?: Date }) {
  const patientId = requirePatient(actor);
  return prismaPrivileged.insurancePolicy.create({
    data: {
      patientId,
      provider: input.provider.trim(),
      policyNumber: input.policyNumber.trim(),
      tpaName: input.tpaName?.trim() || null,
      validUntil: input.validUntil ?? null,
    },
  });
}

export async function deleteInsurance(actor: Actor, id: string) {
  const patientId = requirePatient(actor);
  const row = await prismaPrivileged.insurancePolicy.findFirst({ where: { id, patientId } });
  if (!row) throw new DomainError("NOT_FOUND", "Policy not found", 404);
  await prismaPrivileged.insurancePolicy.delete({ where: { id: row.id } });
}

export async function listInAppNotifications(actor: Actor, limit = 50) {
  return prismaPrivileged.notification.findMany({
    where: { userId: actor.userId, channel: "IN_APP" },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function listInAppNotificationsPage(actor: Actor, paging: Paging) {
  const where = { userId: actor.userId, channel: "IN_APP" as const };
  const [items, total] = await Promise.all([
    prismaPrivileged.notification.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: paging.skip, take: paging.take }),
    prismaPrivileged.notification.count({ where }),
  ]);
  const unread = await prismaPrivileged.notification.count({ where: { ...where, readAt: null } });
  return { items, total, unread };
}

export async function markNotificationRead(actor: Actor, id: string) {
  const row = await prismaPrivileged.notification.findFirst({ where: { id, userId: actor.userId, channel: "IN_APP" } });
  if (!row) throw new DomainError("NOT_FOUND", "Notification not found", 404);
  return prismaPrivileged.notification.update({ where: { id: row.id }, data: { readAt: new Date() } });
}

export async function markAllNotificationsRead(actor: Actor) {
  await prismaPrivileged.notification.updateMany({ where: { userId: actor.userId, channel: "IN_APP", readAt: null }, data: { readAt: new Date() } });
}

export function notificationPreview(templateKey: string, payload: Record<string, unknown>) {
  const safe: Record<string, string> = {};
  for (const [key, value] of Object.entries(payload ?? {})) {
    if (typeof value === "string") safe[key] = value;
  }
  try {
    return renderTemplate(templateKey, safe);
  } catch {
    return { subject: templateKey, text: "Update on your care." };
  }
}

export async function listPatientTickets(actor: Actor) {
  return prismaPrivileged.supportTicket.findMany({
    where: { requesterId: actor.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function listPatientTicketsPage(actor: Actor, paging: Paging) {
  const where = { requesterId: actor.userId };
  const [items, total] = await Promise.all([
    prismaPrivileged.supportTicket.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: paging.skip, take: paging.take }),
    prismaPrivileged.supportTicket.count({ where }),
  ]);
  return { items, total };
}

export async function upcomingReminders(actor: Actor) {
  const patientId = requirePatient(actor);
  const now = new Date();
  const horizon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  return prismaPrivileged.booking.findMany({
    where: { patientId, status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] }, scheduledAt: { gte: now, lte: horizon } },
    include: { tenant: { select: { name: true } }, branch: { select: { name: true } }, dependent: true },
    orderBy: { scheduledAt: "asc" },
    take: 20,
  });
}

/** Visits in the next 14 days, one page at a time. */
export async function upcomingRemindersPage(actor: Actor, paging: Paging) {
  const patientId = requirePatient(actor);
  const now = new Date();
  const horizon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const where: Prisma.BookingWhereInput = { patientId, status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] }, scheduledAt: { gte: now, lte: horizon } };
  const [items, total] = await Promise.all([
    prismaPrivileged.booking.findMany({ where, include: { tenant: { select: { name: true } }, branch: { select: { name: true } }, dependent: true }, orderBy: [{ scheduledAt: "asc" }, { id: "asc" }], skip: paging.skip, take: paging.take }),
    prismaPrivileged.booking.count({ where }),
  ]);
  return { items, total };
}
