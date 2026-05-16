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
import prisma from "@/lib/prisma";
import { validateAndComputeCoupon, toFiniteNumber, type CouponContext } from "@/lib/couponHelpers";

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

function razorpayFailureMessage(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  if (e && typeof e === "object") {
    const o = e as Record<string, unknown>;
    const nested = o.error as Record<string, unknown> | undefined;
    const desc = nested?.description ?? o.description;
    if (typeof desc === "string" && desc.trim()) return desc.trim();
    const msg = nested?.message ?? o.message;
    if (typeof msg === "string" && msg.trim()) return msg.trim();
    const reason = nested?.reason ?? o.reason;
    if (typeof reason === "string" && reason.trim()) return reason.trim();
    const code = nested?.code ?? o.code;
    if (code !== undefined && String(code).trim())
      return `Razorpay error (code ${typeof code === "object" ? JSON.stringify(code) : String(code)})`;
  }
  return "Razorpay error";
}

/**
 * POST
 * - `{ purpose: "booking", pending_checkout }` — class booking (amount derived from finance snapshot).
 * - `{ amount_inr: number }` — legacy generic amount-only checkout.
 * - `{ purpose: "package", package_type_id, pass_type?, coupon_code? }` — server-priced package
 *   checkout for /portal/packages (coupon applied server-side; client must not set amount).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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

  let amount_inr: number;
  let orderNotes: Record<string, string> = { user_id: userId };
  let dbNotes!: Record<string, unknown>;

  if (raw.purpose === "package") {
    const packageTypeId =
      typeof raw.package_type_id === "string" ? raw.package_type_id.trim() : "";
    if (!packageTypeId) {
      return res.status(400).json({ error: "package_type_id is required for package checkout" });
    }
    const passRaw = typeof raw.pass_type === "string" ? raw.pass_type.trim() : "class_pass";
    const pass = passRaw === "studio_pass" ? "studio_pass" : "class_pass";
    const couponContext: CouponContext = pass === "studio_pass" ? "studio_pass" : "class_pass";

    const packageType = await prisma.packageType.findUnique({
      where: { id: packageTypeId },
    });
    if (!packageType) {
      return res.status(404).json({ error: "Package not found" });
    }

    const subtotal = toFiniteNumber(packageType.price);
    if (!Number.isFinite(subtotal) || subtotal <= 0) {
      return res.status(400).json({ error: "Invalid package price" });
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
        return res.status(400).json({ error: v.error });
      }
      discountInr = v.discountInr;
    }

    const payableInr = Math.max(0, subtotal - discountInr);
    if (payableInr <= 0) {
      return res.status(400).json({
        error: "No payment due for this cart. Complete purchase without checkout.",
      });
    }

    amount_inr = Math.min(Math.max(Math.round(payableInr), 1), 100_000);
    orderNotes = {
      ...orderNotes,
      purpose: "package",
      package_type_id: packageTypeId,
      pass_type: pass,
    };
    if (raw.coupon_code != null && String(raw.coupon_code).trim()) {
      orderNotes.coupon_code = String(raw.coupon_code).trim();
    }
    dbNotes = { ...orderNotes };
  } else if (raw.purpose === "booking" || raw.pending_checkout != null) {
    const pendingBody = parsePendingBookingBody(raw.pending_checkout ?? raw);
    if (!pendingBody) {
      return res.status(400).json({ error: "Invalid booking checkout payload" });
    }
    const financeSnap = parseFinanceSnapshot(pendingBody.finance_snapshot);
    if (!financeSnap || !snapshotTotalsConsistent(financeSnap)) {
      return res.status(400).json({ error: "Invalid finance snapshot" });
    }
    const amount_paise = expectedBookingCheckoutPaise(financeSnap.totalInr);
    amount_inr = amount_paise / 100;
    orderNotes = { ...orderNotes, purpose: "booking" };
    dbNotes = {
      user_id: userId,
      purpose: "booking",
      pending_checkout: pendingBody,
    };
  } else {
    const bodyAmount = raw.amount_inr;
    if (bodyAmount === undefined || bodyAmount === null || bodyAmount === "") {
      return res.status(400).json({ error: "amount_inr is required" });
    }
    const ra = Number(bodyAmount);
    if (!Number.isFinite(ra) || ra <= 0) {
      return res.status(400).json({ error: "Invalid amount_inr" });
    }
    amount_inr = Math.min(Math.max(ra, 1), 100_000);
    dbNotes = { user_id: userId };
  }

  const amount_paise = Math.round(amount_inr * 100);

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
      });
    } catch (dbErr) {
      console.error("[razorpay/create-order] persist order row", dbErr);
    }

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
    console.error("[razorpay/create-order]", e);
    const msg = razorpayFailureMessage(e);
    return res.status(502).json({ error: msg });
  }
}
