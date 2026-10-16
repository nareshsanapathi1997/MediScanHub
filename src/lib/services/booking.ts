import { Prisma, type BookingStatus, type ServiceKind, type SlotKind, type VisitType } from "@prisma/client";
import { prisma, prismaPrivileged } from "@/lib/db";
import { withScope, type Tx } from "@/lib/scope";
import { DomainError } from "@/lib/errors";
import { publicCode, stableHash } from "@/lib/crypto";
import { writeAudit } from "@/lib/audit";
import { hashPassword } from "@/lib/password";
import { randomToken } from "@/lib/crypto";
import { getEnv } from "@/lib/env";
import { enqueue } from "@/lib/services/notify";
import { formatChronicSummary } from "@/lib/services/patient-extras";
import { getObject } from "@/lib/adapters/storage";
import { assertCapacity } from "@/lib/services/subscription";
import type { Actor } from "@/domain/actor";
import { assertBranchAccess, assertPermission, hasPermission } from "@/domain/actor";
import { BOOKING_TRANSITIONS, COLLECTION_TRANSITIONS, assertTransition, permissionForBookingTransition } from "@/domain/state";

const CONSENT_VERSION = "2026-10-01";
const CONSENT_PURPOSE = "diagnostic-booking";

export type BookingDraft = {
  branchId: string;
  slotId?: string;
  serviceIds: string[];
  packageIds: string[];
  visitType: VisitType;
  address?: string;
  notes?: string;
  idempotencyKey: string;
  referralEmail?: string;
  dependentId?: string;
  prescriptionStorageKey?: string;
  prescriptionFileName?: string;
  walletRedeemPaise?: number;
  insurancePolicyId?: string;
  tpaReference?: string;
};

type Expanded = { serviceId: string; kind: ServiceKind; name: string };
type PricedItem = { serviceId?: string; packageId?: string; name: string; pricePaise: number; expanded: Expanded[] };

function isUnique(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function priceQuote(tx: Tx, tenantId: string, branchId: string, serviceIds: string[], packageIds: string[]) {
  if (serviceIds.length + packageIds.length === 0) throw new DomainError("CATALOG", "Choose at least one test or package", 400);
  const items: PricedItem[] = [];
  let total = 0;
  const now = new Date();
  for (const serviceId of serviceIds) {
    const service = await tx.diagnosticService.findFirst({ where: { id: serviceId, tenantId, published: true, archivedAt: null } });
    if (!service) throw new DomainError("CATALOG", "A selected test is not available", 400);
    const link = await tx.branchService.findUnique({ where: { branchId_serviceId: { branchId, serviceId } } });
    if (!link?.active) throw new DomainError("CATALOG", `${service.name} is not offered at this branch`, 400);
    const price = await tx.servicePrice.findFirst({
      where: { tenantId, branchId, serviceId, effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] },
      orderBy: { effectiveFrom: "desc" },
    });
    if (!price) throw new DomainError("PRICE", `${service.name} has no active price at this branch`, 400);
    const net = price.pricePaise - price.discountPaise;
    total += net;
    items.push({ serviceId, name: service.name, pricePaise: net, expanded: [{ serviceId, kind: service.kind, name: service.name }] });
  }
  for (const packageId of packageIds) {
    const pkg = await tx.testPackage.findFirst({
      where: { id: packageId, tenantId, published: true, archivedAt: null },
      include: { items: { include: { service: true } } },
    });
    if (!pkg) throw new DomainError("CATALOG", "A selected package is not available", 400);
    total += pkg.pricePaise;
    items.push({
      packageId,
      name: pkg.name,
      pricePaise: pkg.pricePaise,
      expanded: pkg.items.map((item) => ({ serviceId: item.serviceId, kind: item.service.kind, name: item.service.name })),
    });
  }
  return { total, items };
}

export async function quoteBooking(input: { branchId: string; serviceIds: string[]; packageIds: string[] }) {
  const branch = await prisma.branch.findFirst({
    where: { id: input.branchId, active: true, deletedAt: null, tenant: { status: "ACTIVE", deletedAt: null } },
    include: { tenant: true },
  });
  if (!branch) throw new DomainError("NOT_FOUND", "That branch is not open for booking", 404);
  const priced = await withScope({ tenantId: branch.tenantId }, (tx) => priceQuote(tx, branch.tenantId, branch.id, input.serviceIds, input.packageIds));
  return { branch, tenant: branch.tenant, ...priced };
}

async function acquireSlot(tx: Tx, tenantId: string, branchId: string, slotId: string, kind: SlotKind) {
  const updated = await tx.$executeRaw`
    UPDATE "AvailabilitySlot"
    SET "bookedCount" = "bookedCount" + 1, "updatedAt" = NOW()
    WHERE id = ${slotId}::uuid
      AND "tenantId" = ${tenantId}::uuid
      AND "branchId" = ${branchId}::uuid
      AND kind = ${kind}::"SlotKind"
      AND "bookedCount" < capacity
      AND "startsAt" > NOW()
  `;
  if (Number(updated) !== 1) throw new DomainError("SLOT_FULL", "That slot was just taken. Choose another time.", 409);
  return tx.availabilitySlot.findFirstOrThrow({ where: { id: slotId, tenantId } });
}

