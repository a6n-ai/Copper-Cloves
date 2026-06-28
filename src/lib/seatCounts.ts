import prisma from "@/lib/prisma";
import { OCCUPYING_STATUSES, BOOKING_STATUS } from "@/lib/bookingStatus";
import logger from "@/lib/logger";

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Recompute a schedule's denormalized seat counters (`current_bookings` /
 * `available_spots`) from the live occupying rows. Authoritative + idempotent —
 * never drifts because it counts actual rows rather than incrementing. Shared by
 * every confirm/cancel/reconcile/capacity-edit path that changes seat occupancy.
 * Pass a tx client to run inside a transaction.
 */
export async function reconcileScheduleSeats(scheduleId: string, db: TxClient = prisma): Promise<void> {
  const sched = await db.classSchedule.findUnique({
    where: { id: scheduleId },
    include: { class_model: { select: { max_capacity: true } } },
  });
  if (!sched) return;
  const cap = sched.capacity ?? sched.class_model?.max_capacity ?? 0;
  if (cap <= 0) return;
  const rows = await db.booking.findMany({
    where: { class_schedule_id: scheduleId, status: { in: [...OCCUPYING_STATUSES] } },
    select: { extra_guest_count: true },
  });
  const seatsTaken = rows.reduce((s, r) => s + 1 + Math.max(0, r.extra_guest_count ?? 0), 0);
  await db.classSchedule.update({
    where: { id: scheduleId },
    data: { current_bookings: seatsTaken, available_spots: Math.max(0, cap - seatsTaken) },
  });
}

/**
 * After a booker's booking is confirmed via a status-flip-only path (admin
 * import/fulfill reconcile), confirm the up-front group rows held under that
 * booker (they mirror the booker and carry no payment of their own) and
 * recompute seat counters. Best-effort — never throws.
 */
export async function reconcileConfirmedBookingSideEffects(
  bookingId: string,
  userId: string,
): Promise<void> {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { class_schedule_id: true },
    });
    if (!booking?.class_schedule_id) return;

    await prisma.booking.updateMany({
      where: {
        invited_by_user_id: userId,
        class_schedule_id: booking.class_schedule_id,
        status: { in: [BOOKING_STATUS.payment_pending, BOOKING_STATUS.expired] },
      },
      data: { status: BOOKING_STATUS.confirmed, hold_expires_at: null },
    });

    await reconcileScheduleSeats(booking.class_schedule_id);
  } catch (err) {
    logger.error({ err, bookingId }, "[reconcileConfirmedBookingSideEffects] failed");
  }
}
