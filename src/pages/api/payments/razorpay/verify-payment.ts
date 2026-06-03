import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "node:crypto";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import {
  ensureRazorpayOrderRowForUser,
  persistVerifiedRazorpayPayment,
} from "@/lib/razorpayPersistence";
import { captureAuthorizedPayment, getRazorpay, razorpayConfigured } from "@/lib/razorpayServer";
import { requestLogger } from "@/lib/logger";

/**
 * POST { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 * Validates HMAC from Razorpay Checkout success callback.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const log = requestLogger(req, res);
  if (req.method !== "POST") return res.status(405).end();

  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  const userId = (session.user as { id: string }).id;

  const secret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!secret) {
    return res.status(503).json({ error: "RAZORPAY_KEY_SECRET is not configured." });
  }
  if (!razorpayConfigured()) {
    return res.status(503).json({ error: "Razorpay is not fully configured." });
  }

  const body = req.body as {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };
  const orderId =
    typeof body.razorpay_order_id === "string" ? body.razorpay_order_id.trim() : "";
  const paymentId =
    typeof body.razorpay_payment_id === "string" ? body.razorpay_payment_id.trim() : "";
  const signature =
    typeof body.razorpay_signature === "string" ? body.razorpay_signature.trim() : "";

  if (!orderId || !paymentId || !signature) {
    return res.status(400).json({ error: "Missing payment verification fields." });
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  if (expected.length !== signature.length) {
    return res.status(400).json({ error: "Invalid signature." });
  }
  let ok = false;
  try {
    ok = crypto.timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(signature, "utf8"));
  } catch {
    ok = false;
  }
  if (!ok) {
    log.warn({ userId, orderId, paymentId }, "razorpay verify invalid signature");
    return res.status(400).json({ error: "Invalid signature." });
  }

  try {
    const razorpay = getRazorpay();
    await ensureRazorpayOrderRowForUser({ userId, razorpayOrderId: orderId, razorpay });

    const payment = (await razorpay.payments.fetch(paymentId)) as {
      order_id?: string | null;
      status?: string | null;
      amount?: number | string | null;
      currency?: string | null;
      method?: string | null;
    };

    const paymentOrderId = payment.order_id != null ? String(payment.order_id).trim() : "";
    if (!paymentOrderId || paymentOrderId !== orderId) {
      return res.status(400).json({ error: "Payment does not belong to this order." });
    }

    const status = payment.status != null ? String(payment.status).toLowerCase() : "";
    if (!["captured", "authorized"].includes(status)) {
      return res.status(400).json({
        error: `Payment is not complete (status: ${payment.status ?? "unknown"}).`,
      });
    }

    // Authorized funds are only blocked, not debited — capture so they settle to the
    // studio. Without this, netbanking/UPI payments auto-void after the capture window.
    if (status === "authorized") {
      try {
        const result = await captureAuthorizedPayment({
          razorpay,
          paymentId,
          amountPaise: Math.round(Number(payment.amount ?? 0)),
          currency: payment.currency != null ? String(payment.currency) : "INR",
        });
        payment.status = result.status;
      } catch (capErr) {
        // Dashboard auto-capture is the backstop; surface so it can be reconciled.
        log.error({ err: capErr, userId, orderId, paymentId }, "razorpay capture failed");
      }
    }

    await persistVerifiedRazorpayPayment({
      userId,
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      payment,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "ORDER_USER_MISMATCH") {
      return res.status(403).json({ error: "Order does not belong to this account." });
    }
    log.error({ err: e, userId, orderId, paymentId }, "razorpay verify-payment failed");
    return res.status(502).json({ error: "Could not confirm payment with Razorpay." });
  }

  log.info({ userId, orderId, paymentId }, "razorpay payment verified");
  return res.json({ ok: true, razorpay_order_id: orderId, razorpay_payment_id: paymentId });
}
