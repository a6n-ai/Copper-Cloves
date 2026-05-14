import fs from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { Pool } from "pg";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Load .env.production from the process cwd (normal Node) and from `.next/` when present.
 * Amplify Hosting deploys the `.next` folder only; we copy `.env.production` into `.next` during
 * build so SSR handlers can read DB/NextAuth vars at runtime (see amplify.yml).
 */
function loadServerEnv() {
  const cwd = process.cwd();
  loadEnvConfig(cwd);
  const nextDir = path.join(cwd, ".next");
  if (fs.existsSync(path.join(nextDir, ".env.production"))) {
    loadEnvConfig(nextDir);
  }
  // Some hosts run with cwd inside `.next` (artifact root) or one level off — still load copied SSR env.
  if (!process.env.STUDIO_DATABASE_URL?.trim() && !process.env.DATABASE_URL?.trim()) {
    for (const dir of [cwd, path.join(cwd, ".next"), path.dirname(cwd)]) {
      const envProd = path.join(dir, ".env.production");
      if (fs.existsSync(envProd)) {
        loadEnvConfig(dir);
        break;
      }
    }
  }
}

loadServerEnv();

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
  const trimmed = url.trim();
  const isRds =
    trimmed.includes("rds.amazonaws.com") || trimmed.includes("rds.amazonaws.com.cn");
  let next = trimmed;
  if (isRds) {
    if (!/[?&]sslmode=/i.test(next) && !/[?&]ssl=true/i.test(next)) {
      next = `${next}${next.includes("?") ? "&" : "?"}sslmode=require`;
    }
  }
  return withLibpqSslCompatQuery(next);
}

/**
 * pg-connection-string (used by `pg`) currently maps `sslmode=require|prefer|verify-ca` to full cert
 * verification (like verify-full). That breaks many managed Postgres chains (P1011: self-signed
 * certificate). libpq-compatible parsing restores standard semantics; see Node warning on deploy.
 */
const LIBPQ_ALIAS_SSLMODES = new Set(["require", "prefer", "verify-ca"]);

function isLocalPostgresHost(connectionString: string): boolean {
  try {
    const host = new URL(connectionString).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

function withLibpqSslCompatQuery(url: string): string {
  if (isLocalPostgresHost(url)) return url;
  try {
    const parsed = new URL(url);
    const mode = parsed.searchParams.get("sslmode")?.toLowerCase();
    if (mode && LIBPQ_ALIAS_SSLMODES.has(mode) && !parsed.searchParams.has("uselibpqcompat")) {
      parsed.searchParams.set("uselibpqcompat", "true");
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function shouldEnableSsl(connectionString: string): boolean {
  if (isLocalPostgresHost(connectionString)) return false;
  try {
    const parsed = new URL(connectionString);
    const sslMode = parsed.searchParams.get("sslmode")?.toLowerCase();
    if (sslMode === "disable") return false;
    if (
      sslMode === "require" ||
      sslMode === "verify-ca" ||
      sslMode === "verify-full" ||
      sslMode === "prefer" ||
      sslMode === "allow"
    ) {
      return true;
    }

    if (parsed.searchParams.get("ssl") === "true") return true;

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

/**
 * `pg-connection-string` maps several `sslmode` values to full cert verification. Passing the same
 * flags in the URL while also setting `Pool.ssl` can still yield P1011 on managed Postgres. When we
 * negotiate TLS via `ssl: { rejectUnauthorized: false }`, drop ssl-related query params from the
 * URL so the driver does not insist on verifying the chain.
 */
function poolConnectionString(fullUrl: string, useSsl: boolean): string {
  if (!useSsl || isLocalPostgresHost(fullUrl)) return fullUrl;
  try {
    const parsed = new URL(fullUrl);
    parsed.searchParams.delete("sslmode");
    parsed.searchParams.delete("uselibpqcompat");
    parsed.searchParams.delete("ssl");
    return parsed.toString();
  } catch {
    return fullUrl;
  }
}

function createPrismaClient() {
  const connectionString = databaseUrl();
  const useSsl = shouldEnableSsl(connectionString);
  const poolUrl = poolConnectionString(connectionString, useSsl);

  if (!globalForPrisma.pgPool) {
    globalForPrisma.pgPool = new Pool({
      connectionString: poolUrl,
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
