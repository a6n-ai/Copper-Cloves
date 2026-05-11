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

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
