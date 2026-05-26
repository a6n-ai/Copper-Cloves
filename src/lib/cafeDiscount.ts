/**
 * Single source of truth for café food discounts derived from a member's pass.
 *
 * Studio (Unlimited) passes get a tiered discount by duration; Class passes get a
 * flat 5%. Used by member checkout (`portal/book`) and the kitchen members view so
 * the two never drift.
 */

export type PassCategory = "studio_pass" | "class_pass";

/** Studio (Unlimited) pass food discount, keyed by package name. */
export const STUDIO_PASS_FOOD_DISCOUNTS: Record<string, number> = {
  "1 Month Unlimited": 0.1,
  "3 Month Unlimited": 0.12,
  "6 Month Unlimited": 0.15,
  "12 Month Unlimited": 0.2,
};

/** Flat food discount for class-pass holders. */
export const CLASS_PASS_FOOD_DISCOUNT = 0.05;

/**
 * Food discount rate (0–1) for a member's active pass.
 * - studio_pass → tiered lookup by package name (0 if name not mapped)
 * - class_pass  → flat 5%
 * - no pass     → 0
 */
export function cafeDiscountRate(args: {
  category: PassCategory | null | undefined;
  packageName: string | null | undefined;
}): number {
  const { category, packageName } = args;
  if (category === "studio_pass") {
    return STUDIO_PASS_FOOD_DISCOUNTS[packageName ?? ""] ?? 0;
  }
  if (category === "class_pass") {
    return CLASS_PASS_FOOD_DISCOUNT;
  }
  return 0;
}

/** Convenience: discount as a whole-number percent (e.g. 0.12 → 12). */
export function cafeDiscountPercent(args: {
  category: PassCategory | null | undefined;
  packageName: string | null | undefined;
}): number {
  return Math.round(cafeDiscountRate(args) * 100);
}
