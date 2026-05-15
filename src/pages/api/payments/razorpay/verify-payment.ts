import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "node:crypto";
import { getStudioServerSession } from "@/lib/getStudioServerSession";

/**
 * POST { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 * Validates HMAC from Razorpay Checkout success callback.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  const secret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!secret) {
    return res.status(503).json({ error: "RAZORPAY_KEY_SECRET is not configured." });
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
    return res.status(400).json({ error: "Invalid signature." });
  }

  return res.json({ ok: true, razorpay_order_id: orderId, razorpay_payment_id: paymentId });
}
