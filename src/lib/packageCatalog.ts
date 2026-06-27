/**
 * Single source of truth for the public package catalog (8 packages, 2
 * categories). The portal pricing page, the catalog upsert script, and any
 * future admin tooling all read from here so the UI and the `PackageType` DB
 * rows can never drift. Adding/retiring a package = edit this list, then run
 * the catalog upsert.
 */
export type PackageCategory = "studio" | "class";

export interface CatalogPackage {
  name: string;
  category: PackageCategory;
  priceInr: number;
  durationMonths: number;
  validity: string; // human label, e.g. "30 days"
  classCount: number | null; // null = unlimited
  isUnlimited: boolean;
  benefits: string[];
  featured?: boolean;
  badge?: string;
  displayOrder?: number;
  isPublished?: boolean; // defaults to true when unset
}

const BASE_BENEFITS = ["Access Any Class", "Flexible Scheduling", "Shower Facilities"];

export const PACKAGE_CATALOG: CatalogPackage[] = [
  {
    // Comp/refund primitive: granted on comp + class-cancellation refunds.
    // Runtime validity comes from StudioSettings at grant time, not its own duration.
    name: "1 Class Pass",
    category: "class",
    priceInr: 0,
    durationMonths: 1,
    validity: "Set at grant",
    classCount: 1,
    isUnlimited: false,
    benefits: ["Access Any Class"],
    displayOrder: 0,
    isPublished: false,
  },
  {
    name: "1 Day Class Pass",
    category: "class",
    priceInr: 945,
    durationMonths: 1,
    validity: "1 day",
    classCount: 1,
    isUnlimited: false,
    benefits: [...BASE_BENEFITS, "Cafe Credits"],
  },
  {
    name: "4 Class Pass",
    category: "class",
    priceInr: 3700,
    durationMonths: 1,
    validity: "30 days",
    classCount: 4,
    isUnlimited: false,
    benefits: [...BASE_BENEFITS, "Cafe Credits"],
  },
  {
    name: "8 Class Pass",
    category: "class",
    priceInr: 7200,
    durationMonths: 1,
    validity: "40 days",
    classCount: 8,
    isUnlimited: false,
    benefits: [...BASE_BENEFITS, "Cafe Credits"],
  },
  {
    name: "12 Class Pass",
    category: "class",
    priceInr: 10500,
    durationMonths: 2,
    validity: "60 days",
    classCount: 12,
    isUnlimited: false,
    benefits: [...BASE_BENEFITS, "Cafe Credits"],
  },
  {
    name: "1 Month Unlimited",
    category: "studio",
    priceInr: 12500,
    durationMonths: 1,
    validity: "30 days",
    classCount: null,
    isUnlimited: true,
    benefits: [...BASE_BENEFITS, "Flat 10% Off on Cafe", "Tote Bag", "1 Complimentary Aerial Class"],
  },
  {
    name: "3 Month Unlimited",
    category: "studio",
    priceInr: 36000,
    durationMonths: 3,
    validity: "90 days",
    classCount: null,
    isUnlimited: true,
    benefits: [...BASE_BENEFITS, "Flat 12% Off on Cafe", "C+C Tote Bag + C+C Bottle", "2 Complimentary Aerial Class"],
    featured: true,
    badge: "Most Popular",
  },
  {
    name: "6 Month Unlimited",
    category: "studio",
    priceInr: 42500,
    durationMonths: 6,
    validity: "180 days",
    classCount: null,
    isUnlimited: true,
    benefits: [...BASE_BENEFITS, "Flat 15% Off on Cafe", "C+C Tote Bag & C+C Bottle", "3 Complimentary Aerial Class", "Access to AI Features"],
  },
  {
    name: "12 Month Unlimited",
    category: "studio",
    priceInr: 51000,
    durationMonths: 12,
    validity: "365 days",
    classCount: null,
    isUnlimited: true,
    benefits: [...BASE_BENEFITS, "Flat 20% Off on Cafe", "C+C Tote Bag & C+C Bottle", "4 Complimentary Aerial Class", "Access to AI Features"],
  },
];

/** PackageType.type value for a catalog entry (coupon category source). */
export const catalogPackageType = (p: CatalogPackage): "studio_pass" | "class_pass" =>
  p.isUnlimited ? "studio_pass" : "class_pass";

/** ₹ display string, e.g. 12500 -> "₹12,500". */
export const formatInr = (inr: number): string => `₹${inr.toLocaleString("en-IN")}`;
