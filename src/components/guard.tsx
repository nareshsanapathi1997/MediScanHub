import { hasPermission, type Actor } from "@/domain/actor";
import { AccessDenied } from "@/components/widgets";

/** Return an access-denied element before any privileged query or child is created. */
export function deny(actor: Actor, permission: string, options?: { tenant?: boolean }) {
  if (options?.tenant && !actor.activeTenantId) {
    return <AccessDenied need="Switch to a center in the header before opening this desk." />;
  }
  if (!hasPermission(actor, permission, actor.activeTenantId)) return <AccessDenied />;
  return null;
}

export function Gate({ actor, permission, children }: { actor: Actor; permission: string; children: React.ReactNode }) {
  const blocked = deny(actor, permission);
  if (blocked) return blocked;
  return <>{children}</>;
}

export function NeedTenant({ actor, children }: { actor: Actor; children: React.ReactNode }) {
  if (!actor.activeTenantId) {
    return <AccessDenied need="Switch to a center in the header before opening this desk." />;
  }
  return <>{children}</>;
}
