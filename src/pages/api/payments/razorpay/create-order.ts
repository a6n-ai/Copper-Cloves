import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "node:crypto";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import {
  BOOKING_CHECKOUT_TAX_RATE,
  expectedBookingCheckoutPaise,
  parseFinanceSnapshot,
  snapshotTotalsConsistent,
} from "@/lib/financeBookingCheckout";
import { parsePendingBookingBody } from "@/lib/pendingRazorpayCheckoutServer";
import { razorpayKeyMode, razorpayKeysMismatch } from "@/lib/razorpayClientHints";
import { persistRazorpayOrderOnCreate } from "@/lib/razorpayPersistence";
import { getRazorpay, razorpayConfigured } from "@/lib/razorpayServer";
import { createPendingBooking } from "@/lib/createPendingBooking";
import { excludeUnlimitedSeatsFromSnapshot, resolvePayableSeats } from "@/lib/groupBilling";
import prisma from "@/lib/prisma";
import { validateAndComputeCoupon, passCategoryForPackageType, type CouponContext } from "@/lib/couponHelpers";
import { effectivePackagePrice, pickPackageCharge } from "@/lib/packageOffer";
import { requestLogger } from "@/lib/logger";

/**
 * Razorpay `receipt` must be ≤ 40 chars (see Orders API). Previously we built a longer string:
 * `8-char prefix + "_" + uuid fragment`, which exceeded the limit and caused order creation to fail.
 */
function buildOrderReceipt(userId: string): string {
  const shortUser = userId.replaceAll("-", "").slice(0, 8);
  const rnd = crypto.randomUUID().replaceAll("-", "");
  const prefix = `${shortUser}_`;
  const maxTotal = 40;
  const restLen = Math.max(1, maxTotal - prefix.length);
  const suffix = rnd.slice(0, restLen);
  return `${prefix}${suffix}`.slice(0, maxTotal);
}

