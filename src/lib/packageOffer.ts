import { toFiniteNumber } from "@/lib/couponHelpers";

export interface EffectivePackagePrice {
  payableInr: number;
  originalInr: number;
  isOffer: boolean;
  label: string | null;
}

interface OfferFields {
  price: unknown;
  offer_price: unknown;
  offer_label?: string | null;
  offer_starts_at?: Date | string | null;
  offer_ends_at?: Date | string | null;
}

function toDate(v: Date | string | null | undefined): Date | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function offerActive(pkg: OfferFields, now: Date): boolean {
  const original = toFiniteNumber(pkg.price);
  const offer = toFiniteNumber(pkg.offer_price);
  if (!Number.isFinite(offer) || !Number.isFinite(original)) return false;
  if (offer <= 0 || offer >= original) return false;
  const starts = toDate(pkg.offer_starts_at);
  const ends = toDate(pkg.offer_ends_at);
  if (starts && now < starts) return false;
  if (ends && now > ends) return false;
  return true;
}

export function effectivePackagePrice(pkg: OfferFields, now: Date): EffectivePackagePrice {
  const originalInr = toFiniteNumber(pkg.price) || 0;
  if (!offerActive(pkg, now)) {
    return { payableInr: originalInr, originalInr, isOffer: false, label: null };
  }
  return {
    payableInr: toFiniteNumber(pkg.offer_price),
    originalInr,
    isOffer: true,
    label: pkg.offer_label?.trim() ? pkg.offer_label.trim() : null,
  };
}

export type OfferDisplayState = "none" | "scheduled" | "active" | "expired";

export function offerState(pkg: OfferFields, now: Date): OfferDisplayState {
  const offer = toFiniteNumber(pkg.offer_price);
  const original = toFiniteNumber(pkg.price);
  if (!Number.isFinite(offer) || offer <= 0 || offer >= original) return "none";
  const starts = toDate(pkg.offer_starts_at);
  const ends = toDate(pkg.offer_ends_at);
  if (starts && now < starts) return "scheduled";
  if (ends && now > ends) return "expired";
  return "active";
}

export interface PackageChargeInput {
  originalInr: number;
  offerPayableInr: number | null;
  coupon: { stackable: boolean; discountOnOriginalInr: number; discountOnOfferInr: number } | null;
}

export function pickPackageCharge(input: PackageChargeInput): {
  chargeInr: number;
  offerApplied: boolean;
  couponApplied: boolean;
} {
  const { originalInr, offerPayableInr, coupon } = input;
  const offerActiveNow = offerPayableInr != null;

  if (!coupon) {
    return {
      chargeInr: offerActiveNow ? offerPayableInr! : originalInr,
      offerApplied: offerActiveNow,
      couponApplied: false,
    };
  }

  if (!offerActiveNow) {
    const charge = Math.max(0, originalInr - coupon.discountOnOriginalInr);
    return { chargeInr: charge, offerApplied: false, couponApplied: coupon.discountOnOriginalInr > 0 };
  }

  if (coupon.stackable) {
    const charge = Math.max(0, offerPayableInr! - coupon.discountOnOfferInr);
    return { chargeInr: charge, offerApplied: true, couponApplied: coupon.discountOnOfferInr > 0 };
  }

  // best-of: lower of (offer price) vs (coupon applied to original)
  const couponOnOriginal = Math.max(0, originalInr - coupon.discountOnOriginalInr);
  if (couponOnOriginal < offerPayableInr!) {
    return { chargeInr: couponOnOriginal, offerApplied: false, couponApplied: true };
  }
  return { chargeInr: offerPayableInr!, offerApplied: true, couponApplied: false };
}
