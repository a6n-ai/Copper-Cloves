import type { NextApiRequest, NextApiResponse } from "next";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import {
  razorpayCheckoutModeBanner,
  razorpayKeyMode,
  razorpayKeysMismatch,
} from "@/lib/razorpayClientHints";
import { razorpayConfigured } from "@/lib/razorpayServer";

/**
 * GET — Safe Razorpay config summary (no secrets). Use to confirm test vs live before paying.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  const configured = razorpayConfigured();
  const serverKeyId = process.env.RAZORPAY_KEY_ID?.trim() ?? "";
  const publicKeyId =
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim() || serverKeyId;
  const mode = razorpayKeyMode(publicKeyId || serverKeyId);
  const keyMismatch = razorpayKeysMismatch(serverKeyId, publicKeyId);
  const keyPrefix = (publicKeyId || serverKeyId).slice(0, 16);

  return res.status(200).json({
    configured,
    mode,
    key_mismatch: keyMismatch,
    key_id_prefix: keyPrefix ? `${keyPrefix}…` : null,
    checkout_hint: razorpayCheckoutModeBanner(publicKeyId || serverKeyId),
    webhook_secret_set: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET?.trim()),
    will_work_on_live:
      configured &&
      !keyMismatch &&
      mode === "live" &&
      "Yes — use a real Indian debit/credit card (test cards are rejected on live keys).",
    will_work_in_test:
      configured &&
      !keyMismatch &&
      mode === "test" &&
      "Yes — use card 4111 1111 1111 1111 or UPI success@razorpay.",
  });
}
