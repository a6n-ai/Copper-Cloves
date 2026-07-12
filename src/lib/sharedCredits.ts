/**
 * Friends & Family shared-credit cap math. Pure — no DB. The single source of
 * truth for how many pass credits an owner may share and whether a specific
 * share request is allowed. Reserve-at-share model: a share can never draw more
 * than the pass's current remaining credits, and lifetime shares from one pass
 * are capped at floor(maxSharedPercent/100 * credits_total).
 */
export const SHARE_PERCENT_MIN = 75;
export const SHARE_PERCENT_MAX = 100;

export type ShareDenyReason =
  | "INVALID_AMOUNT"
  | "UNLIMITED_NOT_SHAREABLE"
  | "INSUFFICIENT_CREDITS"
  | "CAP_EXCEEDED";

/** Max lifetime credits shareable from one pass. Unlimited/none => 0. */
export function maxShareableCredits(creditsTotal: number | null, maxSharedPercent: number): number {
  if (creditsTotal == null || creditsTotal <= 0) return 0;
  return Math.floor((maxSharedPercent / 100) * creditsTotal);
}

export function canShare(input: {
  creditsTotal: number | null;
  creditsRemaining: number;
  alreadyShared: number;
  requested: number;
  maxSharedPercent: number;
}): { ok: boolean; reason?: ShareDenyReason } {
  const { creditsTotal, creditsRemaining, alreadyShared, requested, maxSharedPercent } = input;
  if (!Number.isInteger(requested) || requested < 1) return { ok: false, reason: "INVALID_AMOUNT" };
  if (creditsTotal == null || creditsTotal <= 0) return { ok: false, reason: "UNLIMITED_NOT_SHAREABLE" };
  if (requested > creditsRemaining) return { ok: false, reason: "INSUFFICIENT_CREDITS" };
  if (alreadyShared + requested > maxShareableCredits(creditsTotal, maxSharedPercent)) {
    return { ok: false, reason: "CAP_EXCEEDED" };
  }
  return { ok: true };
}
