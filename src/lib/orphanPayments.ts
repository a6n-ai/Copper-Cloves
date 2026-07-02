/**
 * Orphan-payment healing.
 *
 * Booking-first checkout pre-links Razorpay order A to a `payment_pending`
 * booking, but Razorpay Checkout sometimes captures against a different order
 * (retry/duplicate-tab race). The capture still persists as a `Payment` row
 * (status succeeded, direction credit) via the normal verify/webhook path, but
 * with `booking_id = null` because it isn't the order the booking expected —
 * an "orphan payment". The lifecycle sweep only checks the booking's own
 * linked order, so it never sees this payment and expires the (paid) booking.
 *
 * This module finds a *unique* matching orphan payment for a stuck booking
 * (same user, same amount, created in the booking's hold window), verifies it
 * against Razorpay directly (never trusts amount/timing alone), and links it.
 * Ambiguous matches (0 or ≥2 candidates) are never guessed — left for admin.
 */
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getRazorpay, razorpayConfigured } from "@/lib/razorpayServer";
import { BOOKING_STATUS } from "@/lib/bookingStatus";
import { reconcileScheduleSeats } from "@/lib/seatCounts";
import { logActivity } from "@/lib/activityLog";

const log = logger.child({ module: "orphanPayments" });

/** Sentinel thrown inside the heal transaction to force rollback on a lost race (never surfaced). */
class ConcurrentHealError extends Error {}

/** Small buffer before booking creation to tolerate clock skew / near-simultaneous capture. */
const LOOKBACK_BUFFER_MS = 10 * 60 * 1000;

export type OrphanPayment = {
  id: string;
  razorpay_payment_id: string | null;
  amount_paise: number;
};

/**
 * Returns the single element if `candidates` has exactly one, else null.
 * Never guesses between multiple ambiguous matches. Pure/unit-testable.
 */
export function pickUniqueOrphanMatch<T>(candidates: T[]): T | null {
  return candidates.length === 1 ? candidates[0] : null;
}

export async function findOrphanPaymentForBooking(args: {
  userId: string;
  amountPaise: number;
  bookingCreatedAt: Date;
  now: Date;
}): Promise<OrphanPayment | null> {
  const { userId, amountPaise, bookingCreatedAt, now } = args;
  const windowStart = new Date(bookingCreatedAt.getTime() - LOOKBACK_BUFFER_MS);

  const candidates = await prisma.payment.findMany({
    where: {
      status: "succeeded",
      direction: "credit",
      booking_id: null,
      user_package_id: null,
      method: { in: ["razorpay_online", "razorpay_completed"] },
      user_id: userId,
      amount_paise: amountPaise,
      created_at: { gte: windowStart, lte: now },
    },
    select: { id: true, razorpay_payment_id: true, amount_paise: true },
  });

  return pickUniqueOrphanMatch(candidates);
}

/**
 * Verify a captured Payment row is genuinely captured at Razorpay (not just
 * HMAC-verified locally). Falls back to trusting the row (already-verified)
 * if Razorpay isn't configured or the fetch fails — logged as a warning.
 */
export async function verifyRazorpayCaptured(razorpayPaymentId: string | null): Promise<boolean> {
  if (!razorpayConfigured() || !razorpayPaymentId) {
    log.warn({ razorpayPaymentId }, "orphan heal: skipping live Razorpay verify, trusting persisted payment");
    return true;
  }
  try {
    const payment = (await getRazorpay().payments.fetch(razorpayPaymentId)) as { status?: string | null };
    return payment.status === "captured";
  } catch (err) {
    log.warn({ err, razorpayPaymentId }, "orphan heal: Razorpay verify fetch failed, trusting persisted payment");
    return true;
  }
}

export type HealResult = { healed: boolean; reason?: string };

/**
 * Attempt to heal one stuck booking (`payment_pending` or `expired`) by
 * finding a unique orphan payment that matches its amount/window, verifying
 * it against Razorpay, then linking payment→booking and confirming the
 * booking in a single guarded transaction.
 */
