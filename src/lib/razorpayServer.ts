import Razorpay from "razorpay";

export function razorpayConfigured(): boolean {
  return Boolean(
    process.env.RAZORPAY_KEY_ID?.trim() && process.env.RAZORPAY_KEY_SECRET?.trim(),
  );
}

/** Server-only Razorpay client (never import in client bundles). */
export function getRazorpay(): Razorpay {
  const key_id = process.env.RAZORPAY_KEY_ID?.trim();
  const key_secret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!key_id || !key_secret) {
    throw new Error("RAZORPAY_MISSING_CONFIG");
  }
  return new Razorpay({ key_id, key_secret });
}
