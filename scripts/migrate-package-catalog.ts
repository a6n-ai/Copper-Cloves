/**
 * Canonical package catalog upsert (SOP §1 + §5.1).
 *
 * Standardizes the 8 public packages as `PackageType` rows: edits the 6 that
 * already exist, creates the 2 missing ones (6 Month Unlimited, 12 Class Pass).
 * Legacy types (Studio Class Pass, Premium Studio Class Pass[ (Unlimited)]) are
 * left untouched — they get retired only after member rows are repointed, which
 * is a separate, decision-gated step.
 *
 * SAFE BY DEFAULT: dry-run prints the plan and writes nothing. Pass --apply to
 * commit. Never touches user_packages.
 *
 *   tsx scripts/migrate-package-catalog.ts            # dry-run
 *   tsx scripts/migrate-package-catalog.ts --apply    # write
 *
 * ponytail: PackageType has no day-granular validity column, so 1 Day / 40-day
 * passes round to whole months in duration_months. Add validity_days if exact
 * sub-month expiry on future purchases matters.
 */
import prisma from "../src/lib/prisma";
import { Prisma } from "../src/generated/prisma/client";
import { PACKAGE_CATALOG, catalogPackageType } from "../src/lib/packageCatalog";

type Canonical = {
  name: string;
  type: "studio_pass" | "class_pass";
  is_unlimited: boolean;
  class_count: number | null;
  duration_months: number;
  price: number;
  validity: string; // human note only
  benefits: string[];
  featured: boolean;
  badge: string | null;
  display_order: number;
  is_published: boolean;
};

const CATALOG: Canonical[] = PACKAGE_CATALOG.map((p, i) => ({
  name: p.name,
  type: catalogPackageType(p),
  is_unlimited: p.isUnlimited,
  class_count: p.classCount,
  duration_months: p.durationMonths,
  price: p.priceInr,
  validity: p.validity,
  benefits: p.benefits,
  featured: p.featured ?? false,
  badge: p.badge ?? null,
  display_order: p.displayOrder ?? i,
  is_published: p.isPublished ?? true,
}));

const APPLY = process.argv.includes("--apply");

function fieldDiffs(existing: { type: string; class_count: number | null; duration_months: number | null; price: Prisma.Decimal; is_unlimited: boolean; benefits: string[]; featured: boolean; badge: string | null; display_order: number; is_published: boolean }, c: Canonical): string[] {
  const out: string[] = [];
  if (existing.type !== c.type) out.push(`type ${existing.type} -> ${c.type}`);
  if ((existing.class_count ?? null) !== c.class_count) out.push(`class_count ${existing.class_count} -> ${c.class_count}`);
  if ((existing.duration_months ?? null) !== c.duration_months) out.push(`duration_months ${existing.duration_months} -> ${c.duration_months}`);
  if (Number(existing.price) !== c.price) out.push(`price ${Number(existing.price)} -> ${c.price}`);
  if (existing.is_unlimited !== c.is_unlimited) out.push(`is_unlimited ${existing.is_unlimited} -> ${c.is_unlimited}`);
  if (JSON.stringify(existing.benefits ?? []) !== JSON.stringify(c.benefits)) out.push(`benefits ${JSON.stringify(existing.benefits ?? [])} -> ${JSON.stringify(c.benefits)}`);
  if (existing.featured !== c.featured) out.push(`featured ${existing.featured} -> ${c.featured}`);
  if ((existing.badge ?? null) !== c.badge) out.push(`badge ${existing.badge} -> ${c.badge}`);
  if (existing.display_order !== c.display_order) out.push(`display_order ${existing.display_order} -> ${c.display_order}`);
  if (existing.is_published !== c.is_published) out.push(`is_published ${existing.is_published} -> ${c.is_published}`);
  return out;
}

async function main() {
  console.log(`\n=== Package catalog upsert (${APPLY ? "APPLY — WRITING" : "DRY-RUN — no writes"}) ===\n`);

  let creates = 0;
  let updates = 0;
  let unchanged = 0;

  for (const c of CATALOG) {
    const existing = await prisma.packageType.findFirst({ where: { name: c.name } });

    if (!existing) {
      console.log(`CREATE  ${c.name}  [${c.type}] ₹${c.price} · ${c.validity}${c.class_count ? ` · ${c.class_count} classes` : " · unlimited"}`);
      creates++;
      if (APPLY) {
        await prisma.packageType.create({
          data: {
            name: c.name,
            type: c.type,
            class_count: c.class_count,
            duration_months: c.duration_months,
            price: new Prisma.Decimal(c.price),
            is_unlimited: c.is_unlimited,
            includes_physique_57: true,
            description: c.name,
            benefits: c.benefits,
            featured: c.featured,
            badge: c.badge,
            display_order: c.display_order,
            is_published: c.is_published,
          },
        });
      }
      continue;
    }

    const diffs = fieldDiffs(existing, c);
    if (diffs.length === 0) {
      console.log(`OK      ${c.name}  (no change)`);
      unchanged++;
      continue;
    }

    console.log(`UPDATE  ${c.name}`);
    for (const d of diffs) console.log(`          - ${d}`);
    updates++;
    if (APPLY) {
      await prisma.packageType.update({
        where: { id: existing.id },
        data: {
          type: c.type,
          class_count: c.class_count,
          duration_months: c.duration_months,
          price: new Prisma.Decimal(c.price),
          is_unlimited: c.is_unlimited,
          benefits: c.benefits,
          featured: c.featured,
          badge: c.badge,
          display_order: c.display_order,
          is_published: c.is_published,
        },
      });
    }
  }

  // Surface legacy (non-canonical) types still present — retired later, post member repoint.
  const canonicalNames = new Set(CATALOG.map((c) => c.name));
  const all = await prisma.packageType.findMany({ select: { name: true, _count: { select: { user_packages: true } } } });
  const legacy = all.filter((p) => !canonicalNames.has(p.name));

  console.log(`\nPlan: ${creates} create, ${updates} update, ${unchanged} unchanged.`);
  if (legacy.length) {
    console.log(`\nLegacy types left untouched (retire after member repoint):`);
    for (const l of legacy) console.log(`  - ${l.name}  (${l._count.user_packages} member packages)`);
  }
  console.log(APPLY ? "\nDone — catalog written.\n" : "\nDry-run only. Re-run with --apply to write.\n");

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
