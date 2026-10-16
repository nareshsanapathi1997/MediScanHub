import { istDayKey, istDayStart } from "@/lib/format";
import type { Prisma, TenantStatus } from "@prisma/client";
import { prismaPrivileged } from "@/lib/db";
import { withScope } from "@/lib/scope";
import { DomainError } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { assertUpload, putObject, getObject } from "@/lib/adapters/storage";
import { ensureTrial } from "@/lib/services/subscription";
import { enqueue } from "@/lib/services/notify";
import { getEnv } from "@/lib/env";
import type { Actor } from "@/domain/actor";
import { assertPermission, hasPermission } from "@/domain/actor";
import { hashPassword } from "@/lib/password";
import { randomToken } from "@/lib/crypto";
import { userPublicSelect } from "@/lib/user-public";

export async function platformOverview(actor: Actor) {
  assertPermission(actor, "platform.read", null);
  const [centers, branches, patients, bookings, revenue, overdue, tickets, notifications] = await Promise.all([
    prismaPrivileged.tenant.count({ where: { deletedAt: null } }),
    prismaPrivileged.branch.count({ where: { deletedAt: null } }),
    prismaPrivileged.patient.count(),
    prismaPrivileged.booking.count(),
    prismaPrivileged.payment.aggregate({ where: { status: "CAPTURED" }, _sum: { amountPaise: true } }),
    prismaPrivileged.subscription.count({ where: { status: { in: ["PAST_DUE", "EXPIRED"] } } }),
    prismaPrivileged.supportTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    prismaPrivileged.notification.groupBy({ by: ["status"], _count: true }),
  ]);
  const since = istDayStart(new Date(), -13);
  const recent = await prismaPrivileged.booking.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true, totalPaise: true, status: true } });
  // Group by India calendar day so the chart matches what operators see on the wall clock.
  const days = Array.from({ length: 14 }, (_, index) => {
    const key = istDayKey(istDayStart(new Date(), -(13 - index)));
    const rows = recent.filter((booking) => istDayKey(booking.createdAt) === key);
    return { day: key, bookings: rows.length, revenuePaise: rows.filter((booking) => booking.status !== "CANCELLED" && booking.status !== "REFUNDED").reduce((sum, booking) => sum + booking.totalPaise, 0) };
  });
  const byStatus = await prismaPrivileged.tenant.groupBy({ by: ["status"], _count: true });
  return {
    centers,
    branches,
    patients,
    bookings,
    capturedPaise: revenue._sum.amountPaise ?? 0,
    overdueSubscriptions: overdue,
    openTickets: tickets,
    notifications,
    trend: days,
    centersByStatus: byStatus,
  };
}

