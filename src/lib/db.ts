import { PrismaClient } from "@prisma/client";
import { getEnv } from "@/lib/env";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaPrivileged?: PrismaClient;
};

function client(url: string) {
  return new PrismaClient({
    datasources: { db: { url } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function attachClients() {
  const env = getEnv();
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = client(env.DATABASE_URL);
    globalForPrisma.prismaPrivileged = client(env.PRIVILEGED_DATABASE_URL);
  }
  return globalForPrisma;
}

function clientProxy(getClient: () => PrismaClient): PrismaClient {
  return new Proxy({} as PrismaClient, {
    get(_target, prop) {
      const c = getClient();
      const value = Reflect.get(c, prop, c);
      return typeof value === "function" ? value.bind(c) : value;
    },
  });
}

function ensureClients() {
  attachClients();
  return globalForPrisma;
}

ensureClients();

export const prisma = clientProxy(() => ensureClients().prisma!);
export const prismaPrivileged = clientProxy(() => ensureClients().prismaPrivileged!);

/** Vitest reloads `.env.test` in setupFiles; reconnect ORM clients after env changes. */
export function resetDbClients() {
  void globalForPrisma.prisma?.$disconnect();
  void globalForPrisma.prismaPrivileged?.$disconnect();
  globalForPrisma.prisma = undefined;
  globalForPrisma.prismaPrivileged = undefined;
  attachClients();
}

export type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends" | "$use">;