async function releaseSlot(tx: Tx, tenantId: string, slotId: string) {
  await tx.$executeRaw`
    UPDATE "AvailabilitySlot"
    SET "bookedCount" = GREATEST("bookedCount" - 1, 0), "updatedAt" = NOW()
    WHERE id = ${slotId}::uuid AND "tenantId" = ${tenantId}::uuid
  `;
}

async function ensureRecord(tx: Tx, tenantId: string, branchId: string, patientId: string, branchCode: string) {
  const existing = await tx.patientBranchRecord.findUnique({ where: { patientId_branchId: { patientId, branchId } } });
  if (existing) return existing;
  const count = await tx.patientBranchRecord.count({ where: { tenantId } });
  return tx.patientBranchRecord.create({
    data: { tenantId, branchId, patientId, mrn: `${branchCode}-${String(count + 1).padStart(5, "0")}` },
  });
}

export async function openClinicalWork(tx: Tx, tenantId: string, bookingId: string, branchId: string, items: PricedItem[], actorId: string) {
  const expanded = new Map<string, Expanded>();
  for (const item of items) for (const service of item.expanded) expanded.set(service.serviceId, service);
  const services = [...expanded.values()];
  const lab = services.filter((service) => service.kind === "LAB");
  const imaging = services.filter((service) => service.kind === "IMAGING");
  if (lab.length) {
    const order = await tx.labOrder.create({ data: { tenantId, branchId, bookingId, status: "ORDERED" } });
    for (const service of lab) {
      const sample = await tx.sample.create({ data: { tenantId, labOrderId: order.id, serviceId: service.serviceId, status: "PENDING" } });
      await tx.sampleBarcode.create({ data: { tenantId, sampleId: sample.id, code: publicCode("BC").replace("-", "") } });
      await tx.sampleEvent.create({ data: { tenantId, sampleId: sample.id, type: "CREATED", actorId, note: "Sample record opened" } });
    }
    await tx.medicalReport.create({ data: { tenantId, bookingId, labOrderId: order.id, status: "DRAFT", title: "Laboratory report" } });
  }
  if (imaging.length) {
    const modality = imaging.map((service) => service.name).join(", ");
    const order = await tx.imagingOrder.create({
      data: { tenantId, bookingId, modality, status: "SCHEDULED", prepInstructions: "Follow the preparation shared by the center. Arrive 15 minutes early." },
    });
    for (const service of imaging) {
      await tx.imagingStudy.create({
        data: { tenantId, imagingOrderId: order.id, serviceId: service.serviceId, accession: publicCode("ACC"), status: "SCHEDULED" },
      });
    }
    await tx.medicalReport.create({ data: { tenantId, bookingId, imagingOrderId: order.id, status: "DRAFT", title: "Imaging report" } });
  }
}

async function notifyBooking(tx: Tx, input: { tenantId: string; userId: string; email: string; phone?: string | null; templateKey: string; payload: Record<string, string> }) {
  await enqueue(tx, { tenantId: input.tenantId, userId: input.userId, channel: "EMAIL", templateKey: input.templateKey, to: input.email, payload: input.payload });
  await enqueue(tx, { tenantId: input.tenantId, userId: input.userId, channel: "IN_APP", templateKey: input.templateKey, to: input.email, payload: input.payload });
  if (input.phone) {
    await enqueue(tx, { tenantId: input.tenantId, userId: input.userId, channel: "WHATSAPP", templateKey: input.templateKey, to: input.phone, payload: input.payload });
  }
}

