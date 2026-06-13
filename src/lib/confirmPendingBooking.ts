import type { Prisma } from "@/generated/prisma/client";
import { BOOKING_STATUS } from "@/lib/bookingStatus";

export type ConfirmResult = { bookingId: string; transitioned: boolean };

/**
 * Confirm the pending booking linked to a paid order. Idempotent:
 * - payment_pending (or expired) → confirmed (transitioned=true; caller sends email)
 * - already confirmed → no-op (transitioned=false)
 * Clears the hold timer. Caller links the Payment row separately.
 */
export async function confirmPendingBookingTx(
  tx: Prisma.TransactionClient,
  bookingId: string,
  financeSnapshot?: unknown,
): Promise<ConfirmResult> {
  const booking = await tx.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, status: true },
  });
  if (!booking) throw new Error("PENDING_BOOKING_NOT_FOUND");
  if (booking.status === BOOKING_STATUS.confirmed) {
    return { bookingId: booking.id, transitioned: false };
  }
  if (booking.status !== BOOKING_STATUS.payment_pending && booking.status !== BOOKING_STATUS.expired) {
    throw new Error("PENDING_BOOKING_BAD_STATE:" + booking.status);
  }
  await tx.booking.update({
    where: { id: booking.id },
    data: {
      status: BOOKING_STATUS.confirmed,
      hold_expires_at: null,
      ...(financeSnapshot != null ? { finance_snapshot: financeSnapshot as object } : {}),
    },
  });
  return { bookingId: booking.id, transitioned: true };
}
