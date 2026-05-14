#!/usr/bin/env node
/**
 * Amplify / CI: sync Postgres with prisma/schema.prisma (non-interactive `prisma db push`).
 * Sets DATABASE_URL + STUDIO_DATABASE_URL to the same normalized URL so prisma.config.ts
 * and the Prisma CLI see a single source (RDS sslmode, uselibpqcompat, etc.).
 */
import { spawnSync } from "node:child_process";
import process from "node:process";

function resolveDatabaseUrl(env = process.env) {
  const studioUrl = env.STUDIO_DATABASE_URL?.trim();
  const databaseUrl = env.DATABASE_URL?.trim();
  const selectedUrl = studioUrl || databaseUrl;

  if (!selectedUrl) {
    throw new Error("Missing STUDIO_DATABASE_URL or DATABASE_URL.");
  }

  const parsed = new URL(selectedUrl);
  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== "postgresql:" && protocol !== "postgres:") {
    throw new Error("Invalid database URL protocol. Use postgresql:// or postgres://.");
  }

  if (parsed.hostname.toLowerCase() === "localhost") {
    parsed.hostname = "127.0.0.1";
  }

  return parsed.toString();
}

function isLocalPostgresHost(connectionString) {
  try {
    const host = new URL(connectionString).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

/** Match src/lib/prisma.ts — RDS / managed hosts need TLS hints in the URL for CLI. */
function normalizePostgresUrl(url) {
  const trimmed = url.trim();
  const isRds =
    trimmed.includes("rds.amazonaws.com") || trimmed.includes("rds.amazonaws.com.cn");
  let next = trimmed;
  if (isRds) {
    if (!/[?&]sslmode=/i.test(next) && !/[?&]ssl=true/i.test(next)) {
      next = `${next}${next.includes("?") ? "&" : "?"}sslmode=require`;
    }
  }
  if (isLocalPostgresHost(next)) return next;
  try {
    const parsed = new URL(next);
    const mode = parsed.searchParams.get("sslmode")?.toLowerCase();
    const libpqAliases = new Set(["require", "prefer", "verify-ca"]);
    if (mode && libpqAliases.has(mode) && !parsed.searchParams.has("uselibpqcompat")) {
      parsed.searchParams.set("uselibpqcompat", "true");
    }
    return parsed.toString();
  } catch {
    return next;
  }
}

function main() {
  const raw = resolveDatabaseUrl();
  const forPrisma = normalizePostgresUrl(raw);

  const env = {
    ...process.env,
    DATABASE_URL: forPrisma,
    STUDIO_DATABASE_URL: forPrisma,
  };

  const isWin = process.platform === "win32";
  const npxCmd = isWin ? "npx.cmd" : "npx";

  const r = spawnSync(npxCmd, ["prisma", "db", "push"], {
    env,
    stdio: "inherit",
    cwd: process.cwd(),
    shell: isWin,
  });

  const code = typeof r.status === "number" ? r.status : 1;
  if (code !== 0) {
    process.exit(code);
  }
  console.log("Prisma db push completed — database schema matches prisma/schema.prisma");
}

try {
  main();
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error("ci-db-push failed:", msg);
  process.exit(1);
}