async function insertBooking(tx: Tx, actor: Actor, branch: { id: string; tenantId: string; code: string; name: string; tenant: { name: string } }, input: BookingDraft, status: BookingStatus, authorId = actor.userId) {
  await assertCapacity(tx, branch.tenantId, "booking");
  if (!actor.patientId) throw new DomainError("PATIENT", "A patient profile is required", 400);
  const kind: SlotKind = input.visitType === "HOME_COLLECTION" ? "HOME" : input.visitType === "WALK_IN" ? "CENTER" : "CENTER";
  if (input.visitType === "HOME_COLLECTION" && !input.address?.trim()) throw new DomainError("ADDRESS", "Home collection needs a pickup address", 400);
  let slot: { id: string; startsAt: Date } | null = null;
  if (input.visitType !== "WALK_IN") {
    if (!input.slotId) throw new DomainError("SLOT", "Choose a time slot", 400);
    const acquired = await acquireSlot(tx, branch.tenantId, branch.id, input.slotId, input.visitType === "HOME_COLLECTION" ? "HOME" : kind);
    slot = acquired;
  }
  const priced = await priceQuote(tx, branch.tenantId, branch.id, input.serviceIds, input.packageIds);
  const consent = await tx.patientConsent.create({
    data: {
      tenantId: branch.tenantId,
      patientId: actor.patientId,
      userId: actor.userId,
      purpose: CONSENT_PURPOSE,
      version: CONSENT_VERSION,
    },
  });
  await ensureRecord(tx, branch.tenantId, branch.id, actor.patientId, branch.code);
  let referralUserId: string | null = null;
  if (input.referralEmail) {
    const doctor = await tx.user.findFirst({
      where: { email: input.referralEmail.trim().toLowerCase(), memberships: { some: { tenantId: branch.tenantId, status: "ACTIVE", role: { key: "DOCTOR" } } } },
    });
    referralUserId = doctor?.id ?? null;
  }
  if (input.dependentId) {
    const dependent = await tx.patientDependent.findFirst({ where: { id: input.dependentId, guardianPatientId: actor.patientId } });
    if (!dependent) throw new DomainError("NOT_FOUND", "Family member not found", 404);
  }
  let insurancePolicyId: string | null = null;
  if (input.insurancePolicyId) {
    const policy = await tx.insurancePolicy.findFirst({ where: { id: input.insurancePolicyId, patientId: actor.patientId } });
    if (!policy) throw new DomainError("NOT_FOUND", "Insurance policy not found", 404);
    insurancePolicyId = policy.id;
  }
  const chronic = await tx.patientChronicCondition.findMany({ where: { patientId: actor.patientId }, orderBy: { condition: "asc" }, take: 8 });
  const chronicLine = formatChronicSummary(chronic);
  let notes = input.notes?.trim() ?? "";
  if (chronicLine && !notes.toLowerCase().includes("chronic")) {
    notes = notes ? `${notes}\n\nChronic conditions: ${chronicLine}` : `Chronic conditions: ${chronicLine}`;
  }
  let walletRedeem = Math.max(0, input.walletRedeemPaise ?? 0);
  if (walletRedeem > 0) {
    const wallet = await tx.patientWallet.findUnique({ where: { patientId: actor.patientId } });
    const balance = wallet?.balancePaise ?? 0;
    walletRedeem = Math.min(walletRedeem, balance, priced.total);
    if (walletRedeem > 0) {
      await tx.patientWallet.update({ where: { patientId: actor.patientId }, data: { balancePaise: { decrement: walletRedeem } } });
      await tx.walletTransaction.create({
        data: { patientId: actor.patientId, amountPaise: -walletRedeem, reason: "Redeemed at booking", bookingId: null },
      });
    }
  }
  const payable = priced.total - walletRedeem;
  const lineItems = priced.items.map((item) => ({ name: item.name, amountPaise: item.pricePaise }));
  if (walletRedeem > 0) lineItems.push({ name: "Wallet redemption", amountPaise: -walletRedeem });
  const booking = await tx.booking.create({
    data: {
      tenantId: branch.tenantId,
      branchId: branch.id,
      patientId: actor.patientId,
      dependentId: input.dependentId ?? null,
      prescriptionStorageKey: input.prescriptionStorageKey ?? null,
      prescriptionFileName: input.prescriptionFileName ?? null,
      slotId: slot?.id,
      consentId: consent.id,
      createdById: authorId,
      referralUserId,
      publicCode: publicCode("MS"),
      visitType: input.visitType,
      status,
      scheduledAt: slot?.startsAt ?? new Date(),
      address: input.address?.trim(),
      notes: notes || null,
      totalPaise: priced.total,
      idempotencyKey: `${branch.tenantId}:booking:${input.idempotencyKey}`,
      items: { create: priced.items.map((item) => ({ tenantId: branch.tenantId, serviceId: item.serviceId, packageId: item.packageId, name: item.name, pricePaise: item.pricePaise })) },
      history: { create: { tenantId: branch.tenantId, toStatus: status, actorId: authorId, reason: status === "CONFIRMED" ? "Walk-in confirmed" : "Booking created" } },
    },
  });
  await tx.invoice.create({
    data: {
      tenantId: branch.tenantId,
      kind: "PATIENT",
      status: payable <= 0 ? "PAID" : "ISSUED",
      number: publicCode("INV"),
      bookingId: booking.id,
      patientId: actor.patientId,
      subtotalPaise: priced.total,
      taxPaise: 0,
      walletRedeemPaise: walletRedeem,
      insurancePolicyId,
      tpaReference: input.tpaReference?.trim() || null,
      totalPaise: Math.max(0, payable),
      lines: lineItems,
    },
  });
  if (payable <= 0 && status === "PENDING") {
    await tx.booking.update({ where: { id: booking.id }, data: { status: "CONFIRMED" } });
    await tx.bookingStatusHistory.create({
      data: { tenantId: branch.tenantId, bookingId: booking.id, fromStatus: "PENDING", toStatus: "CONFIRMED", reason: "Fully covered by wallet" },
    });
    await openClinicalWork(tx, branch.tenantId, booking.id, branch.id, priced.items, authorId);
  }
  if (input.visitType === "HOME_COLLECTION" && slot) {
    await tx.homeCollectionTask.create({
      data: { tenantId: branch.tenantId, bookingId: booking.id, status: "REQUESTED", windowStart: slot.startsAt, windowEnd: new Date(slot.startsAt.getTime() + 60 * 60 * 1000), address: input.address!.trim() },
    });
  }
  if (status === "CONFIRMED") await openClinicalWork(tx, branch.tenantId, booking.id, branch.id, priced.items, authorId);
  const patient = await tx.patient.findFirst({ where: { id: actor.patientId }, include: { user: { select: { email: true, phone: true } } } });
  if (patient && status === "CONFIRMED") {
    await notifyBooking(tx, {
      tenantId: branch.tenantId,
      userId: patient.userId,
      email: patient.user.email,
      phone: patient.user.phone,
      templateKey: input.visitType === "HOME_COLLECTION" ? "home_collection" : "booking_confirmed",
      payload: {
        publicCode: booking.publicCode,
        centerName: branch.tenant.name,
        when: booking.scheduledAt.toISOString(),
        window: `${booking.scheduledAt.toISOString()} ${input.address ?? ""}`.trim(),
        link: `${getEnv().APP_URL}/bookings/${booking.id}`,
      },
    });
  }
  await writeAudit(tx, { tenantId: branch.tenantId, actorId: authorId, action: "CREATE", entityType: "Booking", entityId: booking.id });
  return { bookingId: booking.id, publicCode: booking.publicCode, totalPaise: priced.total, status, items: priced.items };
}

