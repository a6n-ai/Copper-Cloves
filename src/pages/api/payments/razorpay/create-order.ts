import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "node:crypto";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { getRazorpay, razorpayConfigured } from "@/lib/razorpayServer";

/**
 * POST { amount_inr?: number } — creates a Razorpay Order (amount in INR, minimum ₹1).
 * Returns order id + key id for opening Razorpay Checkout on the client.
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

  const rawAmount = Number((req.body as { amount_inr?: unknown })?.amount_inr ?? 100);
  if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
    return res.status(400).json({ error: "Invalid amount_inr" });
  }

  const amount_inr = Math.min(Math.max(rawAmount, 1), 100_000);
  const amount_paise = Math.round(amount_inr * 100);

  try {
    const razorpay = getRazorpay();
    const userId = (session.user as { id: string }).id;
    const receipt = crypto.randomUUID().slice(0, 40);

    const order = await razorpay.orders.create({
      amount: amount_paise,
      currency: "INR",
      receipt: `${userId.slice(0, 8)}_${receipt}`,
      notes: { user_id: userId },
    });

    const keyId =
      process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim() || process.env.RAZORPAY_KEY_ID?.trim();
    return res.status(200).json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: keyId,
    });
  } catch (e) {
    console.error("[razorpay/create-order]", e);
    const msg = e instanceof Error ? e.message : "Razorpay error";
    return res.status(502).json({ error: msg });
  }
}
