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

const ALREADY_CAPTURED = /already been captured/i;

function razorpayErrorText(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  if (e && typeof e === "object") {
    const o = e as Record<string, unknown>;
    const nested = o.error as Record<string, unknown> | undefined;
    const d = nested?.description ?? o.description;
    if (typeof d === "string" && d.trim()) return d.trim();
  }
  return String(e);
}

/**
 * Capture an authorized Razorpay payment so funds actually settle to the merchant.
 *
 * Razorpay only debits the customer on **capture**. A payment left in `authorized`
 * (common for netbanking/UPI, which authorize asynchronously) auto-voids after the
 * account capture window (~5 days) — booking confirmed, money refunded, studio paid
 * nothing. We never set `payment_capture` on the order, so the app must capture itself.
 *
 * Idempotent: capturing an already-captured payment returns `captured` instead of
 * throwing, so this is safe to call alongside dashboard auto-capture.
 *
 * Returns the resulting status, or `null` if Razorpay isn't configured.
 */
export async function captureAuthorizedPayment(params: {
  razorpay: Razorpay;
  paymentId: string;
  amountPaise: number;
  currency?: string;
}): Promise<{ status: string }> {
  const currency = params.currency?.trim() || "INR";
  try {
    const captured = (await params.razorpay.payments.capture(
      params.paymentId,
      params.amountPaise,
      currency,
    )) as { status?: string | null };
    return {
      status:
        captured.status != null ? String(captured.status).toLowerCase() : "captured",
    };
  } catch (e) {
    if (ALREADY_CAPTURED.test(razorpayErrorText(e))) {
      return { status: "captured" };
    }
    throw e;
  }
}
