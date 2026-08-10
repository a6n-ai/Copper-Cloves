/**
 * Single source of truth for café food discounts: the `cafe_discount_percent`
 * column on the member's package type, editable in admin.
 *
 * This used to be a hardcoded name→rate map, which drifted from the column the
 * till actually charges on: pass types with a NULL column (Studio Class Pass,
 * both Premium Studio Class Pass types, 1 Day Class Pass) were quoted a flat 5%
 * on the kitchen screens and charged 0% at checkout. Read the column everywhere.
 */

export type PassCategory = "studio_pass" | "class_pass";

/** Whole-number discount percent (0–100) configured on a package type. */
export function cafeDiscountPercentOf(
  // `unknown` so a Prisma Decimal passes straight through — it stringifies cleanly.
  packageType: { cafe_discount_percent?: unknown } | null | undefined,
): number {
  const raw = packageType?.cafe_discount_percent;
  if (raw == null) return 0;
  const n = Number(typeof raw === "object" ? String(raw) : raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(100, n);
}

/**
 * Best discount a member is entitled to right now — the same rule the till uses
 * (`getActivePassCafePercent`): the highest percent across every pass that is
 * active, unpaused and unexpired, not just the most recently purchased one.
 */
export function bestCafeDiscount<
  T extends { package_type?: { cafe_discount_percent?: unknown } | null },
>(passes: T[]): { percent: number; pass: T | null } {
  let best: { percent: number; pass: T | null } = { percent: 0, pass: null };
  for (const p of passes) {
    const percent = cafeDiscountPercentOf(p.package_type);
    if (percent > best.percent) best = { percent, pass: p };
  }
  // No discount anywhere: still surface a pass so the UI can name it.
  if (!best.pass && passes.length > 0) best = { percent: 0, pass: passes[0] };
  return best;
}
