import { prismaPrivileged } from "@/lib/db";
import { DomainError, errorMessage } from "@/lib/errors";
import { hashPassword, verifyPassword, assertPasswordPolicy } from "@/lib/password";
import { randomToken, sha256 } from "@/lib/crypto";
import { rateLimitShared } from "@/lib/rate-limit";
import { getEnv } from "@/lib/env";
import { writeAudit } from "@/lib/audit";
import { enqueue } from "@/lib/services/notify";
import type { Actor, BranchScope, Membership } from "@/domain/actor";
import type { Prisma } from "@prisma/client";

const IDLE_MS = 12 * 60 * 60 * 1000;
const ABSOLUTE_MS = 7 * 24 * 60 * 60 * 1000;

function policy(password: string) {
  try {
    assertPasswordPolicy(password);
  } catch (error) {
    throw new DomainError("PASSWORD", errorMessage(error), 400);
  }
}

export async function loadActor(userId: string, activeTenantId: string | null, activeBranchId: string | null): Promise<Actor> {
  const user = await prismaPrivileged.user.findUnique({ where: { id: userId }, include: { patient: true } });
  if (!user || user.deletedAt || user.status !== "ACTIVE") {
    throw new DomainError("UNAUTHENTICATED", "Sign in again", 401);
  }
  const memberships = await prismaPrivileged.tenantMembership.findMany({
    where: { userId, status: "ACTIVE" },
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  });
  const assignments = await prismaPrivileged.staffAssignment.findMany({ where: { userId } });
  const mapped: Membership[] = memberships.map((membership) => {
    const broad = membership.role.key === "CENTER_OWNER" || membership.role.key === "SUPER_ADMIN" || membership.role.key === "PATIENT";
    const branchScope: BranchScope = broad
      ? "all"
      : assignments.filter((assignment) => assignment.tenantId === membership.tenantId).map((assignment) => assignment.branchId);
    return {
      tenantId: membership.tenantId,
      roleKey: membership.role.key,
      permissions: membership.role.permissions.map((item) => item.permission.key),
      branchScope,
      status: "ACTIVE",
    };
  });
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    patientId: user.patient?.id ?? null,
    isSuperAdmin: mapped.some((membership) => membership.roleKey === "SUPER_ADMIN"),
    activeTenantId,
    activeBranchId,
    memberships: mapped,
  };
}

async function roleByKey(key: string) {
  const role = await prismaPrivileged.role.findUnique({ where: { key } });
  if (!role) throw new DomainError("ROLE_MISSING", `Role ${key} is not configured`, 500);
  return role;
}

export async function login(input: { email: string; password: string; ip?: string | null; userAgent?: string | null }) {
  const email = input.email.trim().toLowerCase();
  const limit = await rateLimitShared(`login:${input.ip ?? "local"}`, 20, 10 * 60 * 1000);
  if (!limit.ok) throw new DomainError("RATE_LIMIT", "Too many sign-in attempts. Try again shortly.", 429);
  const user = await prismaPrivileged.user.findUnique({ where: { email } });
  if (!user || user.deletedAt || user.status === "DISABLED" || user.status === "SUSPENDED") {
    throw new DomainError("INVALID_LOGIN", "Email or password is incorrect", 401);
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new DomainError("LOCKED", "This account is temporarily locked after failed sign-ins", 423);
  }
  const matches = await verifyPassword(input.password, user.passwordHash);
  if (!matches) {
    const failures = user.failedLoginCount + 1;
    await prismaPrivileged.user.update({
      where: { id: user.id },
      data: { failedLoginCount: failures, lockedUntil: failures >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null },
    });
    throw new DomainError("INVALID_LOGIN", "Email or password is incorrect", 401);
  }
  await prismaPrivileged.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  const token = randomToken();
  const csrf = randomToken(24);
  const membership = await prismaPrivileged.tenantMembership.findFirst({
    where: { userId: user.id, status: "ACTIVE", tenantId: { not: null }, role: { key: { not: "PATIENT" } } },
    orderBy: { createdAt: "asc" },
  });
  const now = Date.now();
  await prismaPrivileged.session.create({
    data: {
      userId: user.id,
      tokenHash: sha256(token),
      csrfSecret: csrf,
      userAgent: input.userAgent,
      ipAddress: input.ip,
      activeTenantId: membership?.tenantId ?? null,
      expiresAt: new Date(now + IDLE_MS),
      absoluteExpiresAt: new Date(now + ABSOLUTE_MS),
    },
  });
  await prismaPrivileged.auditLog.create({
    data: { actorId: user.id, tenantId: membership?.tenantId ?? null, action: "LOGIN", entityType: "User", entityId: user.id, ipAddress: input.ip },
  });
  const actor = await loadActor(user.id, membership?.tenantId ?? null, null);
  return { token, csrf, actor };
}

