import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "node:crypto";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import {
  expectedBookingCheckoutPaise,
  parseFinanceSnapshot,
  snapshotTotalsConsistent,
} from "@/lib/financeBookingCheckout";
import { parsePendingBookingBody } from "@/lib/pendingRazorpayCheckoutServer";
import { razorpayKeyMode, razorpayKeysMismatch } from "@/lib/razorpayClientHints";
import { persistRazorpayOrderOnCreate } from "@/lib/razorpayPersistence";
import { getRazorpay, razorpayConfigured } from "@/lib/razorpayServer";
import { createPendingBooking } from "@/lib/createPendingBooking";
import prisma from "@/lib/prisma";
import { validateAndComputeCoupon, toFiniteNumber, passCategoryForPackageType, type CouponContext } from "@/lib/couponHelpers";
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

  const subtotal = toFiniteNumber(packageType.price);
  if (!Number.isFinite(subtotal) || subtotal <= 0) {
    return { ok: false, status: 400, error: "Invalid package price" };
  }

  let discountInr = 0;
  if (raw.coupon_code != null && String(raw.coupon_code).trim()) {
    const v = await validateAndComputeCoupon(
      prisma,
      String(raw.coupon_code),
      couponContext,
      subtotal,
      { userId, guestEmail: null },
    );
    if ("error" in v) {
      return { ok: false, status: 400, error: v.error };
    }
    discountInr = v.discountInr;
  }

  const payableInr = Math.max(0, subtotal - discountInr);
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
  };
  if (raw.coupon_code != null && String(raw.coupon_code).trim()) {
    orderNotes.coupon_code = String(raw.coupon_code).trim();
  }
  return { ok: true, plan: { amount_inr, orderNotes, dbNotes: { ...orderNotes } } };
}

function planBookingOrder(userId: string, raw: Record<string, unknown>): PlanResult {
  const pendingBody = parsePendingBookingBody(raw.pending_checkout ?? raw);
  if (!pendingBody) {
    return { ok: false, status: 400, error: "Invalid booking checkout payload" };
  }
  const financeSnap = parseFinanceSnapshot(pendingBody.finance_snapshot);
  if (!financeSnap || !snapshotTotalsConsistent(financeSnap)) {
    return { ok: false, status: 400, error: "Invalid finance snapshot" };
  }
  const amount_paise = expectedBookingCheckoutPaise(financeSnap.totalInr);
  return {
    ok: true,
    plan: {
      amount_inr: amount_paise / 100,
      orderNotes: { user_id: userId, purpose: PURPOSE_BOOKING },
      dbNotes: { user_id: userId, purpose: PURPOSE_BOOKING, pending_checkout: pendingBody },
    },
  };
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
  if (raw.purpose === PURPOSE_BOOKING || raw.pending_checkout != null) return planBookingOrder(userId, raw);
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
        financeSnapshot: pending.finance_snapshot,
        email: bookerEmail,
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
    });

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
