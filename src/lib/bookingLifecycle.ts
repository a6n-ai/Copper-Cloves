/**
 * Lifecycle timing for gateway-paid payment_pending bookings.
 *
 * t=0            booking created, seat held, hold_expires_at = created_at + HOLD_MINUTES
 * t≈20–40m       recovery email ("complete your payment / reconcile if paid"), once
 * t=HOLD_MINUTES seat released (after Razorpay confirms no capture)
 */
export const HOLD_MINUTES = 60;
export const RECOVERY_EMAIL_MIN_AGE_MINUTES = 20;

export type PendingBookingTiming = {
  created_at: Date;
  hold_expires_at: Date | null;
  recovery_email_sent_at: Date | null;
};

export type LifecycleAction = "none" | "send_email" | "release";

/**
 * Decide what the lifecycle cron should do with one pending booking at `now`.
 * Release takes priority over email. Pure — no I/O.
 */
export function classifyPendingBooking(
  b: PendingBookingTiming,
  now: Date,
): LifecycleAction {
  const holdExpiry =
    b.hold_expires_at ?? new Date(b.created_at.getTime() + HOLD_MINUTES * 60_000);
  if (now >= holdExpiry) return "release";

  const ageMinutes = (now.getTime() - b.created_at.getTime()) / 60_000;
  if (ageMinutes >= RECOVERY_EMAIL_MIN_AGE_MINUTES && b.recovery_email_sent_at == null) {
    return "send_email";
  }
  return "none";
}
