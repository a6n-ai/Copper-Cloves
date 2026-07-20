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
  | "INSUFFICIENT_CREDITS";

/** Max lifetime credits shareable from one pass. Unlimited/none => 0. */
export function maxShareableCredits(creditsTotal: number | null, maxSharedPercent: number): number {
  if (creditsTotal == null || creditsTotal <= 0) return 0;
  return Math.floor((maxSharedPercent / 100) * creditsTotal);
}

/**
 * Sharing is capped by the pass's CURRENT remaining credits. Because a grant
 * decrements `credits_remaining` at share time (reserve-at-share), "remaining"
 * is inherently the running cap — no separate lifetime/percentage bookkeeping
 * is needed. `maxShareableCredits` is retained for the admin settings copy only.
 */
export function canShare(input: {
  creditsTotal: number | null;
  creditsRemaining: number;
  requested: number;
}): { ok: boolean; reason?: ShareDenyReason } {
  const { creditsTotal, creditsRemaining, requested } = input;
  if (!Number.isInteger(requested) || requested < 1) return { ok: false, reason: "INVALID_AMOUNT" };
  if (creditsTotal == null || creditsTotal <= 0) return { ok: false, reason: "UNLIMITED_NOT_SHAREABLE" };
  if (requested > creditsRemaining) return { ok: false, reason: "INSUFFICIENT_CREDITS" };
  return { ok: true };
}
