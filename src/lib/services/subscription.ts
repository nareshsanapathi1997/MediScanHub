import type { BillingCycle } from "@prisma/client";
import { prismaPrivileged } from "@/lib/db";
import type { Tx } from "@/lib/scope";
import { withScope } from "@/lib/scope";
import { DomainError } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { publicCode } from "@/lib/crypto";
import { enqueue } from "@/lib/services/notify";
import { getEnv } from "@/lib/env";
import type { Actor } from "@/domain/actor";
import { assertPermission } from "@/domain/actor";

type Db = Tx;

async function activeSubscription(db: Db, tenantId: string) {
  return db.subscription.findFirst({
    where: { tenantId, status: { in: ["TRIALING", "ACTIVE"] } },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function assertCapacity(db: Db, tenantId: string, kind: "branch" | "user" | "booking") {
  const subscription = await activeSubscription(db, tenantId);
  if (!subscription) throw new DomainError("SUBSCRIPTION", "This center does not have an active subscription", 402);
  if (kind === "branch" && subscription.plan.maxBranches != null) {
    const count = await db.branch.count({ where: { tenantId, deletedAt: null } });
    if (count >= subscription.plan.maxBranches) {
      throw new DomainError("LIMIT", `${subscription.plan.name} allows ${subscription.plan.maxBranches} branch`, 402);
    }
  }
  if (kind === "user" && subscription.plan.maxUsers != null) {
    const count = await db.tenantMembership.count({
      where: { tenantId, status: "ACTIVE", role: { key: { notIn: ["PATIENT", "SUPER_ADMIN"] } } },
    });
    if (count >= subscription.plan.maxUsers) throw new DomainError("LIMIT", "Staff seat limit reached for this plan", 402);
  }
  if (kind === "booking" && subscription.plan.maxBookingsPerMonth != null) {
    const start = new Date();
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
    const count = await db.booking.count({ where: { tenantId, createdAt: { gte: start }, status: { not: "CANCELLED" } } });
    if (count >= subscription.plan.maxBookingsPerMonth) {
      throw new DomainError("LIMIT", "Monthly booking limit reached for this plan", 402);
    }
  }
  return subscription;
}

export async function listPlans() {
  return prismaPrivileged.subscriptionPlan.findMany({ where: { active: true }, orderBy: { monthlyPricePaise: "asc" } });
}

export async function listPlansPage(paging: { skip: number; take: number }) {
  const where = { active: true };
  const [items, total] = await Promise.all([
    prismaPrivileged.subscriptionPlan.findMany({ where, orderBy: [{ monthlyPricePaise: "asc" }, { id: "asc" }], skip: paging.skip, take: paging.take }),
    prismaPrivileged.subscriptionPlan.count({ where }),
  ]);
  return { items, total };
}

export async function ensureTrial(tenantId: string, planTier = "STARTER") {
  const existing = await prismaPrivileged.subscription.findFirst({ where: { tenantId, status: { in: ["TRIALING", "ACTIVE"] } } });
  if (existing) return existing;
  const plan = await prismaPrivileged.subscriptionPlan.findUnique({ where: { tier: planTier } });
  if (!plan) throw new DomainError("PLAN", "Subscription plan is not configured", 500);
  const start = new Date();
  const trialEnd = new Date(start.getTime() + plan.trialDays * 24 * 60 * 60 * 1000);
  return prismaPrivileged.subscription.create({
    data: {
      tenantId,
      planId: plan.id,
      status: "TRIALING",
      billingCycle: "MONTHLY",
      trialEndsAt: trialEnd,
      currentPeriodStart: start,
      currentPeriodEnd: trialEnd,
    },
  });
}

export async function changePlan(actor: Actor, planTier: string, billingCycle: BillingCycle) {
  const tenantId = actor.activeTenantId;
  if (!tenantId) throw new DomainError("TENANT_REQUIRED", "Choose a center first", 400);
  assertPermission(actor, "tenant.manage", tenantId);
  const plan = await prismaPrivileged.subscriptionPlan.findUnique({ where: { tier: planTier } });
  if (!plan || !plan.active) throw new DomainError("PLAN", "That plan is not available", 404);
  const current = await prismaPrivileged.subscription.findFirst({ where: { tenantId, status: { in: ["TRIALING", "ACTIVE", "PAST_DUE"] } }, include: { plan: true } });
  if (current?.plan.maxBranches != null && plan.maxBranches != null && plan.maxBranches < current.plan.maxBranches) {
    const branches = await prismaPrivileged.branch.count({ where: { tenantId, deletedAt: null } });
    if (branches > plan.maxBranches) throw new DomainError("LIMIT", "Remove branches before moving to a smaller plan", 409);
  }
  const price = billingCycle === "ANNUAL" ? plan.annualPricePaise : plan.monthlyPricePaise;
  const gst = await prismaPrivileged.platformSetting.findUnique({ where: { key: "billing.subscriptionGstBps" } });
  const bps = typeof gst?.value === "number" ? gst.value : 1800;
  const tax = Math.round((price * bps) / 10000);
  const start = new Date();
  const end = new Date(start);
  if (billingCycle === "ANNUAL") end.setUTCFullYear(end.getUTCFullYear() + 1);
  else end.setUTCMonth(end.getUTCMonth() + 1);
  return prismaPrivileged.$transaction(async (tx) => {
    if (current) await tx.subscription.update({ where: { id: current.id }, data: { status: "CANCELLED", cancelAtPeriodEnd: true } });
    const subscription = await tx.subscription.create({
      data: { tenantId, planId: plan.id, status: "ACTIVE", billingCycle, currentPeriodStart: start, currentPeriodEnd: end },
    });
    await tx.invoice.create({
      data: {
        tenantId,
        kind: "SUBSCRIPTION",
        status: "ISSUED",
        number: publicCode("SUB"),
        subscriptionId: subscription.id,
        subtotalPaise: price,
        taxPaise: tax,
        totalPaise: price + tax,
        lines: [{ description: `${plan.name} (${billingCycle.toLowerCase()})`, amountPaise: price }],
        dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    await writeAudit(tx, { tenantId, actorId: actor.userId, action: "UPDATE", entityType: "Subscription", entityId: subscription.id, metadata: { plan: plan.tier, billingCycle } });
    return subscription;
  });
}

export async function cancelSubscription(actor: Actor) {
  const tenantId = actor.activeTenantId;
  if (!tenantId) throw new DomainError("TENANT_REQUIRED", "Choose a center first", 400);
  assertPermission(actor, "tenant.manage", tenantId);
  const current = await prismaPrivileged.subscription.findFirst({ where: { tenantId, status: { in: ["TRIALING", "ACTIVE"] } } });
  if (!current) throw new DomainError("NOT_FOUND", "No active subscription", 404);
  return prismaPrivileged.subscription.update({ where: { id: current.id }, data: { cancelAtPeriodEnd: true } });
}

export async function updatePlanPrice(actor: Actor, planId: string, monthlyPricePaise: number, annualPricePaise: number, maxBranches: number | null, maxUsers: number | null, maxBookingsPerMonth: number | null) {
  assertPermission(actor, "plans.manage", null);
  if (!actor.isSuperAdmin) throw new DomainError("FORBIDDEN", "Only a super admin can edit plans", 403);
  if (monthlyPricePaise < 0 || annualPricePaise < 0) throw new DomainError("PRICE", "Prices cannot be negative", 400);
  const plan = await prismaPrivileged.subscriptionPlan.update({
    where: { id: planId },
    data: { monthlyPricePaise, annualPricePaise, maxBranches, maxUsers, maxBookingsPerMonth },
  });
  await prismaPrivileged.auditLog.create({
    data: { actorId: actor.userId, action: "UPDATE", entityType: "SubscriptionPlan", entityId: plan.id, metadata: { monthlyPricePaise, annualPricePaise } },
  });
  return plan;
}

export async function refreshSubscriptionStates() {
  const due = await prismaPrivileged.subscription.findMany({
    where: { status: { in: ["TRIALING", "ACTIVE"] }, currentPeriodEnd: { lt: new Date() } },
    include: { plan: true, tenant: true },
  });
  for (const subscription of due) {
    const status = subscription.cancelAtPeriodEnd ? "EXPIRED" : "PAST_DUE";
    await prismaPrivileged.subscription.update({ where: { id: subscription.id }, data: { status } });
    await enqueue(prismaPrivileged, {
      tenantId: subscription.tenantId,
      channel: "EMAIL",
      templateKey: "subscription_reminder",
      to: subscription.tenant.email,
      payload: { centerName: subscription.tenant.name, planName: subscription.plan.name, link: `${getEnv().APP_URL}/console/org/subscription` },
    });
  }
  const upcoming = await prismaPrivileged.subscription.findMany({
    where: {
      status: { in: ["TRIALING", "ACTIVE"] },
      currentPeriodEnd: { gt: new Date(), lt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) },
    },
    include: { plan: true, tenant: true },
  });
  for (const subscription of upcoming) {
    const already = await prismaPrivileged.notification.findFirst({
      where: { tenantId: subscription.tenantId, templateKey: "subscription_reminder", createdAt: { gt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) } },
    });
    if (already) continue;
    await enqueue(prismaPrivileged, {
      tenantId: subscription.tenantId,
      channel: "EMAIL",
      templateKey: "subscription_reminder",
      to: subscription.tenant.email,
      payload: { centerName: subscription.tenant.name, planName: subscription.plan.name, link: `${getEnv().APP_URL}/console/org/subscription` },
    });
  }
  return { expiredOrOverdue: due.length, reminders: upcoming.length };
}

export async function subscriptionUsage(tenantId: string) {
  return withScope({ tenantId, privileged: false }, async (tx) => {
    const subscription = await activeSubscription(tx, tenantId);
    const start = new Date();
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
    const [branches, users, bookings] = await Promise.all([
      tx.branch.count({ where: { tenantId, deletedAt: null } }),
      tx.tenantMembership.count({ where: { tenantId, status: "ACTIVE" } }),
      tx.booking.count({ where: { tenantId, createdAt: { gte: start }, status: { not: "CANCELLED" } } }),
    ]);
    return { subscription, usage: { branches, users, bookings } };
  });
}
