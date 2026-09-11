/**
 * Backfill: flip `is_active` off for user_packages already past expiration_date.
 *
 * Reuses expireDuePasses (same rule the new cron uses) so this stays the single
 * source of truth. Idempotent — safe to run repeatedly.
 *
 * Run: npx tsx scripts/backfill-expire-passes.ts
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

async function main() {
  const prisma = (await import("../src/lib/prisma")).default;
  const { expireDuePasses } = await import("../src/lib/expireUserPackages");

  const now = new Date();
  const pending = await prisma.userPackage.count({
    where: { is_active: true, expiration_date: { lte: now } },
  });
  console.log(`Pending: ${pending} pass(es) to deactivate.`);

  const result = await expireDuePasses(now);
  console.log(`Backfilled: ${result.expired} pass(es) deactivated.`);

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
