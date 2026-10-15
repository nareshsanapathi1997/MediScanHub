import { ConsoleShell } from "@/components/console-shell";
import { prismaPrivileged } from "@/lib/db";
import { requireSession } from "@/server/session";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const memberships = await prismaPrivileged.tenantMembership.findMany({
    where: { userId: session.actor.userId, status: "ACTIVE", tenantId: { not: null } },
    include: { tenant: true, role: true },
  });
  const tenants = [...new Map(
    memberships.flatMap((membership) => membership.tenant ? [[membership.tenant.id, { id: membership.tenant.id, name: membership.tenant.name, role: membership.role.name }] as const] : []),
  ).values()];
  return <ConsoleShell actor={session.actor} tenants={tenants}>{children}</ConsoleShell>;
}