export async function listTenantsAdmin(actor: Actor, status?: TenantStatus) {
  assertPermission(actor, "tenants.review", null);
  return prismaPrivileged.tenant.findMany({
    where: { ...(status ? { status } : {}), deletedAt: null },
    include: {
      branches: { select: { id: true, name: true, city: true } },
      subscriptions: { include: { plan: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 1 },
      verifications: { select: { id: true, documentType: true, status: true, fileName: true } },
      _count: { select: { bookings: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function decideTenant(actor: Actor, tenantId: string, decision: "APPROVE" | "REJECT" | "SUSPEND" | "REACTIVATE", notes?: string) {
  assertPermission(actor, "tenants.review", null);
  const status: TenantStatus = decision === "APPROVE" || decision === "REACTIVATE" ? "ACTIVE" : decision === "REJECT" ? "REJECTED" : "SUSPENDED";
  const tenant = await prismaPrivileged.tenant.update({ where: { id: tenantId }, data: { status } });
  if (decision === "APPROVE") await ensureTrial(tenantId);
  await prismaPrivileged.centerVerification.updateMany({ where: { tenantId, status: "PENDING" }, data: { status: decision === "REJECT" ? "REJECTED" : "APPROVED", reviewerId: actor.userId, reviewedAt: new Date(), notes } });
  await prismaPrivileged.auditLog.create({
    data: { tenantId, actorId: actor.userId, action: decision, entityType: "Tenant", entityId: tenantId, metadata: { notes } },
  });
  await enqueue(prismaPrivileged, {
    tenantId,
    channel: "EMAIL",
    templateKey: "subscription_reminder",
    to: tenant.email,
    payload: { centerName: tenant.name, planName: decision.toLowerCase(), link: `${getEnv().APP_URL}/console/org` },
  });
  return tenant;
}

export async function uploadVerification(actor: Actor, documentType: string, fileName: string, bytes: Buffer) {
  const tenantId = actor.activeTenantId;
  if (!tenantId) throw new DomainError("TENANT_REQUIRED", "Choose a center first", 400);
  assertPermission(actor, "tenant.manage", tenantId);
  const sniffed = assertUpload(bytes, fileName);
  const key = `tenants/${tenantId}/verification/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.]+/g, "-")}`;
  await putObject(key, bytes, sniffed.contentType);
  return withScope({ tenantId, userId: actor.userId }, async (tx) => {
    const doc = await tx.centerVerification.create({ data: { tenantId, documentType, storageKey: key, fileName, status: "PENDING" } });
    await writeAudit(tx, { tenantId, actorId: actor.userId, action: "CREATE", entityType: "CenterVerification", entityId: doc.id });
    return doc;
  });
}

export async function readVerification(actor: Actor, id: string) {
  const doc = await prismaPrivileged.centerVerification.findUnique({ where: { id } });
  if (!doc) throw new DomainError("NOT_FOUND", "Document not found", 404);
  const allowed = actor.isSuperAdmin || (actor.activeTenantId === doc.tenantId && actor.memberships.some((membership) => membership.tenantId === doc.tenantId && membership.permissions.includes("tenant.read")));
  if (!allowed) throw new DomainError("FORBIDDEN", "You cannot view this document", 403);
  const bytes = await getObject(doc.storageKey);
  await prismaPrivileged.auditLog.create({ data: { tenantId: doc.tenantId, actorId: actor.userId, action: "VIEW", entityType: "CenterVerification", entityId: doc.id } });
  return { bytes, fileName: doc.fileName };
}

export async function listUsersAdmin(actor: Actor, query?: string) {
  assertPermission(actor, "platform.manage", null);
  return prismaPrivileged.user.findMany({
    where: query ? { OR: [{ email: { contains: query, mode: "insensitive" } }, { name: { contains: query, mode: "insensitive" } }] } : {},
    select: {
      ...userPublicSelect,
      memberships: { select: { role: { select: { key: true, name: true } }, tenant: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function setUserStatus(actor: Actor, userId: string, status: "ACTIVE" | "SUSPENDED" | "DISABLED") {
  assertPermission(actor, "platform.manage", null);
  if (userId === actor.userId) throw new DomainError("FORBIDDEN", "You cannot change your own status", 400);
  const user = await prismaPrivileged.user.update({ where: { id: userId }, data: { status }, select: userPublicSelect });
  if (status !== "ACTIVE") await prismaPrivileged.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  await prismaPrivileged.auditLog.create({ data: { actorId: actor.userId, action: "UPDATE", entityType: "User", entityId: userId, metadata: { status } } });
  return user;
}

export async function listAudit(actor: Actor, tenantId?: string | null) {
  if (actor.isSuperAdmin) {
    assertPermission(actor, "audit.read", null);
    return prismaPrivileged.auditLog.findMany({
      where: tenantId ? { tenantId } : {},
      include: { actor: { select: { name: true, email: true } }, tenant: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }
  if (!actor.activeTenantId) throw new DomainError("FORBIDDEN", "Audit access denied", 403);
  assertPermission(actor, "analytics.read", actor.activeTenantId);
  return withScope({ tenantId: actor.activeTenantId, userId: actor.userId }, (tx) =>
    tx.auditLog.findMany({ where: { tenantId: actor.activeTenantId! }, include: { actor: { select: { name: true, email: true } }, tenant: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 200 }),
  );
}

export async function exportBookingsCsv(actor: Actor) {
  const tenantId = actor.activeTenantId;
  if (!tenantId) throw new DomainError("TENANT_REQUIRED", "Choose a center first", 400);
  assertPermission(actor, "analytics.read", tenantId);
  const rows = await withScope({ tenantId, userId: actor.userId }, async (tx) => {
    const bookings = await tx.booking.findMany({
      where: { tenantId },
      include: { patient: { include: { user: { select: { name: true } } } }, branch: true },
      orderBy: { createdAt: "desc" },
      take: 2000,
    });
    await writeAudit(tx, { tenantId, actorId: actor.userId, action: "EXPORT", entityType: "Booking", metadata: { count: bookings.length } });
    return bookings;
  });
  const cell = (value: string | number) => {
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const header = "publicCode,status,visitType,branch,patient,scheduledAt,totalPaise";
  const body = rows.map((row) => [row.publicCode, row.status, row.visitType, row.branch.name, row.patient.user.name, row.scheduledAt.toISOString(), row.totalPaise].map(cell).join(","));
  return [header, ...body].join("\n");
}

export async function createTicket(actor: Actor, input: { subject: string; body: string; priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT" }) {
  assertPermission(actor, "tickets.create", actor.activeTenantId);
  return prismaPrivileged.supportTicket.create({
    data: { tenantId: actor.activeTenantId, requesterId: actor.userId, subject: input.subject.trim(), body: input.body.trim(), priority: input.priority ?? "NORMAL" },
  });
}

export async function createPublicTicket(input: { name: string; email: string; subject: string; body: string; ip?: string }) {
  const inbox = await prismaPrivileged.user.findUnique({ where: { email: "inbox@mediscan.test" } });
  if (!inbox) throw new DomainError("SUPPORT", "Support inbox is not configured", 500);
  return prismaPrivileged.supportTicket.create({
    data: {
      requesterId: inbox.id,
      subject: input.subject.trim(),
      body: `From ${input.name} <${input.email}>\n\n${input.body.trim()}`,
      priority: "NORMAL",
    },
  });
}

export async function listTickets(actor: Actor) {
  if (actor.isSuperAdmin) {
    assertPermission(actor, "tickets.manage", null);
    return prismaPrivileged.supportTicket.findMany({ include: ticketInclude, orderBy: { createdAt: "desc" }, take: 100 });
  }
  return prismaPrivileged.supportTicket.findMany({
    where: { OR: [{ requesterId: actor.userId }, ...(actor.activeTenantId ? [{ tenantId: actor.activeTenantId }] : [])] },
    include: ticketInclude,
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function updateTicket(actor: Actor, id: string, status: "OPEN" | "IN_PROGRESS" | "WAITING" | "RESOLVED" | "CLOSED", resolution?: string) {
  assertPermission(actor, "tickets.manage", null);
  return prismaPrivileged.supportTicket.update({ where: { id }, data: { status, resolution, assigneeId: actor.userId } });
}

const ticketInclude = {
  requester: { select: userPublicSelect },
  assignee: { select: userPublicSelect },
  tenant: { select: { id: true, name: true } },
} as const;

export async function notificationHealth(actor: Actor) {
  assertPermission(actor, "platform.read", null);
  const grouped = await prismaPrivileged.notification.groupBy({ by: ["status", "channel"], _count: true });
  const failed = await prismaPrivileged.notification.findMany({
    where: { status: "FAILED" },
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: { id: true, updatedAt: true, channel: true, templateKey: true, toAddress: true, status: true },
  });
  return { grouped, failed };
}

export async function tenantAnalytics(actor: Actor, from?: Date, to?: Date) {
  const tenantId = actor.activeTenantId;
  if (!tenantId) throw new DomainError("TENANT_REQUIRED", "Choose a center first", 400);
  assertPermission(actor, "analytics.read", tenantId);
  return withScope({ tenantId, userId: actor.userId }, async (tx) => {
    const where = { tenantId, ...(from || to ? { scheduledAt: { gte: from, lte: to } } : {}) };
    const [byStatus, payments, samples] = await Promise.all([
      tx.booking.groupBy({ by: ["status"], where, _count: true, _sum: { totalPaise: true } }),
      tx.payment.aggregate({ where: { tenantId, status: "CAPTURED" }, _sum: { amountPaise: true }, _count: true }),
      tx.sample.groupBy({ by: ["status"], where: { tenantId }, _count: true }),
    ]);
    const released = await tx.medicalReport.findMany({ where: { tenantId, releasedAt: { not: null } }, select: { createdAt: true, releasedAt: true } });
    const tatHours = released.length
      ? released.reduce((sum, report) => sum + ((report.releasedAt!.getTime() - report.createdAt.getTime()) / 36e5), 0) / released.length
      : 0;
    return { byStatus, capturedPaise: payments._sum.amountPaise ?? 0, payments: payments._count, samples, averageReleaseHours: Math.round(tatHours * 10) / 10 };
  });
}

export async function updateOwnProfile(actor: Actor, input: { name?: string; phone?: string; address?: string; city?: string; emergencyContact?: string }) {
  if (input.name || input.phone) {
    await prismaPrivileged.user.update({ where: { id: actor.userId }, data: { name: input.name, phone: input.phone } });
  }
  if (actor.patientId) {
    await prismaPrivileged.patient.update({
      where: { id: actor.patientId },
      data: { address: input.address, city: input.city, emergencyContact: input.emergencyContact },
    });
  }
}

export async function exportPatientData(actor: Actor) {
  if (!actor.patientId) throw new DomainError("PATIENT", "Only patient profiles can be exported this way", 400);
  const data = await prismaPrivileged.patient.findUnique({
    where: { id: actor.patientId },
    include: { user: { select: { name: true, email: true, phone: true } }, bookings: { include: { items: true, invoice: true } }, consents: true, records: true },
  });
  await prismaPrivileged.auditLog.create({ data: { actorId: actor.userId, action: "EXPORT", entityType: "Patient", entityId: actor.patientId } });
  return data;
}

export async function requestDeletion(actor: Actor) {
  await prismaPrivileged.$transaction(async (tx) => {
    await tx.session.updateMany({ where: { userId: actor.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.user.update({
      where: { id: actor.userId },
      data: { status: "DISABLED", deletedAt: new Date(), name: "Deleted patient", email: `deleted-${actor.userId}@invalid.mediscan.test`, phone: null, passwordHash: await hashPassword(randomToken(24)) },
    });
    if (actor.patientId) {
      await tx.patient.update({ where: { id: actor.patientId }, data: { address: null, city: null, emergencyContact: null } });
    }
    await writeAudit(tx, { actorId: actor.userId, action: "DELETE", entityType: "User", entityId: actor.userId, metadata: { mode: "anonymize-pii-retain-clinical" } as Prisma.InputJsonValue });
  });
}

export async function listStaff(actor: Actor) {
  const tenantId = actor.activeTenantId;
  if (!tenantId) throw new DomainError("TENANT_REQUIRED", "Choose a center first", 400);
  const allowed = hasPermission(actor, "tenant.read", tenantId) || hasPermission(actor, "bookings.manage", tenantId) || hasPermission(actor, "imaging.perform", tenantId);
  if (!allowed) throw new DomainError("FORBIDDEN", "You do not have permission to do that", 403);
  return withScope({ tenantId, userId: actor.userId }, (tx) =>
    tx.tenantMembership.findMany({
      where: { tenantId, status: "ACTIVE", role: { key: { not: "PATIENT" } } },
      include: { user: { select: userPublicSelect }, role: true },
      orderBy: { createdAt: "asc" },
    }),
  );
}

function branchFilterFor(actor: Actor, tenantId: string) {
  const membership = actor.memberships.find((item) => item.tenantId === tenantId && item.status === "ACTIVE");
  return membership && membership.branchScope !== "all" ? { branchId: { in: membership.branchScope } } : {};
}

export async function todayOverview(actor: Actor) {
  const tenantId = actor.activeTenantId;
  if (!tenantId) throw new DomainError("TENANT_REQUIRED", "Choose a center first", 400);
  assertPermission(actor, "tenant.read", tenantId);
  // Day boundaries follow India time, not the server's clock (a UTC host would otherwise shift "today" by 5.5 hours).
  const start = istDayStart();
  const end = istDayStart(new Date(), 1);
  const branch = branchFilterFor(actor, tenantId);
  return withScope({ tenantId, userId: actor.userId }, async (tx) => {
    const [bookings, pendingReports, collections, revenue] = await Promise.all([
      tx.booking.count({ where: { tenantId, ...branch, scheduledAt: { gte: start, lt: end }, status: { notIn: ["CANCELLED"] } } }),
      tx.medicalReport.count({ where: { tenantId, booking: branch, status: { in: ["DRAFT", "ENTERED", "VERIFIED", "APPROVED"] } } }),
      tx.homeCollectionTask.count({ where: { tenantId, booking: branch, status: { in: ["REQUESTED", "ASSIGNED", "EN_ROUTE"] } } }),
      tx.payment.aggregate({ where: { tenantId, invoice: { booking: branch }, status: "CAPTURED", updatedAt: { gte: start, lt: end } }, _sum: { amountPaise: true } }),
    ]);
    return { bookings, pendingReports, collections, capturedPaise: revenue._sum.amountPaise ?? 0 };
  });
}

/** Bookings per IST day for the last `days` days plus the report pipeline, for the center dashboard. */
export async function tenantDashboard(actor: Actor, days = 14) {
  const tenantId = actor.activeTenantId;
  if (!tenantId) throw new DomainError("TENANT_REQUIRED", "Choose a center first", 400);
  assertPermission(actor, "tenant.read", tenantId);
  const from = istDayStart(new Date(), -(days - 1));
  const branch = branchFilterFor(actor, tenantId);
  return withScope({ tenantId, userId: actor.userId }, async (tx) => {
    const [rows, pipeline, upcoming] = await Promise.all([
      tx.booking.findMany({ where: { tenantId, ...branch, createdAt: { gte: from } }, select: { createdAt: true, totalPaise: true, status: true } }),
      tx.medicalReport.groupBy({ by: ["status"], where: { tenantId, booking: branch }, _count: true }),
      tx.booking.findMany({
        where: { tenantId, ...branch, scheduledAt: { gte: istDayStart() }, status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS"] } },
        orderBy: { scheduledAt: "asc" },
        take: 6,
        select: { id: true, publicCode: true, scheduledAt: true, status: true, visitType: true, patient: { select: { user: { select: { name: true } } } }, branch: { select: { name: true } } },
      }),
    ]);
    const series = new Map<string, { day: string; bookings: number; revenuePaise: number }>();
    for (let i = 0; i < days; i += 1) {
      const key = istDayKey(istDayStart(new Date(), -(days - 1 - i)));
      series.set(key, { day: key, bookings: 0, revenuePaise: 0 });
    }
    for (const row of rows) {
      const entry = series.get(istDayKey(row.createdAt));
      if (!entry) continue;
      entry.bookings += 1;
      if (row.status !== "CANCELLED" && row.status !== "REFUNDED") entry.revenuePaise += row.totalPaise;
    }
    return { trend: [...series.values()], pipeline, upcoming };
  });
}
