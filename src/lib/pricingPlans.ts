/**
 * Public pricing display types + mapping. Packages are the DB source of truth
 * (managed in /admin/settings); the public homepage teaser (`components/Pricing.tsx`)
 * and the `/pricing` page fetch them via `usePublicPackages` and render through
 * these shapes. `benefits` is the admin-editable bullet description shown publicly.
 */
import { formatInr } from "@/lib/packageCatalog";

export interface PricingPlan {
  name: string;
  price: string;
  classes: number | string;
  validity: string;
  benefits: string[];
  featured?: boolean;
  badge?: string;
}

/** A published PackageType row as returned by GET /api/packages. */
export interface PublicPackageRow {
  name: string;
  price: number | string;
  class_count?: number | null;
  duration_months?: number | null;
  is_unlimited?: boolean;
  benefits?: string[] | null;
  featured?: boolean;
  badge?: string | null;
  display_order?: number | null;
  is_published?: boolean;
}

/** Human validity label from a package duration (no day-granular column exists). */
export function validityLabel(durationMonths?: number | null): string {
  if (!durationMonths || durationMonths <= 0) return "—";
  return durationMonths === 1 ? "1 month" : `${durationMonths} months`;
}

/** Map a DB package row to the public pricing-card shape. */
export function toPricingPlan(p: PublicPackageRow): PricingPlan {
  return {
    name: p.name,
    price: formatInr(Number(p.price) || 0),
    classes: p.is_unlimited ? "Unlimited" : p.class_count ?? 0,
    validity: validityLabel(p.duration_months),
    benefits: Array.isArray(p.benefits) ? p.benefits : [],
    featured: p.featured,
    badge: p.badge ?? undefined,
  };
}

/** Split published rows into studio (unlimited) vs class tiers, by display_order. */
export function splitPricingPlans(rows: PublicPackageRow[]): {
  studioPlans: PricingPlan[];
  classPlans: PricingPlan[];
} {
  // Public pages always show published-only — the admin /api/packages GET returns
  // all rows, so filter defensively here too.
  const sorted = [...rows]
    .filter((p) => p.is_published !== false)
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  return {
    studioPlans: sorted.filter((p) => p.is_unlimited).map(toPricingPlan),
    classPlans: sorted.filter((p) => !p.is_unlimited).map(toPricingPlan),
  };
}

/** Human label for a plan's class count, e.g. "8 classes" or "Unlimited classes". */
export function planClassesLabel(plan: PricingPlan): string {
  if (typeof plan.classes === "number") {
    return `${plan.classes} ${plan.classes === 1 ? "class" : "classes"}`;
  }
  return `${plan.classes} classes`;
}
