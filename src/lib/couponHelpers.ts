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
  couponRedemption: { count: (args: unknown) => Promise<number>; create: (args: unknown) => Promise<unknown> };
};

export function normalizeCouponCode(code: unknown): string {
  if (typeof code !== "string") return "";
  return code.trim().toUpperCase();
}

export function computeDiscountInr(
  subtotalInr: number,
  discountType: string,
  discountValue: number | string | { toString(): string }
): number {
  const sub = Math.max(0, subtotalInr);
  if (sub <= 0) return 0;
  const val = typeof discountValue === "number" ? discountValue : Number(discountValue);
  if (!Number.isFinite(val)) return 0;
  if (discountType === "percent") {
    const p = Math.min(100, Math.max(0, val));
    const off = (sub * p) / 100;
    return Math.min(sub, Math.round(off * 100) / 100);
  }
  if (discountType === "fixed") {
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

  const discountInr = computeDiscountInr(subtotalInr, coupon.discount_type, coupon.discount_value);
  if (discountInr <= 0) return { error: "This coupon does not reduce this order" };

  if (coupon.max_uses_per_user != null) {
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
  }

  return { coupon, discountInr };
}

export async function incrementCouponAndRecordRedemption(
  db: DbClient,
  coupon: Coupon,
  discountInr: number,
  context: CouponContext,
  opts: { userId: string | null; guestEmail: string | null }
): Promise<void> {
  const updated = await db.coupon.updateMany({
    where: {
      id: coupon.id,
      OR: [
        { max_redemptions: null },
        {
          AND: [
            { max_redemptions: { not: null } },
            { redemption_count: { lt: coupon.max_redemptions! } },
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
    },
  });
}
