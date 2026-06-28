import type { Coupon } from "@/generated/prisma/client";

export type CouponContext = "food" | "ecommerce" | "class_pass" | "studio_pass";

export const COUPON_CONTEXTS: { value: CouponContext; label: string }[] = [
  { value: "food", label: "Food (Café)" },
  { value: "ecommerce", label: "Ecommerce (Boutique)" },
  { value: "class_pass", label: "Class pass" },
  { value: "studio_pass", label: "Studio pass" },
];

/** Prisma client or transaction client */
type DbClient = {
  coupon: {
    findUnique: (args: unknown) => Promise<Coupon | null>;
    updateMany: (args: unknown) => Promise<{ count: number }>;
  };
  couponRedemption: {
    count: (args: unknown) => Promise<number>;
    create: (args: unknown) => Promise<unknown>;
    findMany: (args: unknown) => Promise<{ id: string; coupon_id: string }[]>;
    deleteMany: (args: unknown) => Promise<{ count: number }>;
  };
};

/**
 * Authoritative pass category for a package type, used to pick the coupon context
 * (studio_pass vs class_pass). Prefers the explicit `type` column; falls back to
 * `is_unlimited` for legacy "standard" rows (unlimited passes are studio passes).
 */
export function passCategoryForPackageType(pt: {
  type?: string | null;
  is_unlimited?: boolean | null;
}): "studio_pass" | "class_pass" {
  const t = String(pt.type ?? "").trim().toLowerCase();
  if (t === "studio_pass" || t === "studio") return "studio_pass";
  if (t === "class_pass" || t === "class") return "class_pass";
  return pt.is_unlimited ? "studio_pass" : "class_pass";
}

export function normalizeCouponCode(code: unknown): string {
  if (typeof code !== "string") return "";
  return code.trim().toUpperCase();
}

function finiteOrNaN(n: number): number {
  return Number.isFinite(n) ? n : NaN;
}

function objectToFiniteNumber(value: object): number {
  const withToNumber = value as { toNumber?: () => number };
  if (typeof withToNumber.toNumber === "function") {
    try {
      return finiteOrNaN(withToNumber.toNumber());
    } catch {
      /* fall through */
    }
  }
  if (typeof (value as { valueOf?: () => unknown }).valueOf === "function") {
    return finiteOrNaN(Number((value as { valueOf: () => unknown }).valueOf()));
  }
  return NaN;
}

/** Coerce Prisma Decimal, string, or number to a finite number (avoids NaN from `Number(Decimal)` in some runtimes). */
export function toFiniteNumber(value: unknown): number {
  if (typeof value === "number") return finiteOrNaN(value);
  if (value == null) return NaN;
  if (typeof value === "string") return finiteOrNaN(Number(value.trim()));
  if (typeof value === "object") return objectToFiniteNumber(value);
  return NaN;
}

export function normalizeDiscountType(raw: string): "percent" | "fixed" | null {
  const t = String(raw ?? "").trim().toLowerCase();
  if (t === "percent" || t === "percentage" || t === "pct") return "percent";
  if (t === "fixed" || t === "amount" || t === "flat") return "fixed";
  return null;
}

export function computeDiscountInr(
  subtotalInr: number,
  discountType: string,
  discountValue: number | string | { toString(): string }
): number {
  const sub = Math.max(0, subtotalInr);
  if (sub <= 0) return 0;
  const normalizedType = normalizeDiscountType(discountType);
  if (!normalizedType) return 0;
  const val = toFiniteNumber(discountValue);
  if (!Number.isFinite(val)) return 0;
  if (normalizedType === "percent") {
    const p = Math.min(100, Math.max(0, val));
    const off = (sub * p) / 100;
    return Math.min(sub, Math.round(off * 100) / 100);
  }
  if (normalizedType === "fixed") {
    return Math.min(sub, Math.max(0, Math.round(val * 100) / 100));
  }
  return 0;
}

export function isCouponActiveNow(c: {
  is_active: boolean;
  starts_at: Date | null;
  ends_at: Date | null;
}): boolean {
  if (!c.is_active) return false;
  const now = new Date();
  if (c.starts_at && now < c.starts_at) return false;
  if (c.ends_at && now > c.ends_at) return false;
  return true;
}