export async function resolveSession(token: string | undefined | null) {
  if (!token) return null;
  const session = await prismaPrivileged.session.findUnique({ where: { tokenHash: sha256(token) } });
  if (!session || session.revokedAt || session.expiresAt < new Date() || session.absoluteExpiresAt < new Date()) return null;
  if (Date.now() - session.lastSeenAt.getTime() > 5 * 60 * 1000) {
    await prismaPrivileged.session.update({
      where: { id: session.id },
      data: {
        lastSeenAt: new Date(),
        expiresAt: new Date(Math.min(session.absoluteExpiresAt.getTime(), Date.now() + IDLE_MS)),
      },
    });
  }
  const actor = await loadActor(session.userId, session.activeTenantId, session.activeBranchId);
  return { sessionId: session.id, csrf: session.csrfSecret, actor };
}

export async function revokeSession(sessionId: string, actorId: string) {
  await prismaPrivileged.session.updateMany({
    where: { id: sessionId, userId: actorId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllSessions(userId: string) {
  await prismaPrivileged.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function listSessions(userId: string) {
  return prismaPrivileged.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: "desc" },
    select: { id: true, userAgent: true, ipAddress: true, createdAt: true, lastSeenAt: true, activeTenantId: true },
  });
}

export async function switchTenant(sessionId: string, actor: Actor, tenantId: string | null) {
  if (tenantId) {
    const allowed = actor.memberships.some((membership) => membership.status === "ACTIVE" && membership.tenantId === tenantId);
    if (!allowed) throw new DomainError("FORBIDDEN", "You are not a member of that center", 403);
  } else if (!actor.isSuperAdmin) {
    throw new DomainError("FORBIDDEN", "Platform scope is limited to super admins", 403);
  }
  await prismaPrivileged.session.update({ where: { id: sessionId }, data: { activeTenantId: tenantId, activeBranchId: null } });
}

export async function registerPatient(input: {
  name: string;
  email: string;
  phone?: string;
  password: string;
  dateOfBirth: Date;
  sex: "FEMALE" | "MALE" | "INTERSEX" | "UNKNOWN";
  city?: string;
  state?: string;
  ip?: string | null;
}) {
  const limit = await rateLimitShared(`register:${input.ip ?? "local"}`, 10, 60 * 60 * 1000);
  if (!limit.ok) throw new DomainError("RATE_LIMIT", "Too many registrations from this network", 429);
  policy(input.password);
  const email = input.email.trim().toLowerCase();
  const existing = await prismaPrivileged.user.findUnique({ where: { email } });
  if (existing) throw new DomainError("EMAIL_IN_USE", "An account with that email already exists", 409);
  const role = await roleByKey("PATIENT");
  const passwordHash = await hashPassword(input.password);
  const user = await prismaPrivileged.user.create({
    data: {
      name: input.name.trim(),
      email,
      phone: input.phone?.trim() || null,
      passwordHash,
      isSynthetic: false,
      patient: {
        create: { dateOfBirth: input.dateOfBirth, sex: input.sex, city: input.city, state: input.state, isSynthetic: false },
      },
      memberships: { create: { roleId: role.id, status: "ACTIVE", acceptedAt: new Date(), tenantId: null } },
    },
  });
  await prismaPrivileged.auditLog.create({
    data: { actorId: user.id, action: "CREATE", entityType: "Patient", entityId: user.id, ipAddress: input.ip },
  });
  return user;
}

export async function registerCenter(input: {
  ownerName: string;
  email: string;
  phone: string;
  password: string;
  centerName: string;
  legalName: string;
  slug: string;
  city: string;
  state: string;
  address: string;
  gstin?: string;
  ip?: string | null;
}) {
  policy(input.password);
  const email = input.email.trim().toLowerCase();
  const slug = input.slug.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new DomainError("SLUG", "Use a lowercase slug with hyphens only", 400);
  const [emailOwner, slugOwner] = await Promise.all([
    prismaPrivileged.user.findUnique({ where: { email } }),
    prismaPrivileged.tenant.findUnique({ where: { slug } }),
  ]);
  if (emailOwner) throw new DomainError("EMAIL_IN_USE", "An account with that email already exists", 409);
  if (slugOwner) throw new DomainError("SLUG", "That center URL is already taken", 409);
  const role = await roleByKey("CENTER_OWNER");
  const passwordHash = await hashPassword(input.password);
  return prismaPrivileged.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name: input.ownerName.trim(), email, phone: input.phone.trim(), passwordHash, isSynthetic: false },
    });
    const tenant = await tx.tenant.create({
      data: {
        name: input.centerName.trim(),
        legalName: input.legalName.trim(),
        slug,
        email,
        phone: input.phone.trim(),
        city: input.city.trim(),
        state: input.state.trim(),
        address: input.address.trim(),
        gstin: input.gstin?.trim() || null,
        about: `${input.centerName.trim()} is pending verification on MediScan Hub.`,
        status: "PENDING",
        isSynthetic: false,
      },
    });
    await tx.tenantMembership.create({
      data: { tenantId: tenant.id, userId: user.id, roleId: role.id, status: "ACTIVE", acceptedAt: new Date() },
    });
    await writeAudit(tx, { tenantId: tenant.id, actorId: user.id, action: "CREATE", entityType: "Tenant", entityId: tenant.id, ipAddress: input.ip });
    return { userId: user.id, tenantId: tenant.id, slug: tenant.slug };
  });
}

