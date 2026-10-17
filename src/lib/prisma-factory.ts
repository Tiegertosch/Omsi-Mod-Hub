import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client";

/**
 * Erstellt einen Prisma-Client für PostgreSQL. Gemeinsam genutzt von der App
 * (src/lib/db.ts) und den CLI-Skripten (Seed, set-role, cleanup), daher ohne
 * "server-only" und mit relativem Import.
 */
export function createPrismaClient(url = process.env.DATABASE_URL): PrismaClient {
  if (!url) {
    throw new Error("DATABASE_URL ist nicht gesetzt. Siehe .env.example.");
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}
