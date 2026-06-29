/**
 * Public pricing display types + mapping. Packages are the DB source of truth
 * (managed in /admin/settings); the public homepage teaser (`components/Pricing.tsx`)
 * and the `/pricing` page fetch them via `usePublicPackages` and render through
 * these shapes. `benefits` is the admin-editable bullet description shown publicly.
 */
import { formatInr } from "@/lib/packageCatalog";
import { effectivePackagePrice } from "@/lib/packageOffer";

export interface PricingPlan {
  name: string;
  price: string;
  originalPrice?: string;
  offerLabel?: string;
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
  offer_price?: number | string | null;
  offer_label?: string | null;
  offer_starts_at?: string | null;
  offer_ends_at?: string | null;
}

/** Human validity label from a package duration (no day-granular column exists). */
export function validityLabel(durationMonths?: number | null): string {
  if (!durationMonths || durationMonths <= 0) return "—";
  return durationMonths === 1 ? "1 month" : `${durationMonths} months`;
}

/** Map a DB package row to the public pricing-card shape. */
export function toPricingPlan(p: PublicPackageRow): PricingPlan {
  const eff = effectivePackagePrice(
    {
      price: p.price,
      offer_price: p.offer_price ?? null,
      offer_label: p.offer_label,
      offer_starts_at: p.offer_starts_at,
      offer_ends_at: p.offer_ends_at,
    },
    new Date(),
  );
  return {
    name: p.name,
    price: formatInr(eff.payableInr),
    originalPrice: eff.isOffer ? formatInr(eff.originalInr) : undefined,
    offerLabel: eff.isOffer ? eff.label ?? undefined : undefined,
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
