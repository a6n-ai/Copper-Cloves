#!/usr/bin/env node
/**
 * CI + prod `migrate` service: sync Postgres with prisma/schema.prisma (non-interactive `prisma db push`).
 * - Clears duplicate razorpay_orders.booking_id / user_package_id before @unique constraints.
 * - Uses --accept-data-loss so Prisma does not block on non-interactive constraint warnings.
 */
import { spawnSync } from "node:child_process";
import process from "node:process";
import pg from "pg";

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

/** Keep one row per non-null booking_id / user_package_id so @unique can be applied. */
async function clearDuplicateRazorpayOrderLinks(connectionString) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const tableCheck = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'razorpay_orders'`,
    );
    if (tableCheck.rowCount === 0) {
      console.log("ci-db-push: razorpay_orders not found yet — skipping duplicate cleanup");
      return;
    }

    for (const column of ["user_package_id", "booking_id"]) {
      const result = await client.query(
        `
        WITH ranked AS (
          SELECT id,
                 ROW_NUMBER() OVER (
                   PARTITION BY ${column}
                   ORDER BY created_at DESC NULLS LAST, id DESC
                 ) AS rn
          FROM razorpay_orders
          WHERE ${column} IS NOT NULL
        )
        UPDATE razorpay_orders AS o
        SET ${column} = NULL
        FROM ranked AS r
        WHERE o.id = r.id AND r.rn > 1
        `,
      );
      const cleared = result.rowCount ?? 0;
      if (cleared > 0) {
        console.log(`ci-db-push: cleared ${cleared} duplicate razorpay_orders.${column} link(s)`);
      }
    }
  } catch (e) {
    const code = e && typeof e === "object" && "code" in e ? String(e.code) : "";
    if (code === "42P01") return;
    throw e;
  } finally {
    await client.end();
  }
}

async function main() {
  const forPrisma = normalizePostgresUrl(resolveDatabaseUrl());

  await clearDuplicateRazorpayOrderLinks(forPrisma);

  const env = {
    ...process.env,
    DATABASE_URL: forPrisma,
    STUDIO_DATABASE_URL: forPrisma,
  };

  const isWin = process.platform === "win32";
  const npxCmd = isWin ? "npx.cmd" : "npx";

  const r = spawnSync(npxCmd, ["prisma", "db", "push", "--accept-data-loss"], {
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

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  console.error("ci-db-push failed:", msg);
  process.exit(1);
});
