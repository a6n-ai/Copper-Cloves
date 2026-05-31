import { config } from "dotenv";
import { resolve } from "node:path";
import { defineConfig } from "prisma/config";

/* Load .env then .env.local so `npx prisma` picks up docker credentials from files. */
const root = process.cwd();
config({ path: resolve(root, ".env") });
config({ path: resolve(root, ".env.local"), override: true });

const preservedDatabaseUrl = process.env.DATABASE_URL?.trim();
const studioUrl = process.env.STUDIO_DATABASE_URL?.trim();

/*
 * Prefer STUDIO_DATABASE_URL from files — Windows often has DATABASE_URL preset for a host
 * Postgres; preserving that before dotenv would overwrite the merged URL incorrectly.
 */
if (studioUrl) {
  process.env.DATABASE_URL = studioUrl;
} else if (preservedDatabaseUrl) {
  process.env.DATABASE_URL = preservedDatabaseUrl;
}

const databaseUrl =
  process.env.DATABASE_URL?.trim() ||
  "postgresql://prisma:prisma@127.0.0.1:5432/prisma?schema=public";

/*
 * The Prisma CLI (db push / studio / migrate) reads the raw URL and connects
 * without TLS, which managed Postgres (RDS) refuses → P1001. The app runtime is
 * fine because @prisma/adapter-pg enables SSL in code. Mirror that here for the
 * CLI by forcing sslmode=require on managed hosts only; local docker is left as-is.
 */
const SSL_HOST_SUFFIXES = ["rds.amazonaws.com", "neon.tech", "supabase.co", "supabase.com"];
function withSslForManagedHosts(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const managed = SSL_HOST_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`));
    if (managed && !u.searchParams.has("sslmode") && !u.searchParams.has("ssl")) {
      u.searchParams.set("sslmode", "require");
      return u.toString();
    }
    return url;
  } catch {
    return url;
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: withSslForManagedHosts(databaseUrl),
  },
});
