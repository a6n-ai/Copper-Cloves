/**
 * Member package repoint + studio dedup (SOP §5.2–§5.4).
 *
 * Locked decisions (2026-06-27):
 *   Studio Class Pass                      -> 12 Class Pass
 *   Premium Studio Class Pass (Unlimited)  -> 3 Month Unlimited
 *   Premium Studio Class Pass              -> 12 Class Pass
 *   Dedup: a member with >1 active unlimited pass keeps the later-expiry one,
 *          the rest are deactivated.
 *
 * Discount preserved so effective price is unchanged:
 *   newDisc = max(0, targetListPrice - (legacyListPrice - existingDisc))
 *
 * SAFE BY DEFAULT: dry-run prints the plan and writes nothing. --apply:
 *   1) snapshots ALL user_packages into user_packages_backup_2026_06_27
 *   2) repoints package_type_id + sets purchase_discount_inr
 *   3) deactivates duplicate active unlimited passes
 * Legacy PackageType rows are NOT deleted here — that's a separate step once the
 * result is verified. Run scripts/migrate-package-catalog.ts --apply FIRST so
 * the canonical target rows exist.
 *
 *   tsx scripts/migrate-member-packages.ts            # dry-run
 *   tsx scripts/migrate-member-packages.ts --apply    # write
 */
import prisma from "../src/lib/prisma";
import { Prisma } from "../src/generated/prisma/client";

const APPLY = process.argv.includes("--apply");
const BACKUP_TABLE = "user_packages_backup_2026_06_27";

const REPOINT: Record<string, string> = {
  "Studio Class Pass": "12 Class Pass",
  "Premium Studio Class Pass (Unlimited)": "3 Month Unlimited",
  "Premium Studio Class Pass": "12 Class Pass",
};

const num = (d: Prisma.Decimal | number | null | undefined): number => (d == null ? 0 : Number(d));

async function main() {
  console.log(`\n=== Member package migration (${APPLY ? "APPLY — WRITING" : "DRY-RUN — no writes"}) ===\n`);

  const types = await prisma.packageType.findMany();
  const byName = new Map(types.map((t) => [t.name, t]));

  // Targets must already exist (run the catalog upsert first).
  const missing = [...new Set(Object.values(REPOINT))].filter((n) => !byName.has(n));
  if (missing.length) {
    console.error(`Target package(s) missing: ${missing.join(", ")}. Run db:catalog:apply first.`);
    process.exit(1);
  }

  const ups = await prisma.userPackage.findMany({
    select: {
      id: true,
      user_id: true,
      is_active: true,
      expiration_date: true,
      purchase_discount_inr: true,
      package_type_id: true,
      package_type: { select: { id: true, name: true, price: true, is_unlimited: true } },
    },
  });

  type Plan = { id: string; user_id: string; from: string; to: string; newDisc: number; targetTypeId: string; activeAfter: boolean; unlimitedAfter: boolean; expiration: Date };
  const repoints: Plan[] = [];
  const view: Plan[] = [];

  for (const up of ups) {
    const legacyName = up.package_type?.name ?? "";
    const targetName = REPOINT[legacyName];
    const target = targetName ? byName.get(targetName)! : up.package_type!;
    const isRepoint = Boolean(targetName);

    const effectivePaid = num(up.package_type?.price) - num(up.purchase_discount_inr);
    const newDisc = isRepoint ? Math.max(0, Math.round(num(target.price) - effectivePaid)) : num(up.purchase_discount_inr);

    const plan: Plan = {
      id: up.id,
      user_id: up.user_id,
      from: legacyName,
      to: target.name,
      newDisc,
      targetTypeId: target.id,
      activeAfter: up.is_active,
      unlimitedAfter: target.is_unlimited,
      expiration: up.expiration_date,
    };
    view.push(plan);
    if (isRepoint) repoints.push(plan);
  }

  // Dedup: per user, among active unlimited passes (post-repoint), keep latest expiry.
  const deactivate: Plan[] = [];
  const byUser = new Map<string, Plan[]>();
  for (const p of view) {
    if (!p.activeAfter || !p.unlimitedAfter) continue;
    (byUser.get(p.user_id) ?? byUser.set(p.user_id, []).get(p.user_id)!).push(p);
  }
  for (const group of byUser.values()) {
    if (group.length < 2) continue;
    group.sort((a, b) => b.expiration.getTime() - a.expiration.getTime()); // latest first
    deactivate.push(...group.slice(1));
  }

  // --- Report ---
  const byTarget = new Map<string, number>();
  for (const r of repoints) byTarget.set(`${r.from} -> ${r.to}`, (byTarget.get(`${r.from} -> ${r.to}`) ?? 0) + 1);
  console.log("Repoints:");
  for (const [k, n] of byTarget) console.log(`  ${k}: ${n}`);
  const discCount = repoints.filter((r) => r.newDisc > 0).length;
  console.log(`  with preserved discount > 0: ${discCount}`);
  console.log(`\nDedup (deactivate duplicate active unlimited): ${deactivate.length}`);
  for (const d of deactivate.slice(0, 20)) console.log(`  user ${d.user_id} — keep later, deactivate up ${d.id} (${d.to}, exp ${d.expiration.toISOString().slice(0, 10)})`);
  console.log(`\nTotals: ${repoints.length} repoint, ${deactivate.length} deactivate.`);

  if (!APPLY) {
    console.log("\nDry-run only. Re-run with --apply to write.\n");
    process.exit(0);
  }

  // --- Apply ---
  console.log(`\nSnapshotting user_packages -> ${BACKUP_TABLE} ...`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS ${BACKUP_TABLE} AS TABLE user_packages`);
  const [{ count: backupCount }] = await prisma.$queryRawUnsafe<{ count: bigint }[]>(`SELECT COUNT(*)::bigint AS count FROM ${BACKUP_TABLE}`);
  console.log(`Backup rows: ${Number(backupCount)}`);

  const deactivateIds = new Set(deactivate.map((d) => d.id));
  await prisma.$transaction(async (tx) => {
    for (const r of repoints) {
      await tx.userPackage.update({
        where: { id: r.id },
        data: { package_type_id: r.targetTypeId, purchase_discount_inr: r.newDisc > 0 ? new Prisma.Decimal(r.newDisc) : null },
      });
    }
    for (const id of deactivateIds) {
      await tx.userPackage.update({ where: { id }, data: { is_active: false } });
    }
  });

  console.log(`\nDone — ${repoints.length} repointed, ${deactivateIds.size} deactivated. Backup: ${BACKUP_TABLE}.`);
  console.log("Legacy types NOT deleted — verify, then retire them separately.\n");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
