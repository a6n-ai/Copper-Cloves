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
  return normalizePostgresUrl(url);
}

/** AWS RDS and many cloud Postgres hosts require TLS from app runners (Amplify, Vercel, etc.). */
function normalizePostgresUrl(url: string): string {
  const isRds = url.includes("rds.amazonaws.com") || url.includes("rds.amazonaws.com.cn");
  if (!isRds) return url;
  if (/[?&]sslmode=/i.test(url) || /[?&]ssl=true/i.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}sslmode=require`;
}

function shouldEnableSsl(connectionString: string): boolean {
  try {
    const parsed = new URL(connectionString);
    const sslMode = parsed.searchParams.get("sslmode")?.toLowerCase();
    if (sslMode === "require" || sslMode === "verify-ca" || sslMode === "verify-full") {
      return true;
    }

    const host = parsed.hostname.toLowerCase();
    return (
      host.includes("rds.amazonaws.com") ||
      host.includes("neon.tech") ||
      host.includes("supabase.co")
    );
  } catch {
    return false;
  }
}

function createPrismaClient() {
  const connectionString = databaseUrl();
  const useSsl = shouldEnableSsl(connectionString);

  if (!globalForPrisma.pgPool) {
    globalForPrisma.pgPool = new Pool({
      connectionString,
      max: 10,
      connectionTimeoutMillis: 15_000,
      ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    });
  }

  const adapter = new PrismaPg(globalForPrisma.pgPool);
  return new PrismaClient({ adapter });
}

function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client as object, property, receiver);

    return typeof value === "function" ? value.bind(client) : value;
  },
});

export default prisma;