function firstNonEmptyString(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function razorpayFailureMessage(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  if (e && typeof e === "object") {
    const o = e as Record<string, unknown>;
    const nested = o.error as Record<string, unknown> | undefined;
    const text = firstNonEmptyString(
      nested?.description ?? o.description,
      nested?.message ?? o.message,
      nested?.reason ?? o.reason,
    );
    if (text) return text;
    const code = nested?.code ?? o.code;
    if (code !== undefined && String(code).trim())
      return `Razorpay error (code ${typeof code === "object" ? JSON.stringify(code) : String(code)})`;
  }
  return "Razorpay error";
}

type OrderPlan = {
  amount_inr: number;
  orderNotes: Record<string, string>;
  dbNotes: Record<string, unknown>;
};

const PURPOSE_BOOKING = "booking" as const;
const PURPOSE_PACKAGE = "package" as const;
type PlanResult = { ok: boolean; plan?: OrderPlan; status?: number; error?: string };

async function planPackageOrder(userId: string, raw: Record<string, unknown>): Promise<PlanResult> {
  const packageTypeId =
    typeof raw.package_type_id === "string" ? raw.package_type_id.trim() : "";
  if (!packageTypeId) {
    return { ok: false, status: 400, error: "package_type_id is required for package checkout" };
  }
  const packageType = await prisma.packageType.findUnique({ where: { id: packageTypeId } });
  if (!packageType) {
    return { ok: false, status: 404, error: "Package not found" };
  }

  // Authoritative pass category from the package itself (type column, then
  // is_unlimited) — not the client-sent hint — so a studio/class coupon is
  // matched correctly regardless of how the client labelled the package.
  const pass = passCategoryForPackageType(packageType);
  const couponContext: CouponContext = pass;

  const now = new Date();
  const eff = effectivePackagePrice(packageType, now);
  const originalInr = eff.originalInr;
  if (!Number.isFinite(originalInr) || originalInr <= 0) {
    return { ok: false, status: 400, error: "Invalid package price" };
  }
  const offerPayableInr = eff.isOffer ? eff.payableInr : null;

  const couponCode = raw.coupon_code != null && String(raw.coupon_code).trim() ? String(raw.coupon_code).trim() : null;
  let couponInput: { stackable: boolean; discountOnOriginalInr: number; discountOnOfferInr: number } | null = null;

  if (couponCode) {
    // Validity, limits, min-order and cap are authoritative against the original price.
    const vOrig = await validateAndComputeCoupon(prisma, couponCode, couponContext, originalInr, { userId, guestEmail: null });
    if ("error" in vOrig) {
      return { ok: false, status: 400, error: vOrig.error };
    }
    let discountOnOfferInr = 0;
    if (offerPayableInr != null && vOrig.coupon.stackable) {
      // Stacking: recompute the discount against the (lower) offer price. If the offer
      // price falls below the coupon's min-order, the coupon simply contributes nothing.
      const vOffer = await validateAndComputeCoupon(prisma, couponCode, couponContext, offerPayableInr, { userId, guestEmail: null });
      discountOnOfferInr = "error" in vOffer ? 0 : vOffer.discountInr;
    }
    couponInput = {
      stackable: vOrig.coupon.stackable,
      discountOnOriginalInr: vOrig.discountInr,
      discountOnOfferInr,
    };
  }

  const resolved = pickPackageCharge({ originalInr, offerPayableInr, coupon: couponInput });
  const payableInr = resolved.chargeInr;
  if (payableInr <= 0) {
    return {
      ok: false,
      status: 400,
      error: "No payment due for this cart. Complete purchase without checkout.",
    };
  }

  const amount_inr = Math.min(Math.max(Math.round(payableInr), 1), 100_000);
  const orderNotes: Record<string, string> = {
    user_id: userId,
    purpose: PURPOSE_PACKAGE,
    package_type_id: packageTypeId,
    pass_type: pass,
    original_price_inr: String(Math.round(originalInr)),
    offer_applied: resolved.offerApplied ? "1" : "0",
  };
  if (resolved.offerApplied && offerPayableInr != null) {
    orderNotes.offer_price_inr = String(Math.round(offerPayableInr));
  }
  if (couponCode && resolved.couponApplied) {
    orderNotes.coupon_code = couponCode;
  }
  return { ok: true, plan: { amount_inr, orderNotes, dbNotes: { ...orderNotes } } };
}

async function planBookingOrder(userId: string, raw: Record<string, unknown>): Promise<PlanResult> {
  const pendingBody = parsePendingBookingBody(raw.pending_checkout ?? raw);
  if (!pendingBody) {
    return { ok: false, status: 400, error: "Invalid booking checkout payload" };
  }
  const financeSnap = parseFinanceSnapshot(pendingBody.finance_snapshot);
  if (!financeSnap || !snapshotTotalsConsistent(financeSnap)) {
    return { ok: false, status: 400, error: "Invalid finance snapshot" };
  }

  // Group billing (spec Part B): added members who hold an active unlimited pass
  // are covered by their own pass — exclude their seats from the booker's bill.
  // resolvePayableSeats is the single source shared with the booking-row side so
  // the charged amount and the held seats can't drift. Booker exclusion is already
  // handled client-side, so only unlimited *added members* reduce the price here.
  const { unlimitedFreeMemberIds } = await resolvePayableSeats(
    userId,
    pendingBody.added_member_profile_ids ?? [],
    pendingBody.extra_guest_count,
  );
  const adjustedSnap = excludeUnlimitedSeatsFromSnapshot(
    financeSnap,
    unlimitedFreeMemberIds.length,
  );

  // Coupon is client-trusted today only as a hint. Re-derive the discount server-side
  // from the real coupon so a forged `couponDiscountInr` can't reduce the charge, and
  // reject an invalid/exhausted code. The recomputed values overwrite the snapshot so
  // the stored finance row and the charged amount agree with the gateway.
  if (pendingBody.coupon_code) {
    const subtotal = adjustedSnap.classFeeInr + Math.max(0, adjustedSnap.foodFeeInr - adjustedSnap.foodDiscountInr);
    const ctx = resolveBookingCouponContext(pendingBody.coupon_context, adjustedSnap.classFeeInr);
    if (!ctx) return { ok: false, status: 400, error: "Invalid coupon context" };
    const v = await validateAndComputeCoupon(prisma, pendingBody.coupon_code, ctx, subtotal, {
      userId,
      guestEmail: null,
    });
    if ("error" in v) return { ok: false, status: 400, error: v.error };
    const total = Math.round(Math.max(0, subtotal - v.discountInr) * 100) / 100;
    adjustedSnap.couponDiscountInr = v.discountInr;
    adjustedSnap.totalInr = total;
    adjustedSnap.taxInr = Math.round((total * BOOKING_CHECKOUT_TAX_RATE / (1 + BOOKING_CHECKOUT_TAX_RATE)) * 100) / 100;
  } else {
    // No code → no discount. Don't trust a stray couponDiscountInr.
    if (adjustedSnap.couponDiscountInr > 0) {
      const total = Math.round(Math.max(0, adjustedSnap.classFeeInr + Math.max(0, adjustedSnap.foodFeeInr - adjustedSnap.foodDiscountInr)) * 100) / 100;
      adjustedSnap.couponDiscountInr = 0;
      adjustedSnap.totalInr = total;
      adjustedSnap.taxInr = Math.round((total * BOOKING_CHECKOUT_TAX_RATE / (1 + BOOKING_CHECKOUT_TAX_RATE)) * 100) / 100;
    }
  }
  pendingBody.finance_snapshot = adjustedSnap;

  const amount_paise = expectedBookingCheckoutPaise(adjustedSnap.totalInr);
  if (amount_paise <= 0) {
    // Whole group is pass-covered — nothing to charge online. Fall back to the
    // free-booking path (POST /api/bookings) instead of a ₹0 gateway order.
    return { ok: false, status: 400, error: "No payment due for this booking." };
  }
  return {
    ok: true,
    plan: {
      amount_inr: amount_paise / 100,
      orderNotes: { user_id: userId, purpose: PURPOSE_BOOKING },
      dbNotes: { user_id: userId, purpose: PURPOSE_BOOKING, pending_checkout: pendingBody },
    },
  };
}

/** Booking coupon context: food-only bookings use `food`; otherwise honor the client's
 *  class/studio pass hint. The coupon's own `applies_to` guard still rejects a mismatch. */
function resolveBookingCouponContext(
  hint: string | null | undefined,
  classFeeInr: number,
): CouponContext | null {
  if (classFeeInr <= 0) return "food";
  if (hint === "studio_pass" || hint === "class_pass" || hint === "food") return hint;
  return null;
}

function planGenericOrder(userId: string, raw: Record<string, unknown>): PlanResult {
  const bodyAmount = raw.amount_inr;
  if (bodyAmount === undefined || bodyAmount === null || bodyAmount === "") {
    return { ok: false, status: 400, error: "amount_inr is required" };
  }
  const ra = Number(bodyAmount);
  if (!Number.isFinite(ra) || ra <= 0) {
    return { ok: false, status: 400, error: "Invalid amount_inr" };
  }
  return {
    ok: true,
    plan: {
      amount_inr: Math.min(Math.max(ra, 1), 100_000),
      orderNotes: { user_id: userId },
      dbNotes: { user_id: userId },
    },
  };
}

async function planOrder(userId: string, raw: Record<string, unknown>): Promise<PlanResult> {
  if (raw.purpose === PURPOSE_PACKAGE) return planPackageOrder(userId, raw);
  if (raw.purpose === PURPOSE_BOOKING || raw.pending_checkout != null) return await planBookingOrder(userId, raw);
  return planGenericOrder(userId, raw);
}

/**
 * POST
 * - `{ purpose: "booking", pending_checkout }` — class booking (amount derived from finance snapshot).
 * - `{ amount_inr: number }` — legacy generic amount-only checkout.
 * - `{ purpose: "package", package_type_id, pass_type?, coupon_code? }` — server-priced package
 *   checkout for /portal/packages (coupon applied server-side; client must not set amount).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const log = requestLogger(req, res);
  if (req.method !== "POST") return res.status(405).end();

  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  if (!razorpayConfigured()) {
    return res.status(503).json({
      error:
        "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET (Amplify Console or .env.local).",
    });
  }

  const userId = (session.user as { id: string }).id;
  const raw = req.body as Record<string, unknown>;

  const planned = await planOrder(userId, raw);
  if (!planned.ok) {
    return res.status(planned.status).json({ error: planned.error });
  }
  const { amount_inr, orderNotes, dbNotes } = planned.plan;

  const amount_paise = Math.round(amount_inr * 100);

  // BOOKING: reserve a payment_pending seat BEFORE creating the Razorpay order so
  // capacity is enforced and two members can't both pay for the last seat. If the
  // reservation fails we never create the gateway order.
  let pendingBookingId: string | null = null;
  if (dbNotes.purpose === PURPOSE_BOOKING) {
    const pending = (dbNotes as { pending_checkout?: Record<string, unknown> }).pending_checkout;
    if (!pending) {
      return res.status(400).json({ error: "Invalid booking checkout payload" });
    }
    const classScheduleId = String(pending.class_schedule_id ?? "");
    const extraGuestCount = Number(pending.extra_guest_count ?? 0) || 0;
    const addedMemberProfileIds = Array.isArray((pending as { added_member_profile_ids?: unknown }).added_member_profile_ids)
      ? ((pending as { added_member_profile_ids: unknown[] }).added_member_profile_ids).filter(
          (id): id is string => typeof id === "string" && id.length > 0,
        )
      : [];
    const addedMemberCount = addedMemberProfileIds.length;
    const className = typeof pending.class_name === "string" ? pending.class_name : null;
    const classTimeISO = typeof pending.class_time === "string" ? pending.class_time : "";

    let bookerEmail =
      typeof (session.user as { email?: unknown }).email === "string"
        ? ((session.user as { email: string }).email)
        : null;
    if (!bookerEmail) {
      const profile = await prisma.profile.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      bookerEmail = profile?.email ?? null;
    }

    try {
      pendingBookingId = await createPendingBooking({
        userId,
        classScheduleId,
        className,
        classTimeISO,
        extraGuestCount,
        addedMemberCount,
        addedMemberProfileIds,
        financeSnapshot: pending.finance_snapshot,
        email: bookerEmail,
        guestAttendees: (pending as { guest_attendees?: unknown }).guest_attendees,
      });
    } catch (e: unknown) {
      const code = e instanceof Error ? e.message : "";
      if (code === "CLASS_FULL" || code === "ALREADY_BOOKED") {
        return res.status(409).json({ error: code });
      }
      if (code === "CLASS_CANCELLED" || code === "SCHEDULE_NOT_FOUND") {
        return res.status(400).json({ error: code });
      }
      log.error({ err: e, userId, classScheduleId }, "createPendingBooking failed");
      return res.status(500).json({ error: "Failed to reserve seat" });
    }
  }

  try {
    const razorpay = getRazorpay();
    const receipt = buildOrderReceipt(userId);

    const order = await razorpay.orders.create({
      amount: amount_paise,
      currency: "INR",
      receipt,
      notes: orderNotes,
      // Auto-capture on authorization — Razorpay debits the customer the moment
      // the payment is authorized, so a closed tab / missed webhook can't leave
      // funds stuck in `authorized` (which auto-refunds after ~5 days). Our
      // captureAuthorizedPayment + reconcile remain idempotent backstops.
      payment_capture: 1,
    } as Parameters<typeof razorpay.orders.create>[0]);

    try {
      await persistRazorpayOrderOnCreate({
        userId,
        razorpayOrderId: order.id,
        amountPaise: Number(order.amount),
        currency: order.currency ?? "INR",
        receipt,
        notes: dbNotes,
        bookingId: pendingBookingId,
      });
    } catch (dbErr) {
      log.error({ err: dbErr, razorpayOrderId: order.id, userId }, "persist razorpay order row failed");
    }

    log.info({ userId, razorpayOrderId: order.id, amount: order.amount }, "razorpay order created");

    const serverKeyId = process.env.RAZORPAY_KEY_ID?.trim() ?? "";
    const publicKeyId =
      process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim() || serverKeyId;
    const keyId = publicKeyId || serverKeyId;
    const keyMismatch = razorpayKeysMismatch(serverKeyId, publicKeyId);
    if (keyMismatch) {
      return res.status(503).json({
        error:
          "Razorpay key mismatch: RAZORPAY_KEY_ID and NEXT_PUBLIC_RAZORPAY_KEY_ID must both be test (rzp_test_) or both live (rzp_live_).",
        key_mismatch: true,
      });
    }
    return res.status(200).json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: keyId,
      razorpay_mode: razorpayKeyMode(keyId),
    });
  } catch (e: unknown) {
    log.error({ err: e, userId }, "razorpay create-order failed");
    const msg = razorpayFailureMessage(e);
    return res.status(502).json({ error: msg });
  }
}