export async function healBookingFromOrphan(bookingId: string): Promise<HealResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      user_id: true,
      created_at: true,
      class_schedule_id: true,
      class_name: true,
      razorpay_order: { select: { amount_paise: true } },
    },
  });
  if (!booking) return { healed: false, reason: "booking_not_found" };
  if (booking.status !== BOOKING_STATUS.payment_pending && booking.status !== BOOKING_STATUS.expired) {
    return { healed: false, reason: "not_stuck" };
  }

  const amountPaise = booking.razorpay_order?.amount_paise;
  if (amountPaise == null) return { healed: false, reason: "no_order_amount" };

  const now = new Date();
  const orphan = await findOrphanPaymentForBooking({
    userId: booking.user_id,
    amountPaise,
    bookingCreatedAt: booking.created_at,
    now,
  });
  if (!orphan) return { healed: false, reason: "no_unique_orphan" };

  const captured = await verifyRazorpayCaptured(orphan.razorpay_payment_id);
  if (!captured) return { healed: false, reason: "not_captured_in_razorpay" };

  try {
    await prisma.$transaction(async (tx) => {
      const linkResult = await tx.payment.updateMany({
        where: { id: orphan.id, booking_id: null },
        data: { booking_id: bookingId },
      });
      if (linkResult.count === 0) throw new ConcurrentHealError();

      const confirmResult = await tx.booking.updateMany({
        where: { id: bookingId, status: { in: [BOOKING_STATUS.payment_pending, BOOKING_STATUS.expired] } },
        data: { status: BOOKING_STATUS.confirmed, hold_expires_at: null },
      });
      if (confirmResult.count === 0) throw new ConcurrentHealError();
    });
  } catch (err) {
    if (err instanceof ConcurrentHealError) return { healed: false, reason: "concurrent_update" };
    throw err;
  }

  if (booking.class_schedule_id) {
    await reconcileScheduleSeats(booking.class_schedule_id).catch((err) => {
      log.error({ err, bookingId }, "orphan heal: reconcileScheduleSeats failed");
    });
  }

  await logActivity({
    actor: { role: "system", name: "System" },
    action: "booking.healed_from_orphan",
    targetProfileId: booking.user_id,
    entity: { type: "booking", id: bookingId },
    metadata: {
      class_name: booking.class_name ?? undefined,
      orphan_payment_id: orphan.id,
      changes: [{ field: "status", from: booking.status, to: "confirmed" }],
    },
  }).catch(() => {});

  return { healed: true };
}

export type SweepResult = { scanned: number; healed: number; ambiguous: number; errors: number };

/**
 * Sweep stuck bookings (payment_pending or expired) that have a linked
 * Razorpay order, attempting to heal each from an orphan payment.
 */
export async function sweepOrphanHeal(opts?: { limit?: number }): Promise<SweepResult> {
  const limit = opts?.limit ?? 300;
  const result: SweepResult = { scanned: 0, healed: 0, ambiguous: 0, errors: 0 };

  const bookings = await prisma.booking.findMany({
    where: {
      status: { in: [BOOKING_STATUS.payment_pending, BOOKING_STATUS.expired] },
      razorpay_order: { isNot: null },
    },
    select: { id: true },
    orderBy: { created_at: "desc" },
    take: limit,
  });

  for (const b of bookings) {
    result.scanned += 1;
    try {
      const outcome = await healBookingFromOrphan(b.id);
      if (outcome.healed) {
        result.healed += 1;
      } else if (outcome.reason === "no_unique_orphan") {
        result.ambiguous += 1;
      }
    } catch (err) {
      result.errors += 1;
      log.error({ err, bookingId: b.id }, "sweepOrphanHeal: heal step failed");
    }
  }

  log.info(result, "sweepOrphanHeal complete");
  return result;
}
