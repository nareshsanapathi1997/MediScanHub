import type { Prisma } from "@prisma/client";
import type { Tx } from "@/lib/scope";

export async function writeAudit(
  tx: Tx,
  entry: {
    tenantId?: string | null;
    actorId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Prisma.InputJsonValue;
    ipAddress?: string | null;
  },
) {
  await tx.auditLog.create({
    data: {
      tenantId: entry.tenantId ?? null,
      actorId: entry.actorId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      metadata: entry.metadata,
      ipAddress: entry.ipAddress ?? null,
    },
  });
}