async function checkCouponPerUserLimit(
  db: DbClient,
  coupon: Coupon,
  opts: { userId: string | null; guestEmail: string | null }
): Promise<{ error: string } | null> {
  if (coupon.max_uses_per_user == null) return null;

  let used = 0;
  if (opts.userId) {
    used = await db.couponRedemption.count({
      where: { coupon_id: coupon.id, user_id: opts.userId },
    });
  } else if (opts.guestEmail && opts.guestEmail.trim()) {
    used = await db.couponRedemption.count({
      where: {
        coupon_id: coupon.id,
        guest_email: opts.guestEmail.trim().toLowerCase(),
      },
    });
  } else {
    return { error: "Sign in or provide an email to use this coupon" };
  }
  if (used >= coupon.max_uses_per_user) return { error: "You have already used this coupon" };
  return null;
}

export async function validateAndComputeCoupon(
  db: DbClient,
  rawCode: string,
  context: CouponContext,
  subtotalInr: number,
  opts: { userId: string | null; guestEmail: string | null }
): Promise<{ coupon: Coupon; discountInr: number } | { error: string }> {
  const code = normalizeCouponCode(rawCode);
  if (!code) return { error: "Enter a coupon code" };
  if (subtotalInr <= 0) return { error: "Order total must be greater than zero" };

  const coupon = await db.coupon.findUnique({ where: { code } });
  if (!coupon) return { error: "Invalid coupon code" };
  if (!isCouponActiveNow(coupon)) return { error: "This coupon is not valid right now" };
  if (coupon.applies_to !== context) return { error: "This coupon does not apply to this type of purchase" };
  if (coupon.max_redemptions != null && coupon.redemption_count >= coupon.max_redemptions) {
    return { error: "This coupon has reached its usage limit" };
  }

  const dtype = normalizeDiscountType(coupon.discount_type);
  if (!dtype) return { error: "This coupon has an invalid discount type" };
  const discountInr = computeDiscountInr(subtotalInr, dtype, coupon.discount_value);
  if (discountInr <= 0) return { error: "This coupon does not reduce this order" };

  const perUserError = await checkCouponPerUserLimit(db, coupon, opts);
  if (perUserError) return perUserError;

  return { coupon, discountInr };
}

export async function incrementCouponAndRecordRedemption(
  db: DbClient,
  coupon: Coupon,
  discountInr: number,
  context: CouponContext,
  opts: {
    userId: string | null;
    guestEmail: string | null;
    /** Link the redemption to a booking — refund-on-cancel key + idempotency guard. */
    bookingId?: string | null;
    /** Link the redemption to a purchased package — for a future package-cancel reversal. */
    userPackageId?: string | null;
  }
): Promise<void> {
  const updated = await db.coupon.updateMany({
    where: {
      id: coupon.id,
      OR: [
        { max_redemptions: null },
        {
          AND: [
            { max_redemptions: { not: null } },
            { redemption_count: { lt: coupon.max_redemptions ?? 0 } },
          ],
        },
      ],
    },
    data: { redemption_count: { increment: 1 } },
  });
  if (updated.count !== 1) {
    throw new Error("COUPON_EXHAUSTED");
  }

  await db.couponRedemption.create({
    data: {
      coupon_id: coupon.id,
      user_id: opts.userId,
      guest_email: opts.guestEmail?.trim() ? opts.guestEmail.trim().toLowerCase() : null,
      context,
      discount_amount: discountInr,
      booking_id: opts.bookingId ?? null,
      user_package_id: opts.userPackageId ?? null,
    },
  });
}

/**
 * Reverse coupon redemptions tied to a cancelled booking or package: delete the
 * redemption rows and decrement each affected coupon's `redemption_count` (floored
 * at 0). Idempotent — a second call finds no rows and is a no-op. Returns the number
 * of redemptions released.
 */
export async function releaseCouponRedemption(
  db: DbClient,
  target: { bookingId?: string | null; userPackageId?: string | null }
): Promise<number> {
  const where =
    target.bookingId != null
      ? { booking_id: target.bookingId }
      : target.userPackageId != null
        ? { user_package_id: target.userPackageId }
        : null;
  if (!where) return 0;

  const rows = await db.couponRedemption.findMany({ where });
  if (rows.length === 0) return 0;

  // Decrement each coupon by how many of its redemptions we're releasing.
  const perCoupon = new Map<string, number>();
  for (const r of rows) perCoupon.set(r.coupon_id, (perCoupon.get(r.coupon_id) ?? 0) + 1);
  for (const [couponId, n] of perCoupon) {
    await db.coupon.updateMany({
      where: { id: couponId, redemption_count: { gte: n } },
      data: { redemption_count: { decrement: n } },
    });
  }

  await db.couponRedemption.deleteMany({ where });
  return rows.length;
}
