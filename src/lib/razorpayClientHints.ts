/** Browser-safe Razorpay key mode + user-facing payment hints (no secrets). */

export type RazorpayKeyMode = "test" | "live" | "unknown";

export function razorpayKeyMode(keyId: string | null | undefined): RazorpayKeyMode {
  const k = keyId?.trim() ?? "";
  if (k.startsWith("rzp_test_")) return "test";
  if (k.startsWith("rzp_live_")) return "live";
  return "unknown";
}

export function razorpayKeysMismatch(
  serverKeyId: string | null | undefined,
  publicKeyId: string | null | undefined,
): boolean {
  const a = razorpayKeyMode(serverKeyId);
  const b = razorpayKeyMode(publicKeyId);
  if (a === "unknown" || b === "unknown") return false;
  return a !== b;
}

const TEST_CARD_HINT =
  "Test mode: use card 4111 1111 1111 1111, any future expiry, any CVV — or UPI success@razorpay (no real OTP).";

const LIVE_CARD_HINT =
  "Live mode: use a real Indian debit/credit card. Test cards (4111…) only work with rzp_test_ keys.";

/** Turn Razorpay `card_number_invalid` and similar into actionable copy. */
export function razorpayPaymentErrorHelp(
  rawMessage: string,
  keyId: string | null | undefined,
  serverMode?: RazorpayKeyMode,
): string {
  const mode = serverMode ?? razorpayKeyMode(keyId);
  const low = rawMessage.toLowerCase();

  if (low.includes("card_number_invalid") || low.includes("card number is invalid")) {
    if (mode === "live") {
      return `${rawMessage}\n\n${LIVE_CARD_HINT}\n\nYour app is using LIVE Razorpay keys (rzp_live_). The test card 4111… cannot be used. Either pay with a real card or switch env to rzp_test_ keys for sandbox testing.`;
    }
    if (mode === "unknown") {
      return `${rawMessage}\n\n${TEST_CARD_HINT}\n\nCould not detect key mode — check RAZORPAY_KEY_ID starts with rzp_test_ or rzp_live_.`;
    }
    return `${rawMessage}\n\n${TEST_CARD_HINT}`;
  }

  if (mode === "test" && (low.includes("international") || low.includes("not supported"))) {
    return `${rawMessage}\n\n${TEST_CARD_HINT}`;
  }

  if (mode === "test") {
    return `${rawMessage}\n\n${TEST_CARD_HINT}`;
  }

  return rawMessage;
}

export function razorpayCheckoutModeBanner(keyId: string | null | undefined): string | null {
  const mode = razorpayKeyMode(keyId);
  if (mode === "test") return TEST_CARD_HINT;
  if (mode === "live") return "Payments are in live mode — real cards will be charged.";
  return null;
}
