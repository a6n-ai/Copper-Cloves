import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Razorpay `callback_url` target — accepts POST (form) or GET, then redirects to the
 * portal page that verifies payment and completes booking/package checkout.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const purpose =
    typeof req.query.purpose === "string" && req.query.purpose === "package"
      ? "package"
      : "booking";

  const body = (req.method === "POST" ? req.body : req.query) as Record<string, unknown>;
  const razorpay_payment_id = String(body.razorpay_payment_id ?? "").trim();
  const razorpay_order_id = String(body.razorpay_order_id ?? "").trim();
  const razorpay_signature = String(body.razorpay_signature ?? "").trim();

  const qs = new URLSearchParams();
  if (razorpay_payment_id) qs.set("razorpay_payment_id", razorpay_payment_id);
  if (razorpay_order_id) qs.set("razorpay_order_id", razorpay_order_id);
  if (razorpay_signature) qs.set("razorpay_signature", razorpay_signature);
  qs.set("purpose", purpose);

  const target = `/portal/payment/razorpay-return?${qs.toString()}`;
  res.redirect(307, target);
}
