import { Pool } from "pg";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pgPool?: Pool;
};

/**
 * Windows often has a permanent `DATABASE_URL` (Postgres installer). Next.js refuses to overwrite
 * existing process.env keys, so `.env.local` DATABASE_URL is ignored. Use `STUDIO_DATABASE_URL`
 * for this app; it is always merged from env files.
 */
function databaseUrl(): string {
  const url =
    process.env.STUDIO_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "Missing database URL: set STUDIO_DATABASE_URL (recommended) or DATABASE_URL in .env.local"
    );
  }
  return url;
}

function createPrismaClient() {
  const connectionString = databaseUrl();
  const pool =
    globalForPrisma.pgPool ??
    new Pool({
      connectionString,
      max: 10,
    });
  if (process.env.NODE_ENV !== "production") globalForPrisma.pgPool = pool;

  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

function getPrismaClient(): PrismaClient {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  const client = createPrismaClient();

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }

  return client;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client as object, property, receiver);

    return typeof value === "function" ? value.bind(client) : value;
  },
});

export default prisma;
