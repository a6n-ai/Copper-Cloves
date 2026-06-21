import prisma from "@/lib/prisma";
import { OCCUPYING_STATUSES } from "@/lib/bookingStatus";

/**
 * Recompute a schedule's denormalized seat counters (`current_bookings` /
 * `available_spots`) from the live occupying rows. Authoritative + idempotent —
 * never drifts because it counts actual rows rather than incrementing. Shared by
 * every confirm/cancel/reconcile path that changes seat occupancy.
 */
export async function reconcileScheduleSeats(scheduleId: string): Promise<void> {
  const sched = await prisma.classSchedule.findUnique({
    where: { id: scheduleId },
    include: { class_model: { select: { max_capacity: true } } },
  });
  if (!sched) return;
  const cap = sched.capacity ?? sched.class_model?.max_capacity ?? 0;
  if (cap <= 0) return;
  const rows = await prisma.booking.findMany({
    where: { class_schedule_id: scheduleId, status: { in: [...OCCUPYING_STATUSES] } },
    select: { extra_guest_count: true },
  });
  const seatsTaken = rows.reduce((s, r) => s + 1 + Math.max(0, r.extra_guest_count ?? 0), 0);
  await prisma.classSchedule.update({
    where: { id: scheduleId },
    data: { current_bookings: seatsTaken, available_spots: Math.max(0, cap - seatsTaken) },
  });
}