export async function requestPasswordReset(email: string) {
  const user = await prismaPrivileged.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user || user.deletedAt || user.status !== "ACTIVE") return { accepted: true as const, devLink: null };
  const token = randomToken();
  await prismaPrivileged.passwordReset.create({
    data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
  });
  const link = `${getEnv().APP_URL}/recovery?token=${token}`;
  await enqueue(prismaPrivileged, {
    userId: user.id,
    channel: user.phone ? "EMAIL" : "EMAIL",
    templateKey: "password_reset",
    to: user.email,
    payload: { link, recipientName: user.name },
  });
  return { accepted: true as const, devLink: getEnv().NODE_ENV === "production" ? null : link };
}

export async function resetPassword(token: string, password: string) {
  policy(password);
  const reset = await prismaPrivileged.passwordReset.findUnique({ where: { tokenHash: sha256(token) } });
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
    throw new DomainError("RESET_INVALID", "This recovery link is invalid or expired", 400);
  }
  const passwordHash = await hashPassword(password);
  await prismaPrivileged.$transaction(async (tx) => {
    await tx.user.update({ where: { id: reset.userId }, data: { passwordHash, failedLoginCount: 0, lockedUntil: null } });
    await tx.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } });
    await tx.session.updateMany({ where: { userId: reset.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await writeAudit(tx, { actorId: reset.userId, action: "UPDATE", entityType: "User", entityId: reset.userId });
  });
}

export async function createInvitation(input: {
  tenantId: string;
  email: string;
  roleKey: string;
  branchId?: string | null;
  sentById: string;
}) {
  if (input.roleKey === "SUPER_ADMIN" || input.roleKey === "PATIENT") {
    throw new DomainError("ROLE", "That role cannot be invited into a center", 400);
  }
  if (input.branchId) {
    const branch = await prismaPrivileged.branch.findFirst({ where: { id: input.branchId, tenantId: input.tenantId, deletedAt: null } });
    if (!branch) throw new DomainError("NOT_FOUND", "Branch not found", 404);
  }
  const role = await roleByKey(input.roleKey);
  const token = randomToken();
  await prismaPrivileged.invitation.create({
    data: {
      tenantId: input.tenantId,
      email: input.email.trim().toLowerCase(),
      roleId: role.id,
      branchId: input.branchId || null,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      sentById: input.sentById,
    },
  });
  const tenant = await prismaPrivileged.tenant.findUnique({ where: { id: input.tenantId } });
  const link = `${getEnv().APP_URL}/invite/${token}`;
  await enqueue(prismaPrivileged, {
    tenantId: input.tenantId,
    channel: "EMAIL",
    templateKey: "invitation",
    to: input.email.trim().toLowerCase(),
    payload: { link, centerName: tenant?.name ?? "a diagnostic center", recipientName: input.email },
  });
  await prismaPrivileged.auditLog.create({
    data: { tenantId: input.tenantId, actorId: input.sentById, action: "CREATE", entityType: "Invitation", metadata: { email: input.email, role: input.roleKey } as Prisma.InputJsonValue },
  });
  return { token, link: getEnv().NODE_ENV === "production" ? null : link };
}

