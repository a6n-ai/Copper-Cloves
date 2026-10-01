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

// Upgrade keeps the original term: extend the current expiry by the month
// difference (6→12 adds 6, not 12). A pass with no month duration counts as 0,
// so its remaining validity carries over plus the full target term. An already
// lapsed expiry starts from now. Returns null when the target has no duration.
export function computeUpgradeExpiry(
  currentExpiry: Date | null,
  currentMonths: number | null,
  targetMonths: number | null,
  now: Date = new Date(),
): Date | null {
  if (!targetMonths || targetMonths <= 0) return null;
  const base = currentExpiry && currentExpiry.getTime() > now.getTime() ? currentExpiry : now;
  const out = new Date(base);
  out.setMonth(out.getMonth() + Math.max(0, targetMonths - (currentMonths ?? 0)));
  return out;
}
