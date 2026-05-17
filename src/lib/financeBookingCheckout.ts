/** Finance-1: booking checkout snapshot from portal/book (validated on POST /api/bookings). */

export const BOOKING_CHECKOUT_TAX_RATE = 0.05;

export type GuestAttendee = { name?: string; email?: string; phone?: string };

export type FinanceSnapshotV1 = {
  version: 1;
  classFeeInr: number;
  foodFeeInr: number;
  foodDiscountInr: number;
  couponDiscountInr: number;
  taxInr: number;
  totalInr: number;
  dayPassEquivalentCount: number;
  noActivePackageCheckout: boolean;
  paymentMethod: "online" | "studio";
};

function finiteNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function parseFinanceSnapshot(raw: unknown): FinanceSnapshotV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) return null;
  const classFeeInr = finiteNum(o.classFeeInr);
  const foodFeeInr = finiteNum(o.foodFeeInr);
  const foodDiscountInr = finiteNum(o.foodDiscountInr);
  const couponDiscountInr = finiteNum(o.couponDiscountInr) ?? 0;
  const taxInr = finiteNum(o.taxInr);
  const totalInr = finiteNum(o.totalInr);
  const dayPassEquivalentCount = Number(o.dayPassEquivalentCount);
  if (
    classFeeInr == null ||
    foodFeeInr == null ||
    foodDiscountInr == null ||
    taxInr == null ||
    totalInr == null
  )
    return null;
  if (!Number.isInteger(dayPassEquivalentCount) || dayPassEquivalentCount < 0 || dayPassEquivalentCount > 50)
    return null;
  if (typeof o.noActivePackageCheckout !== "boolean") return null;
  if (o.paymentMethod !== "online" && o.paymentMethod !== "studio") return null;

  return {
    version: 1,
    classFeeInr,
    foodFeeInr,
    foodDiscountInr,
    couponDiscountInr,
    taxInr,
    totalInr,
    dayPassEquivalentCount,
    noActivePackageCheckout: o.noActivePackageCheckout,
    paymentMethod: o.paymentMethod,
  };
}

/**
 * Paise charged at Razorpay — must match `create-order` (`Math.round(totalInr)` INR)
 * and POST /api/bookings validation.
 */
export function expectedBookingCheckoutPaise(totalInr: number): number {
  if (!Number.isFinite(totalInr) || totalInr <= 0) return 0;
  const amountInr = Math.min(Math.max(Math.round(totalInr), 1), 100_000);
  return Math.round(amountInr * 100);
}

export function snapshotTotalsConsistent(snap: FinanceSnapshotV1): boolean {
  const foodNet = snap.foodFeeInr - snap.foodDiscountInr;
  const sub = snap.classFeeInr + Math.max(0, foodNet);
  // Prices are tax-inclusive. Total = sub minus coupon discount.
  const totalRounded = Math.round(Math.max(0, sub - snap.couponDiscountInr) * 100) / 100;
  // Tax is extracted from the inclusive total.
  const taxRounded = Math.round((totalRounded * BOOKING_CHECKOUT_TAX_RATE / (1 + BOOKING_CHECKOUT_TAX_RATE)) * 100) / 100;
  return (
    Math.abs(snap.taxInr - taxRounded) <= 0.06 && Math.abs(snap.totalInr - totalRounded) <= 0.15
  );
}

export function parseGuestAttendees(raw: unknown): GuestAttendee[] | null {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) return null;
  const out: GuestAttendee[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") return null;
    const g = row as Record<string, unknown>;
    const name = g.name != null ? String(g.name).trim().slice(0, 120) : "";
    const email = g.email != null ? String(g.email).trim().slice(0, 120) : "";
    const phone = g.phone != null ? String(g.phone).trim().slice(0, 40) : "";
    out.push({
      ...(name ? { name } : {}),
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
    });
  }
  return out;
}