export async function previewInvitation(token: string) {
  const invite = await prismaPrivileged.invitation.findUnique({
    where: { tokenHash: sha256(token) },
    include: { tenant: true, role: true, branch: true },
  });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) return null;
  return { email: invite.email, center: invite.tenant.name, role: invite.role.name, branch: invite.branch?.name ?? null };
}

export async function acceptInvitation(input: { token: string; name?: string; password?: string }) {
  const invite = await prismaPrivileged.invitation.findUnique({
    where: { tokenHash: sha256(input.token) },
    include: { role: true },
  });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    throw new DomainError("INVITE_INVALID", "This invitation is invalid or expired", 400);
  }
  let user = await prismaPrivileged.user.findUnique({ where: { email: invite.email } });
  if (!user) {
    if (!input.password || !input.name) throw new DomainError("PASSWORD", "Name and password are required to create your account", 400);
    policy(input.password);
    user = await prismaPrivileged.user.create({
      data: { email: invite.email, name: input.name.trim(), passwordHash: await hashPassword(input.password) },
    });
  }
  await prismaPrivileged.$transaction(async (tx) => {
    await tx.tenantMembership.upsert({
      where: { tenantId_userId_roleId: { tenantId: invite.tenantId, userId: user.id, roleId: invite.roleId } },
      update: { status: "ACTIVE", acceptedAt: new Date() },
      create: { tenantId: invite.tenantId, userId: user.id, roleId: invite.roleId, status: "ACTIVE", acceptedAt: new Date(), invitedBy: invite.sentById },
    });
    if (invite.branchId) {
      await tx.staffAssignment.upsert({
        where: { userId_branchId_roleId: { userId: user.id, branchId: invite.branchId, roleId: invite.roleId } },
        update: {},
        create: { tenantId: invite.tenantId, userId: user.id, branchId: invite.branchId, roleId: invite.roleId },
      });
    }
    await tx.invitation.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
    await writeAudit(tx, { tenantId: invite.tenantId, actorId: user.id, action: "UPDATE", entityType: "Invitation", entityId: invite.id });
  });
  return { email: user.email };
}

export async function changePassword(userId: string, currentPassword: string, nextPassword: string) {
  policy(nextPassword);
  const user = await prismaPrivileged.user.findUnique({ where: { id: userId } });
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new DomainError("INVALID_LOGIN", "Current password is incorrect", 401);
  }
  await prismaPrivileged.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(nextPassword) } });
  await revokeAllSessions(userId);
}

export async function superAdminCount() {
  const role = await prismaPrivileged.role.findUnique({ where: { key: "SUPER_ADMIN" } });
  if (!role) return 0;
  return prismaPrivileged.tenantMembership.count({ where: { roleId: role.id, status: "ACTIVE" } });
}

export async function bootstrapSuperAdmin(input: { name: string; email: string; password: string; secret: string }) {
  const envSecret = process.env.BOOTSTRAP_SECRET ?? process.env.CRON_SECRET;
  if (!envSecret || input.secret !== envSecret) throw new DomainError("FORBIDDEN", "Bootstrap secret is incorrect", 403);
  const existing = await superAdminCount();
  if (existing > 0 && process.env.NODE_ENV === "production") {
    throw new DomainError("FORBIDDEN", "A super admin already exists. Create additional admins from the platform desk.", 403);
  }
  policy(input.password);
  const email = input.email.trim().toLowerCase();
  const role = await roleByKey("SUPER_ADMIN");
  let user = await prismaPrivileged.user.findUnique({ where: { email } });
  if (!user) {
    user = await prismaPrivileged.user.create({
      data: { name: input.name.trim(), email, passwordHash: await hashPassword(input.password), isSynthetic: false, status: "ACTIVE" },
    });
  }
  const membership = await prismaPrivileged.tenantMembership.findFirst({ where: { userId: user.id, roleId: role.id, tenantId: null } });
  if (!membership) {
    await prismaPrivileged.tenantMembership.create({ data: { tenantId: null, userId: user.id, roleId: role.id, status: "ACTIVE", acceptedAt: new Date() } });
  } else if (membership.status !== "ACTIVE") {
    await prismaPrivileged.tenantMembership.update({ where: { id: membership.id }, data: { status: "ACTIVE", acceptedAt: new Date() } });
  }
  return { userId: user.id, email: user.email };
}
