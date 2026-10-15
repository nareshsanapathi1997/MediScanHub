import { prismaPrivileged } from "@/lib/db";
import { withScope } from "@/lib/scope";
import { DomainError } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import type { Actor } from "@/domain/actor";
import { assertPermission } from "@/domain/actor";
import type { TpaClaimStatus } from "@prisma/client";

export async function listTpaClaims(actor: Actor) {
  if (actor.patientId && !actor.activeTenantId) {
    return prismaPrivileged.tpaClaim.findMany({
      where: { patientId: actor.patientId },
      include: { invoice: { select: { number: true, totalPaise: true } }, insurancePolicy: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }
  const tenantId = actor.activeTenantId;
  if (!tenantId) throw new DomainError("TENANT_REQUIRED", "Choose a center first", 400);
  assertPermission(actor, "invoices.read", tenantId);
  return withScope({ tenantId, userId: actor.userId }, (tx) =>
    tx.tpaClaim.findMany({
      where: { tenantId },
      include: { invoice: { select: { number: true, totalPaise: true, booking: { select: { publicCode: true } } } }, insurancePolicy: true, patient: { include: { user: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  );
}

export async function submitTpaClaim(actor: Actor, input: { invoiceId: string; claimedPaise: number; externalReference?: string; notes?: string }) {
  const tenantId = actor.activeTenantId;
  if (!tenantId) throw new DomainError("TENANT_REQUIRED", "Choose a center first", 400);
  assertPermission(actor, "invoices.manage", tenantId);
  if (input.claimedPaise <= 0) throw new DomainError("AMOUNT", "Claim amount must be positive", 400);
  return withScope({ tenantId, userId: actor.userId }, async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { id: input.invoiceId, tenantId },
      include: { booking: true },
    });
    if (!invoice?.patientId) throw new DomainError("NOT_FOUND", "Invoice not found", 404);
    if (!invoice.insurancePolicyId) throw new DomainError("INSURANCE", "Link an insurance policy on the invoice before submitting a TPA claim", 409);
    const existing = await tx.tpaClaim.findFirst({ where: { invoiceId: invoice.id, status: { in: ["SUBMITTED", "APPROVED", "PAID"] } } });
    if (existing) throw new DomainError("CLAIM", "A claim is already open for this invoice", 409);
    const claim = await tx.tpaClaim.create({
      data: {
        tenantId,
        patientId: invoice.patientId,
        invoiceId: invoice.id,
        insurancePolicyId: invoice.insurancePolicyId,
        claimedPaise: input.claimedPaise,
        externalReference: input.externalReference?.trim() || null,
        notes: input.notes?.trim() || null,
        status: "SUBMITTED",
      },
    });
    await writeAudit(tx, { tenantId, actorId: actor.userId, action: "CREATE", entityType: "TpaClaim", entityId: claim.id });
    return claim;
  });
}

export async function transitionTpaClaim(actor: Actor, claimId: string, to: TpaClaimStatus, input?: { approvedPaise?: number; paidPaise?: number; notes?: string }) {
  const tenantId = actor.activeTenantId;
  if (!tenantId) throw new DomainError("TENANT_REQUIRED", "Choose a center first", 400);
  assertPermission(actor, "invoices.manage", tenantId);
  const allowed: Record<TpaClaimStatus, TpaClaimStatus[]> = {
    SUBMITTED: ["APPROVED", "REJECTED"],
    APPROVED: ["PAID", "REJECTED"],
    PAID: [],
    REJECTED: [],
  };
  return withScope({ tenantId, userId: actor.userId }, async (tx) => {
    const claim = await tx.tpaClaim.findFirst({ where: { id: claimId, tenantId } });
    if (!claim) throw new DomainError("NOT_FOUND", "Claim not found", 404);
    const next = allowed[claim.status];
    if (!next.includes(to)) throw new DomainError("CLAIM", `Cannot move claim from ${claim.status} to ${to}`, 409);
    if (to === "APPROVED" && (input?.approvedPaise ?? 0) <= 0) throw new DomainError("AMOUNT", "Approved amount is required", 400);
    if (to === "PAID" && (input?.paidPaise ?? 0) <= 0) throw new DomainError("AMOUNT", "Paid amount is required", 400);
    const updated = await tx.tpaClaim.update({
      where: { id: claim.id },
      data: {
        status: to,
        approvedPaise: to === "APPROVED" || to === "PAID" ? input?.approvedPaise ?? claim.approvedPaise : claim.approvedPaise,
        paidPaise: to === "PAID" ? input?.paidPaise : claim.paidPaise,
        notes: input?.notes?.trim() || claim.notes,
      },
    });
    await writeAudit(tx, { tenantId, actorId: actor.userId, action: "UPDATE", entityType: "TpaClaim", entityId: claim.id, metadata: { to } });
    return updated;
  });
}
