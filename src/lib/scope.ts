import type { Prisma } from "@prisma/client";
import { prisma, prismaPrivileged } from "@/lib/db";

export type Tx = Prisma.TransactionClient;

export type Scope = {
  tenantId?: string | null;
  userId?: string | null;
  patientId?: string | null;
  privileged?: boolean;
};

export async function withScope<T>(scope: Scope, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const client = scope.privileged ? prismaPrivileged : prisma;
  return client.$transaction(
    async (tx) => {
      if (!scope.privileged) {
        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${scope.tenantId ?? ""}, true)`;
        await tx.$executeRaw`SELECT set_config('app.user_id', ${scope.userId ?? ""}, true)`;
        await tx.$executeRaw`SELECT set_config('app.patient_id', ${scope.patientId ?? ""}, true)`;
      }
      return fn(tx);
    },
    { timeout: 20000 },
  );
}
