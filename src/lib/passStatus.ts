// Shared pass-liveness + status logic. Mirrors the member portal (dashboard +
// packages page) so admin, portal, and any future surface agree on what
// "active" / "expiring" means for a UserPackage.

/** Days-to-expiry below which a still-active pass is flagged "expiring". */
export const EXPIRING_SOON_DAYS = 14;

export type PassStatus = "active" | "expiring" | "paused" | "expired";

/**
 * A pass is live when it's enabled, not past expiry, and still has credit.
 * Unlimited passes never deplete; a null expiry never expires.
 */
export function passIsActive(args: {
  isEnabled: boolean;
  isUnlimited: boolean;
  creditsRemaining: number | null;
  expiry: string | Date | null;
  now?: number;
}): boolean {
  const now = args.now ?? Date.now();
  const expMs = args.expiry ? new Date(args.expiry).getTime() : null;
  const notExpired = expMs == null || Number.isNaN(expMs) || expMs > now;
  const hasCredit = args.isUnlimited || (args.creditsRemaining ?? 0) > 0;
  return args.isEnabled && notExpired && hasCredit;
}

/** paused | expired | expiring | active — tones map via `memberStatusPill`. */
export function derivePassStatus(
  isActive: boolean,
  isPaused: boolean,
  expiry?: string | Date | null,
  now?: number,
): PassStatus {
  if (isPaused) return "paused";
  if (!isActive) return "expired";
  if (expiry) {
    const ms = new Date(expiry).getTime() - (now ?? Date.now());
    if (!Number.isNaN(ms)) {
      if (ms <= 0) return "expired";
      if (ms <= EXPIRING_SOON_DAYS * 86400000) return "expiring";
    }
  }
  return "active";
}

/** Ascending by expiry (soonest first); null expiry sorts last. */
export function byExpirySoonestFirst(
  a: { expiry: string | Date | null },
  b: { expiry: string | Date | null },
): number {
  const am = a.expiry ? new Date(a.expiry).getTime() : Infinity;
  const bm = b.expiry ? new Date(b.expiry).getTime() : Infinity;
  return am - bm;
}
