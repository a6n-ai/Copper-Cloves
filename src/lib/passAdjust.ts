export function computeUpgradeDifferencePaise(currentPriceInr: number, targetPriceInr: number): number {
  const diffInr = targetPriceInr - currentPriceInr;
  if (diffInr <= 0) return 0;
  return Math.round(diffInr * 100);
}

export function validateCreditAdjust(
  input: { credits: number; isUnlimited: boolean },
): { ok: true } | { ok: false; error: string } {
  if (input.isUnlimited) {
    return { ok: false, error: "Unlimited passes have no credit balance to adjust" };
  }
  if (!Number.isInteger(input.credits) || input.credits < 0) {
    return { ok: false, error: "Credits must be a whole number, zero or more" };
  }
  return { ok: true };
}
