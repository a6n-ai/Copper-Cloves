import { passCategoryForPackageType } from "@/lib/couponHelpers";

export type BackfillablePackage = {
  credits_remaining: number | null;
  credits_total: number | null;
  classes_remaining: number | null;
  package_type: { type?: string | null; is_unlimited?: boolean | null };
};

/**
 * Decides how to backfill the authoritative count for one UserPackage.
 * Returns the new values, or null when no change is needed.
 * Only class passes with a null `credits_remaining` and a non-null legacy
 * `classes_remaining` are filled; studio (unlimited) passes stay null.
 */
export function shouldBackfillCredits(
  pkg: BackfillablePackage
): { credits_remaining: number; credits_total: number } | null {
  if (pkg.credits_remaining != null) return null;
  if (pkg.classes_remaining == null) return null;
  if (passCategoryForPackageType(pkg.package_type) !== "class_pass") return null;
  return {
    credits_remaining: pkg.classes_remaining,
    credits_total: pkg.credits_total ?? pkg.classes_remaining,
  };
}
