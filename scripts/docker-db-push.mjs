#!/usr/bin/env node
/**
 * Applies Prisma schema to the Postgres container from docker-compose.yml.
 * Overrides DATABASE_URL only for this process (won't overwrite .env.local).
 */
import { spawnSync } from "node:child_process";
import process from "node:process";

/* Use 127.0.0.1 on Windows: "localhost" may hit a different Postgres than Docker (IPv6 / host install). */
const DOCKER_DATABASE_URL =
  "postgresql://copper:copper_dev@127.0.0.1:5433/copperandcloves?schema=public";

const env = {
  ...process.env,
  STUDIO_DATABASE_URL: DOCKER_DATABASE_URL,
  DATABASE_URL: DOCKER_DATABASE_URL,
};

const isWin = process.platform === "win32";
const npxCmd = isWin ? "npx.cmd" : "npx";

const r = spawnSync(npxCmd, ["prisma", "db", "push"], {
  env,
  stdio: "inherit",
  cwd: process.cwd(),
  shell: isWin,
});

process.exit(typeof r.status === "number" ? r.status : 1);