async function readIdempotent(scope: { tenantId: string; userId: string; patientId: string | null }, key: string, hash: string) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const row = await withScope(scope, (tx) => tx.idempotencyRecord.findUnique({ where: { key } }));
    if (row) {
      if (row.requestHash !== hash) throw new DomainError("IDEMPOTENCY_CONFLICT", "This idempotency key was already used for a different booking", 409);
      return row.response as { bookingId: string; publicCode: string; totalPaise: number; status: BookingStatus };
    }
    await new Promise((resolve) => setTimeout(resolve, 40 * (attempt + 1)));
  }
  throw new DomainError("IDEMPOTENCY", "Duplicate booking request could not be resolved", 409);
}

export async function createBooking(actor: Actor, input: BookingDraft) {
  if (input.visitType === "WALK_IN") throw new DomainError("VISIT", "Walk-ins are recorded by center staff", 400);
  const allowed = hasPermission(actor, "patient.portal", null) || hasPermission(actor, "bookings.create", null);
  if (!allowed || !actor.patientId) throw new DomainError("FORBIDDEN", "Sign in with a patient profile to book", 403);
  const branch = await prisma.branch.findFirst({
    where: { id: input.branchId, active: true, deletedAt: null, tenant: { status: "ACTIVE", deletedAt: null } },
    include: { tenant: true },
  });
  if (!branch) throw new DomainError("NOT_FOUND", "That branch is not open for booking", 404);
  const scope = { tenantId: branch.tenantId, userId: actor.userId, patientId: actor.patientId };
  const key = `${branch.tenantId}:booking:${input.idempotencyKey}`;
  const hash = stableHash({
    branchId: input.branchId,
    slotId: input.slotId ?? null,
    serviceIds: [...input.serviceIds].sort(),
    packageIds: [...input.packageIds].sort(),
    visitType: input.visitType,
    patientId: actor.patientId,
    address: input.address ?? "",
  });
  try {
    return await withScope(scope, async (tx) => {
      const existing = await tx.idempotencyRecord.findUnique({ where: { key } });
      if (existing) {
        if (existing.requestHash !== hash) throw new DomainError("IDEMPOTENCY_CONFLICT", "This idempotency key was already used for a different booking", 409);
        return existing.response as { bookingId: string; publicCode: string; totalPaise: number; status: BookingStatus };
      }
      const result = await insertBooking(tx, actor, branch, input, "PENDING");
      await tx.idempotencyRecord.create({
        data: { tenantId: branch.tenantId, key, scope: "booking", requestHash: hash, response: result, statusCode: 201, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      });
      return result;
    });
  } catch (error) {
    if (isUnique(error)) return readIdempotent(scope, key, hash);
    throw error;
  }
}

export async function createWalkIn(actor: Actor, input: BookingDraft & { patientId?: string; patient?: { name: string; email: string; phone: string; dateOfBirth: Date; sex: "FEMALE" | "MALE" | "INTERSEX" | "UNKNOWN" } }) {
  const tenantId = actor.activeTenantId;
  if (!tenantId) throw new DomainError("TENANT_REQUIRED", "Choose a center first", 400);
  assertPermission(actor, "bookings.manage", tenantId);
  assertBranchAccess(actor, tenantId, input.branchId);
  let patientActor = actor;
  if (!input.patientId) {
    if (!input.patient) throw new DomainError("PATIENT", "Patient details are required", 400);
    const email = input.patient.email.trim().toLowerCase();
    let user = await prismaPrivileged.user.findUnique({ where: { email }, select: { id: true, email: true, name: true, phone: true, patient: { select: { id: true } } } });
    // Do not attach a walk-in to someone else's existing account just because the email was mistyped.
    const norm = (value: string | null | undefined) => (value ?? "").replace(/\D/g, "").slice(-10);
    if (user && user.name.trim().toLowerCase() !== input.patient.name.trim().toLowerCase() && norm(user.phone) !== norm(input.patient.phone)) {
      throw new DomainError("PATIENT_MISMATCH", "That email already belongs to a patient with a different name and phone. Check the details or search the patient first.", 409);
    }
    if (!user) {
      const role = await prismaPrivileged.role.findUnique({ where: { key: "PATIENT" } });
      if (!role) throw new DomainError("ROLE_MISSING", "Patient role is not configured", 500);
      user = await prismaPrivileged.user.create({
        data: {
          name: input.patient.name.trim(),
          email,
          phone: input.patient.phone.trim(),
          passwordHash: await hashPassword(randomToken(18)),
          isSynthetic: false,
          patient: { create: { dateOfBirth: input.patient.dateOfBirth, sex: input.patient.sex, isSynthetic: false } },
          memberships: { create: { roleId: role.id, status: "ACTIVE", acceptedAt: new Date() } },
        },
        select: { id: true, email: true, name: true, phone: true, patient: { select: { id: true } } },
      });
    }
    if (!user.patient) throw new DomainError("PATIENT", "That email belongs to a staff account without a patient profile", 409);
    patientActor = { ...actor, userId: user.id, patientId: user.patient.id, email: user.email };
  } else {
    const patient = await prismaPrivileged.patient.findUnique({ where: { id: input.patientId }, include: { user: { select: { email: true } } } });
    if (!patient) throw new DomainError("NOT_FOUND", "Patient not found", 404);
    patientActor = { ...actor, userId: patient.userId, patientId: patient.id, email: patient.user.email };
  }
  const branch = await prismaPrivileged.branch.findFirst({ where: { id: input.branchId, tenantId, deletedAt: null }, include: { tenant: true } });
  if (!branch) throw new DomainError("NOT_FOUND", "Branch not found", 404);
  const scope = { tenantId, userId: actor.userId, patientId: patientActor.patientId };
  return withScope(scope, (tx) => insertBooking(tx, patientActor, branch, { ...input, visitType: "WALK_IN" }, "CONFIRMED", actor.userId));
}

const bookingInclude = {
  items: true,
  branch: true,
  dependent: true,
  tenant: { select: { id: true, name: true, slug: true, brandColor: true, phone: true } },
  patient: {
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      chronicConditions: { orderBy: { condition: "asc" as const }, take: 8 },
    },
  },
  history: { orderBy: { createdAt: "asc" as const }, include: { actor: { select: { name: true } } } },
  invoice: { include: { payments: true, insurancePolicy: true, tpaClaims: { orderBy: { createdAt: "desc" as const }, take: 5 } } },
  collection: { include: { assignee: { select: { id: true, name: true } } } },
  labOrder: { include: { samples: { include: { barcode: true } } } },
  imagingOrder: { include: { studies: true } },
} satisfies Prisma.BookingInclude;

