/** Browser-only helpers for Razorpay Hosted Checkout (script loader + modal). */

import { razorpayKeyMode } from "@/lib/razorpayClientHints";

export type RazorpaySuccessPayload = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

/** Resolved outcome — avoids throwing on user dismiss / gateway failure (no Next.js error overlay). */
export type RazorpayOrderPayResult =
  | { kind: "success"; payload: RazorpaySuccessPayload }
  /** Browser navigated away to complete payment; finish on `callback_url` return page. */
  | { kind: "redirect" }
  | { kind: "cancelled" }
  | { kind: "failed"; message: string };

type RazorpayPrefill = { email?: string; contact?: string; name?: string };

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (arg: unknown) => void) => void;
    };
  }
}

/** Razorpay `payment.failed` payloads vary; extract everything useful for support/debug. */
function formatRazorpayPaymentFailure(raw: unknown): string {
  if (raw == null) return "Payment failed.";
  if (typeof raw !== "object") return String(raw);

  const r = raw as Record<string, unknown>;
  const err = r.error as Record<string, unknown> | undefined;
  if (err && typeof err === "object") {
    const bits: string[] = [];
    const d = err.description;
    const reason = err.reason;
    const code = err.code;
    const step = err.step;
    const source = err.source;
    if (typeof d === "string" && d.trim()) bits.push(d.trim());
    if (typeof reason === "string" && reason.trim()) bits.push(reason.trim());
    if (code !== undefined && code !== null && String(code).trim()) bits.push(`(${String(code)})`);
    if (typeof step === "string" && step.trim()) bits.push(`step: ${step.trim()}`);
    if (typeof source === "string" && source.trim()) bits.push(`source: ${source.trim()}`);
    if (bits.length) return bits.join(" ");
  }

  try {
    return JSON.stringify(raw);
  } catch {
    return "Payment failed.";
  }
}

export function loadRazorpayCheckoutScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Razorpay Checkout runs only in the browser."));
  }
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Could not load Razorpay Checkout.")),
        { once: true },
      );
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Razorpay Checkout."));
    document.body.appendChild(script);
  });
}

/**
 * Opens Razorpay Checkout for an Order API payment.
 * Returns `success` with payload for `/api/payments/razorpay/verify-payment`, or `cancelled` / `failed`
 * without rejecting (so the UI can show a retry dialog instead of a runtime error overlay).
 */
export async function payWithRazorpayOrder(options: {
  keyId: string;
  /** Amount in paise — must match the Razorpay Order amount. */
  amountPaise: number;
  currency: string;
  orderId: string;
  name: string;
  description: string;
  prefill?: RazorpayPrefill;
  /** Razorpay theme accent (hex, without relying on CSS variables). */
  themeColorHex?: string;
  /** Merchant return URL when Razorpay redirects (required for test pg_router / some methods). */
  callbackUrl?: string;
  /**
   * `false` = modal + `handler` (default). `true` = redirect back to `callbackUrl` with payment query params.
   */
  redirect?: boolean;
}): Promise<RazorpayOrderPayResult> {
  await loadRazorpayCheckoutScript();
  const Rzp = window.Razorpay;
  if (!Rzp) {
    throw new Error("Razorpay Checkout did not initialize.");
  }

  const useRedirect = options.redirect === true;
  const callbackUrl = options.callbackUrl?.trim() || undefined;
  const isTestKey = razorpayKeyMode(options.keyId) === "test";

  return new Promise((resolve, reject) => {
    let settled = false;

    // With `order_id`, amount is taken from the Order — omit `amount` to avoid mismatch errors.
    const checkoutOptions: Record<string, unknown> = {
      key: options.keyId,
      currency: options.currency,
      order_id: options.orderId,
      name: options.name,
      description: options.description,
      prefill: options.prefill ?? {},
      theme: { color: options.themeColorHex ?? "#8F9779" },
      redirect: useRedirect,
      handler(response: RazorpaySuccessPayload) {
        settled = true;
        resolve({ kind: "success", payload: response });
      },
      modal: {
        ondismiss() {
          if (!settled) {
            settled = true;
            resolve({ kind: useRedirect ? "redirect" : "cancelled" });
          }
        },
      },
    };

    if (callbackUrl) {
      checkoutOptions.callback_url = callbackUrl;
    }

    if (isTestKey) {
      checkoutOptions.config = {
        display: {
          preferences: { show_default_blocks: true },
        },
      };
    }

    const rzp = new Rzp(checkoutOptions);

    rzp.on("payment.failed", (raw: unknown) => {
      settled = true;
      if (process.env.NODE_ENV === "development") {
        console.warn("[razorpayCheckout] payment.failed", raw);
      }
      resolve({ kind: "failed", message: formatRazorpayPaymentFailure(raw) });
    });

    rzp.open();
  });
}
