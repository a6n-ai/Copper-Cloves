/**
 * Public pricing catalogue. Single source of truth for the homepage pricing
 * teaser (`components/Pricing.tsx`) and the dedicated `/pricing` page. These are
 * marketing display values; the authoritative, purchasable packages live in the
 * member portal (`/portal/packages`), which every CTA routes to.
 */
export interface PricingPlan {
  name: string;
  price: string;
  classes: number | string;
  validity: string;
  benefits: string[];
  featured?: boolean;
  badge?: string;
}

/** Unlimited memberships — the "Studio Pass" tier. */
export const studioPassPlans: PricingPlan[] = [
  {
    name: "1 Month Unlimited",
    price: "₹12,500",
    classes: "Unlimited",
    validity: "30 days",
    benefits: [
      "Access any class",
      "Flexible scheduling",
      "Shower facilities",
      "Flat 10% off at the café",
      "C+C tote bag",
      "1 complimentary aerial class",
    ],
  },
  {
    name: "3 Month Unlimited",
    price: "₹36,000",
    classes: "Unlimited",
    validity: "90 days",
    benefits: [
      "Access any class",
      "Flexible scheduling",
      "Shower facilities",
      "Flat 12% off at the café",
      "C+C tote bag + bottle",
      "2 complimentary aerial classes",
    ],
    featured: true,
    badge: "Most Popular",
  },
  {
    name: "6 Month Unlimited",
    price: "₹42,500",
    classes: "Unlimited",
    validity: "180 days",
    benefits: [
      "Access any class",
      "Flexible scheduling",
      "Shower facilities",
      "Flat 15% off at the café",
      "C+C tote bag + bottle",
      "3 complimentary aerial classes",
      "Access to AI features",
    ],
  },
  {
    name: "12 Month Unlimited",
    price: "₹51,000",
    classes: "Unlimited",
    validity: "365 days",
    benefits: [
      "Access any class",
      "Flexible scheduling",
      "Shower facilities",
      "Flat 20% off at the café",
      "C+C tote bag + bottle",
      "4 complimentary aerial classes",
      "Access to AI features",
    ],
  },
];

/** Pay-as-you-go bundles — the "Class Pass" tier. */
export const classPassPlans: PricingPlan[] = [
  {
    name: "1 Day Class Pass",
    price: "₹945",
    classes: 1,
    validity: "1 day",
    benefits: ["Access any class", "Flexible scheduling", "Shower facilities", "Café credits"],
  },
  {
    name: "4 Class Pass",
    price: "₹3,700",
    classes: 4,
    validity: "30 days",
    benefits: ["Access any class", "Flexible scheduling", "Shower facilities", "Café credits"],
  },
  {
    name: "8 Class Pass",
    price: "₹7,200",
    classes: 8,
    validity: "40 days",
    benefits: ["Access any class", "Flexible scheduling", "Shower facilities", "Café credits"],
    featured: true,
    badge: "Best Value",
  },
  {
    name: "12 Class Pass",
    price: "₹10,500",
    classes: 12,
    validity: "60 days",
    benefits: ["Access any class", "Flexible scheduling", "Shower facilities", "Café credits"],
  },
];

/** Human label for a plan's class count, e.g. "8 classes" or "Unlimited classes". */
export function planClassesLabel(plan: PricingPlan): string {
  if (typeof plan.classes === "number") {
    return `${plan.classes} ${plan.classes === 1 ? "class" : "classes"}`;
  }
  return `${plan.classes} classes`;
}