export async function readBookingPrescription(actor: Actor, bookingId: string) {
  const booking = await getBooking(actor, bookingId);
  const staff = hasPermission(actor, "bookings.read", booking.tenantId);
  const mine = actor.patientId === booking.patientId;
  if (!mine && !staff && !actor.isSuperAdmin) throw new DomainError("FORBIDDEN", "You cannot download this prescription", 403);
  if (!booking.prescriptionStorageKey) throw new DomainError("NOT_FOUND", "No prescription was uploaded for this visit", 404);
  const bytes = await getObject(booking.prescriptionStorageKey);
  const name = booking.prescriptionFileName ?? "prescription";
  const lower = name.toLowerCase();
  const contentType = lower.endsWith(".pdf") ? "application/pdf" : lower.endsWith(".png") ? "image/png" : "image/jpeg";
  return { bytes, fileName: name, contentType };
}

function doctorRestricted(actor: Actor, tenantId: string) {
  const memberships = actor.memberships.filter((membership) => membership.status === "ACTIVE" && membership.tenantId === tenantId);
  const elevated = memberships.some((membership) => membership.roleKey !== "DOCTOR" && membership.permissions.includes("bookings.read"));
  return !elevated && memberships.some((membership) => membership.roleKey === "DOCTOR");
}

export async function getBooking(actor: Actor, id: string) {
  if (actor.patientId) {
    const own = await withScope({ userId: actor.userId, patientId: actor.patientId }, (tx) =>
      tx.booking.findFirst({ where: { id, patientId: actor.patientId! }, include: bookingInclude }),
    );
    if (own) return own;
  }
  if (!actor.activeTenantId) throw new DomainError("NOT_FOUND", "Booking not found", 404);
  assertPermission(actor, "bookings.read", actor.activeTenantId);
  const row = await withScope({ tenantId: actor.activeTenantId, userId: actor.userId, patientId: actor.patientId }, (tx) =>
    tx.booking.findFirst({ where: { id, tenantId: actor.activeTenantId! }, include: bookingInclude }),
  );
  if (!row) throw new DomainError("NOT_FOUND", "Booking not found", 404);
  if (doctorRestricted(actor, row.tenantId)) {
    if (row.referralUserId !== actor.userId) throw new DomainError("NOT_FOUND", "Booking not found", 404);
  } else {
    assertBranchAccess(actor, row.tenantId, row.branchId);
  }
  return row;
}

