/**
 * Pure food-credit math (no prisma) — shared by checkout, cancel and tests.
 * Money in paise at the edges; INR only where the finance snapshot already uses it.
 */

export const toPaise = (inr: number): number => Math.round((Number(inr) || 0) * 100);

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * What the member owes for FOOD after the pass café discount and the food slice of
 * the booking coupon. The coupon is applied to class + food together, so its food
 * share is proportional to food's share of the subtotal.
 */
export function foodPayableInr(snap: {
  classFeeInr: number;
  foodFeeInr: number;
  foodDiscountInr: number;
  couponDiscountInr: number;
}): number {
  const foodNet = Math.max(0, snap.foodFeeInr - snap.foodDiscountInr);
  const sub = Math.max(0, snap.classFeeInr) + foodNet;
  if (foodNet <= 0 || sub <= 0) return 0;
  const couponFood = Math.min(foodNet, (Math.max(0, snap.couponDiscountInr) * foodNet) / sub);
  return Math.max(0, round2(foodNet - couponFood));
}

/** Credit to spend at checkout: never more than the balance or the food owed. */
export function creditToApplyPaise(balancePaise: number, foodOwedInr: number): number {
  return Math.max(0, Math.min(Math.floor(balancePaise), toPaise(foodOwedInr)));
}

/**
 * Credit for a class-booking checkout, shared by the booking page and create-order.
 * With a coupon, at least ₹1 stays on the gateway: a ₹0 booking takes the free path
 * (POST /api/bookings), which never redeems coupons and debits credit per order at
 * the un-couponed price — so coupon + credit could otherwise be refused there.
 */
export function bookingCreditPaise(
  balancePaise: number,
  snap: { classFeeInr: number; foodFeeInr: number; foodDiscountInr: number; couponDiscountInr: number },
): number {
  const credit = creditToApplyPaise(balancePaise, foodPayableInr(snap));
  if (!(snap.couponDiscountInr > 0)) return credit;
  const foodNet = Math.max(0, snap.foodFeeInr - snap.foodDiscountInr);
  const beforeCreditPaise = toPaise(Math.max(0, snap.classFeeInr + foodNet - snap.couponDiscountInr));
  return Math.max(0, Math.min(credit, beforeCreditPaise - 100));
}

/**
 * Split `totalPaise` across lines in proportion to `weights`; the last non-zero
 * line absorbs rounding so the parts always sum to exactly `totalPaise`.
 */
export function splitPaise(weights: number[], totalPaise: number): number[] {
  const out = weights.map(() => 0);
  const sum = weights.reduce((a, w) => a + Math.max(0, w), 0);
  if (sum <= 0 || totalPaise <= 0) return out;
  let lastIdx = -1;
  let assigned = 0;
  weights.forEach((w, i) => {
    if (w <= 0) return;
    out[i] = Math.floor((totalPaise * w) / sum);
    assigned += out[i];
    lastIdx = i;
  });
  out[lastIdx] += totalPaise - assigned;
  return out;
}

/** Cash (gateway) part of an order line = gross − discount − credit, never negative. */
export function lineCashPaise(line: { grossInr: number; discountInr: number; creditPaise: number }): number {
  return Math.max(0, toPaise(line.grossInr) - toPaise(line.discountInr) - Math.max(0, line.creditPaise));
}

export type CancelOutcome = "refund_pending" | "credited" | "none";

/**
 * What a cancelled PENDING order gives back (owner rule, 2026-11-14):
 * - cash paid via Razorpay → refund to Razorpay
 * - any food-credit part → back to the wallet
 * - counter orders (pay at studio) collected nothing → nothing back
 */
export function cancelOutcomeFor(order: {
  paymentMethod: string;
  cashPaise: number;
  creditPaise: number;
}): { outcome: CancelOutcome; refundPaise: number; recreditPaise: number } {
  const recreditPaise = Math.max(0, order.creditPaise);
  if (order.paymentMethod === "razorpay" && order.cashPaise > 0) {
    return { outcome: "refund_pending", refundPaise: order.cashPaise, recreditPaise };
  }
  if (recreditPaise > 0) return { outcome: "credited", refundPaise: 0, recreditPaise };
  return { outcome: "none", refundPaise: 0, recreditPaise: 0 };
}

/** Labels for payment_method; `online`/`pay_at_studio` are legacy aliases of counter. */
export function cafePaymentLabel(method: string | null | undefined): string {
  if (method === "razorpay") return "Paid online";
  if (method === "food_credit") return "Food credit";
  return "Pay at counter";
}
