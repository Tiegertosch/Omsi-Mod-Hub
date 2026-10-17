import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";

import { createPrismaClient } from "./prisma-factory";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Ein Client (mit Verbindungspool) pro Prozess; in der Entwicklung über Hot Reloads hinweg.
export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