export async function listBookings(actor: Actor, filters: { status?: BookingStatus; query?: string; from?: Date; to?: Date; page?: number; pageSize?: number }) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
  const whereBase = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.from || filters.to ? { scheduledAt: { gte: filters.from, lte: filters.to } } : {}),
    ...(filters.query
      ? {
          OR: [
            { publicCode: { contains: filters.query, mode: "insensitive" as const } },
            { patient: { user: { name: { contains: filters.query, mode: "insensitive" as const } } } },
          ],
        }
      : {}),
  };
  if (actor.patientId && !actor.activeTenantId) {
    const where = { ...whereBase, patientId: actor.patientId };
    const [rows, total] = await withScope({ userId: actor.userId, patientId: actor.patientId }, (tx) =>
      Promise.all([
        tx.booking.findMany({ where, include: bookingInclude, orderBy: { scheduledAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
        tx.booking.count({ where }),
      ]),
    );
    return { rows, total, page, pageSize };
  }
  const doctorGlobal = !actor.activeTenantId && actor.memberships.some((membership) => membership.status === "ACTIVE" && membership.roleKey === "DOCTOR");
  if (doctorGlobal) {
    const where = { ...whereBase, referralUserId: actor.userId };
    const rows = await prismaPrivileged.booking.findMany({
      where,
      include: bookingInclude,
      orderBy: { scheduledAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    const total = await prismaPrivileged.booking.count({ where });
    return { rows, total, page, pageSize };
  }
  const tenantId = actor.activeTenantId;
  if (!tenantId) throw new DomainError("TENANT_REQUIRED", "Choose a center first", 400);
  assertPermission(actor, "bookings.read", tenantId);
  const membership = actor.memberships.find((item) => item.tenantId === tenantId && item.status === "ACTIVE");
  const branchFilter = membership && membership.branchScope !== "all" ? { branchId: { in: membership.branchScope } } : {};
  const referralFilter = doctorRestricted(actor, tenantId) ? { referralUserId: actor.userId } : {};
  const where = { ...whereBase, tenantId, ...branchFilter, ...referralFilter };
  const [rows, total] = await withScope({ tenantId, userId: actor.userId, patientId: actor.patientId }, (tx) =>
    Promise.all([
      tx.booking.findMany({ where, include: bookingInclude, orderBy: { scheduledAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      tx.booking.count({ where }),
    ]),
  );
  return { rows, total, page, pageSize };
}

export async function transitionBooking(actor: Actor, bookingId: string, to: BookingStatus, reason?: string) {
  if (!(to in BOOKING_TRANSITIONS)) throw new DomainError("INVALID_TRANSITION", "Unknown booking status", 400);
  // A refund moves money; it must go through refundPayment, never a bare status change.
  if (to === "REFUNDED") throw new DomainError("REFUND", "Issue the refund from Finance. The booking is marked refunded when the provider confirms it.", 409);
  if (to === "CANCELLED" && !reason?.trim()) throw new DomainError("REASON", "Add a cancellation reason", 400);
  const booking = await getBooking(actor, bookingId);
  const patientSelf = actor.patientId === booking.patientId;
  if (patientSelf && to === "CANCELLED") {
    if (!["PENDING", "CONFIRMED"].includes(booking.status)) throw new DomainError("INVALID_TRANSITION", "This visit can no longer be cancelled online", 409);
  } else {
    assertPermission(actor, permissionForBookingTransition(to), booking.tenantId);
    assertBranchAccess(actor, booking.tenantId, booking.branchId);
  }
  assertTransition(BOOKING_TRANSITIONS, booking.status, to, "Booking");
  if (to === "COMPLETED") {
    const reports = await withScope({ tenantId: booking.tenantId, userId: actor.userId }, (tx) => tx.medicalReport.findMany({ where: { bookingId, tenantId: booking.tenantId } }));
    if (reports.some((report) => report.status !== "RELEASED" && report.status !== "AMENDED")) {
      throw new DomainError("REPORT", "Release every report before completing the visit", 409);
    }
  }
  return withScope({ tenantId: booking.tenantId, userId: actor.userId, patientId: actor.patientId }, async (tx) => {
    // Compare-and-set on the status we validated so two concurrent requests cannot both apply
    // (for example a double cancel releasing the same slot twice).
    const claimed = await tx.booking.updateMany({ where: { id: booking.id, tenantId: booking.tenantId, status: booking.status }, data: { status: to } });
    if (claimed.count !== 1) throw new DomainError("CONFLICT", "This booking was changed by someone else. Reload and try again.", 409);
    if (to === "CANCELLED" && booking.slotId) await releaseSlot(tx, booking.tenantId, booking.slotId);
    if (to === "CANCELLED" && booking.collection && booking.collection.status !== "CANCELLED" && booking.collection.status !== "COLLECTED") {
      assertTransition(COLLECTION_TRANSITIONS, booking.collection.status, "CANCELLED", "Home collection");
      await tx.homeCollectionTask.update({ where: { id: booking.collection.id }, data: { status: "CANCELLED" } });
    }
    if (to === "CANCELLED") {
      await tx.sample.updateMany({ where: { tenantId: booking.tenantId, labOrder: { bookingId: booking.id }, status: "PENDING" }, data: { status: "REJECTED", rejectionReason: "Booking cancelled" } });
      await tx.imagingStudy.updateMany({ where: { tenantId: booking.tenantId, imagingOrder: { bookingId: booking.id }, status: "SCHEDULED" }, data: { status: "CANCELLED" } });
    }
    const updated = await tx.booking.findUniqueOrThrow({ where: { id: booking.id } });
    await tx.bookingStatusHistory.create({ data: { tenantId: booking.tenantId, bookingId: booking.id, fromStatus: booking.status, toStatus: to, actorId: actor.userId, reason } });
    if (to === "CONFIRMED" && !booking.labOrder && !booking.imagingOrder) {
      const items = await tx.bookingItem.findMany({ where: { bookingId: booking.id }, include: { service: true, package: { include: { items: { include: { service: true } } } } } });
      const priced: PricedItem[] = items.map((item) => ({
        serviceId: item.serviceId ?? undefined,
        packageId: item.packageId ?? undefined,
        name: item.name,
        pricePaise: item.pricePaise,
        expanded: item.service
          ? [{ serviceId: item.service.id, kind: item.service.kind, name: item.service.name }]
          : (item.package?.items.map((pkg) => ({ serviceId: pkg.serviceId, kind: pkg.service.kind, name: pkg.service.name })) ?? []),
      }));
      await openClinicalWork(tx, booking.tenantId, booking.id, booking.branchId, priced, actor.userId);
    }
    const link = `${getEnv().APP_URL}/bookings/${booking.id}`;
    const templateKey = to === "CANCELLED" ? "booking_cancelled" : to === "CONFIRMED" ? "booking_confirmed" : null;
    if (templateKey) {
      await notifyBooking(tx, {
        tenantId: booking.tenantId,
        userId: booking.patient.user.id,
        email: booking.patient.user.email,
        phone: booking.patient.user.phone,
        templateKey,
        payload: { publicCode: booking.publicCode, centerName: booking.tenant.name, when: booking.scheduledAt.toISOString(), link },
      });
    }
    await writeAudit(tx, { tenantId: booking.tenantId, actorId: actor.userId, action: to === "CANCELLED" ? "CANCEL" : "UPDATE", entityType: "Booking", entityId: booking.id, metadata: { to, reason } });
    return updated;
  });
}

export async function rescheduleBooking(actor: Actor, bookingId: string, slotId: string) {
  const booking = await getBooking(actor, bookingId);
  const patientSelf = actor.patientId === booking.patientId;
  if (!patientSelf) {
    assertPermission(actor, "bookings.manage", booking.tenantId);
    assertBranchAccess(actor, booking.tenantId, booking.branchId);
  }
  if (!["PENDING", "CONFIRMED"].includes(booking.status)) throw new DomainError("INVALID_TRANSITION", "This visit can no longer be rescheduled", 409);
  const kind: SlotKind = booking.visitType === "HOME_COLLECTION" ? "HOME" : "CENTER";
  return withScope({ tenantId: booking.tenantId, userId: actor.userId, patientId: actor.patientId }, async (tx) => {
    if (booking.slotId === slotId) throw new DomainError("SLOT", "Choose a different time slot", 400);
    const slot = await acquireSlot(tx, booking.tenantId, booking.branchId, slotId, kind);
    // Compare-and-set on the old slot: a concurrent reschedule or cancel makes this fail and rolls back the new hold.
    const moved = await tx.booking.updateMany({
      where: { id: booking.id, tenantId: booking.tenantId, slotId: booking.slotId, status: { in: ["PENDING", "CONFIRMED"] } },
      data: { slotId: slot.id, scheduledAt: slot.startsAt },
    });
    if (moved.count !== 1) throw new DomainError("CONFLICT", "This booking was changed by someone else. Reload and try again.", 409);
    if (booking.slotId) await releaseSlot(tx, booking.tenantId, booking.slotId);
    const updated = await tx.booking.findUniqueOrThrow({ where: { id: booking.id } });
    if (booking.collection) {
      await tx.homeCollectionTask.update({
        where: { id: booking.collection.id },
        data: { windowStart: slot.startsAt, windowEnd: new Date(slot.startsAt.getTime() + 60 * 60 * 1000) },
      });
    }
    await tx.bookingStatusHistory.create({
      data: { tenantId: booking.tenantId, bookingId: booking.id, fromStatus: booking.status, toStatus: booking.status, actorId: actor.userId, reason: `Rescheduled to ${slot.startsAt.toISOString()}` },
    });
    await notifyBooking(tx, {
      tenantId: booking.tenantId,
      userId: booking.patient.user.id,
      email: booking.patient.user.email,
      phone: booking.patient.user.phone,
      templateKey: "booking_rescheduled",
      payload: { publicCode: booking.publicCode, centerName: booking.tenant.name, when: slot.startsAt.toISOString(), link: `${getEnv().APP_URL}/bookings/${booking.id}` },
    });
    await writeAudit(tx, { tenantId: booking.tenantId, actorId: actor.userId, action: "UPDATE", entityType: "Booking", entityId: booking.id, metadata: { slotId } });
    return updated;
  });
}

export async function assignCollector(actor: Actor, bookingId: string, assigneeId: string) {
  const booking = await getBooking(actor, bookingId);
  assertPermission(actor, "bookings.manage", booking.tenantId);
  if (!booking.collection) throw new DomainError("COLLECTION", "This booking has no home collection", 400);
  assertTransition(COLLECTION_TRANSITIONS, booking.collection.status, "ASSIGNED", "Home collection");
  return withScope({ tenantId: booking.tenantId, userId: actor.userId }, async (tx) => {
    const assignee = await tx.user.findFirst({ where: { id: assigneeId, memberships: { some: { tenantId: booking.tenantId, status: "ACTIVE", role: { key: "PHLEBOTOMIST" } } } } });
    if (!assignee) throw new DomainError("STAFF", "Assignee must be a phlebotomist at this center", 400);
    const task = await tx.homeCollectionTask.update({ where: { id: booking.collection!.id }, data: { assigneeId, status: "ASSIGNED" } });
    await notifyBooking(tx, {
      tenantId: booking.tenantId,
      userId: booking.patient.user.id,
      email: booking.patient.user.email,
      phone: booking.patient.user.phone,
      templateKey: "home_collection",
      payload: { publicCode: booking.publicCode, centerName: booking.tenant.name, window: task.windowStart.toISOString(), link: `${getEnv().APP_URL}/bookings/${booking.id}` },
    });
    return task;
  });
}

export async function transitionCollection(actor: Actor, bookingId: string, to: "EN_ROUTE" | "COLLECTED" | "FAILED") {
  const booking = await getBooking(actor, bookingId);
  assertPermission(actor, "samples.collect", booking.tenantId);
  if (!booking.collection) throw new DomainError("COLLECTION", "This booking has no home collection", 400);
  if (booking.collection.assigneeId && booking.collection.assigneeId !== actor.userId && !hasPermission(actor, "bookings.manage", booking.tenantId)) {
    throw new DomainError("FORBIDDEN", "This collection is assigned to someone else", 403);
  }
  assertTransition(COLLECTION_TRANSITIONS, booking.collection.status, to, "Home collection");
  return withScope({ tenantId: booking.tenantId, userId: actor.userId }, async (tx) => {
    const task = await tx.homeCollectionTask.update({
      where: { id: booking.collection!.id },
      data: { status: to, collectedAt: to === "COLLECTED" ? new Date() : undefined },
    });
    if (to === "COLLECTED") {
      const samples = await tx.sample.findMany({ where: { tenantId: booking.tenantId, labOrder: { bookingId } } });
      for (const sample of samples) {
        if (sample.status === "PENDING") {
          await tx.sample.update({ where: { id: sample.id }, data: { status: "COLLECTED", collectedAt: new Date() } });
          await tx.sampleEvent.create({ data: { tenantId: booking.tenantId, sampleId: sample.id, type: "COLLECTED", actorId: actor.userId, note: "Collected at home" } });
        }
      }
    }
    return task;
  });
}
