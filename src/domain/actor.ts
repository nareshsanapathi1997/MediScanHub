import { DomainError } from "@/lib/errors";

export type BranchScope = "all" | string[];

export type Membership = {
  tenantId: string | null;
  roleKey: string;
  permissions: string[];
  branchScope: BranchScope;
  status: "ACTIVE" | "INVITED" | "REVOKED";
};

export type Actor = {
  userId: string;
  email: string;
  name: string;
  patientId: string | null;
  isSuperAdmin: boolean;
  activeTenantId: string | null;
  activeBranchId: string | null;
  memberships: Membership[];
};

export function permissionSet(actor: Actor, tenantId: string | null) {
  const set = new Set<string>();
  for (const membership of actor.memberships) {
    if (membership.status !== "ACTIVE") continue;
    if (membership.roleKey === "SUPER_ADMIN" || membership.roleKey === "PATIENT") {
      for (const permission of membership.permissions) set.add(permission);
      continue;
    }
    if (tenantId && membership.tenantId === tenantId) {
      for (const permission of membership.permissions) set.add(permission);
    }
  }
  return set;
}

export function hasPermission(actor: Actor, permission: string, tenantId: string | null) {
  return permissionSet(actor, tenantId).has(permission);
}

export function assertPermission(actor: Actor, permission: string, tenantId: string | null) {
  if (!hasPermission(actor, permission, tenantId)) {
    throw new DomainError("FORBIDDEN", "You do not have permission to do that", 403);
  }
}

export function assertBranchAccess(actor: Actor, tenantId: string, branchId: string) {
  const membership = actor.memberships.find((item) => item.status === "ACTIVE" && item.tenantId === tenantId);
  if (!membership) throw new DomainError("FORBIDDEN", "No access to this center", 403);
  if (membership.branchScope === "all") return;
  if (!membership.branchScope.includes(branchId)) {
    throw new DomainError("FORBIDDEN", "No access to this branch", 403);
  }
}

export function homeFor(actor: Actor) {
  if (actor.isSuperAdmin) return "/console/admin";
  const tenantId = actor.activeTenantId;
  const perms = permissionSet(actor, tenantId);
  if (perms.has("tenant.manage") || perms.has("tenant.read")) return "/console/org";
  if (perms.has("imaging.perform") || perms.has("imaging.report")) return "/console/imaging";
  if (perms.has("results.enter") || perms.has("samples.collect") || perms.has("reports.approve")) return "/console/lab";
  if (perms.has("invoices.manage") || perms.has("payments.refund")) return "/console/finance";
  if (perms.has("bookings.manage")) return "/console/desk";
  if (perms.has("referrals.read")) return "/console/doctor";
  return "/console/patient";
}
