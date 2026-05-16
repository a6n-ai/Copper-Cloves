import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "node:crypto";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { persistRazorpayOrderOnCreate } from "@/lib/razorpayPersistence";
import { getRazorpay, razorpayConfigured } from "@/lib/razorpayServer";

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
 * POST { amount_inr: number } — creates a Razorpay Order (amount in INR, minimum ₹1).
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

  const bodyAmount = (req.body as { amount_inr?: unknown })?.amount_inr;
  if (bodyAmount === undefined || bodyAmount === null || bodyAmount === "") {
    return res.status(400).json({ error: "amount_inr is required" });
  }
  const rawAmount = Number(bodyAmount);
  if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
    return res.status(400).json({ error: "Invalid amount_inr" });
  }

  const amount_inr = Math.min(Math.max(rawAmount, 1), 100_000);
  const amount_paise = Math.round(amount_inr * 100);

  try {
    const razorpay = getRazorpay();
    const userId = (session.user as { id: string }).id;
    const receipt = buildOrderReceipt(userId);

    const order = await razorpay.orders.create({
      amount: amount_paise,
      currency: "INR",
      receipt,
      notes: { user_id: userId },
    });

    const notes =
      order.notes != null && typeof order.notes === "object"
        ? (order.notes as Record<string, unknown>)
        : null;
    try {
      await persistRazorpayOrderOnCreate({
        userId,
        razorpayOrderId: order.id,
        amountPaise: Number(order.amount),
        currency: order.currency ?? "INR",
        receipt,
        notes,
      });
    } catch (dbErr) {
      console.error("[razorpay/create-order] persist order row", dbErr);
    }

    const keyId =
      process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim() || process.env.RAZORPAY_KEY_ID?.trim();
    return res.status(200).json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: keyId,
    });
  } catch (e: unknown) {
    console.error("[razorpay/create-order]", e);
    const msg = razorpayFailureMessage(e);
    return res.status(502).json({ error: msg });
  }
}
