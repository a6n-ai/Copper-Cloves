import prisma from "@/lib/prisma";
import { BOOKING_STATUS, OCCUPYING_STATUSES } from "@/lib/bookingStatus";
import { HOLD_MINUTES } from "@/lib/bookingLifecycle";

export type PendingBookingInput = {
  userId: string;
  classScheduleId: string;
  className: string | null;
  classTimeISO: string;
  extraGuestCount: number;
  financeSnapshot: unknown;
  email: string | null;
  /** [{ name, email, phone }] booked alongside the booker; stored for the Finance detail dialog. */
  guestAttendees?: unknown;
  /** Count of existing-member profiles invited alongside the booker; each needs a seat. */
  addedMemberCount?: number;
  /** Profile ids of existing members invited alongside the booker. Each gets its
   *  own payment_pending booking row up-front (mirrors the booker's status) so the
   *  group is visible + lifecycle-bound during the hold. */
  addedMemberProfileIds?: string[];
};

/**
 * Reserve a seat by creating (or reusing) a payment_pending booking inside a transaction.
 * Capacity is enforced here so two members cannot both pay for the last seat.
 * Reuses an existing live pending booking for the same (user, schedule) so a repeated
 * book-click does not duplicate the hold. Throws ALREADY_BOOKED if already confirmed.
 */
export async function createPendingBooking(input: PendingBookingInput): Promise<string> {
  return prisma.$transaction(async (tx) => {
    // Serialize concurrent bookings on this schedule so two members can't both
    // take the last seat (read-then-insert race). Lock held until tx commit.
    await tx.$queryRaw`SELECT id FROM class_schedules WHERE id = ${input.classScheduleId} FOR UPDATE`;

    const existing = await tx.booking.findFirst({
      where: {
        user_id: input.userId,
        class_schedule_id: input.classScheduleId,
        status: { in: [BOOKING_STATUS.payment_pending, BOOKING_STATUS.confirmed] },
      },
      select: { id: true, status: true },
    });
    if (existing) {
      if (existing.status === BOOKING_STATUS.confirmed) throw new Error("ALREADY_BOOKED");
      return existing.id; // reuse the live pending hold
    }

    const schedule = await tx.classSchedule.findUnique({
      where: { id: input.classScheduleId },
      include: { class_model: { select: { max_capacity: true, name: true, partner_id: true } } },
    });
    if (!schedule) throw new Error("SCHEDULE_NOT_FOUND");
    if (schedule.status === "cancelled") throw new Error("CLASS_CANCELLED");
    if (schedule.status === "inactive") throw new Error("CLASS_INACTIVE");

    const cap = schedule.capacity ?? schedule.class_model?.max_capacity ?? 0;
    if (cap > 0) {
      const held = await tx.booking.findMany({
        where: { class_schedule_id: input.classScheduleId, status: { in: [...OCCUPYING_STATUSES] } },
        select: { extra_guest_count: true },
      });
      const seatsTaken = held.reduce((s, r) => s + 1 + Math.max(0, r.extra_guest_count ?? 0), 0);
      if (seatsTaken + 1 + input.extraGuestCount + (input.addedMemberCount ?? 0) > cap) throw new Error("CLASS_FULL");
    }

    const addedMemberProfileIds = (input.addedMemberProfileIds ?? []).filter(
      (id): id is string => typeof id === "string" && id.length > 0 && id !== input.userId,
    );

    const created = await tx.booking.create({
      data: {
        user_id: input.userId,
        class_schedule_id: input.classScheduleId,
        status: BOOKING_STATUS.payment_pending,
        class_name: input.className ?? schedule.class_model?.name ?? null,
        // Canonical: derive from the schedule, never the client-supplied ISO.
        class_time: schedule.start_time.toISOString(),
        email: input.email,
        // Partner-run classes await partner sign-off before confirmation (same as legacy create).
        confirmation_status: schedule.class_model?.partner_id ? "pending" : null,
        // Added members now get their OWN payment_pending rows below, so only
        // friends/family (guest_attendees, legacy) are still held as a count here.
        extra_guest_count: input.extraGuestCount,
        guest_attendees: input.guestAttendees != null ? (input.guestAttendees as object) : undefined,
        finance_snapshot: input.financeSnapshot as object,
        hold_expires_at: new Date(Date.now() + HOLD_MINUTES * 60_000),
      },
    });

    // Group bookings: create a payment_pending row per added member up-front,
    // linked to the booker via invited_by_user_id. They mirror the booker's status
    // (confirmed on pay, cancelled/expired on cancel/expire) and carry no payment.
    const className = input.className ?? schedule.class_model?.name ?? null;
    const classTimeIso = schedule.start_time.toISOString();
    const confirmationStatus = schedule.class_model?.partner_id ? "pending" : null;
    for (const memberId of addedMemberProfileIds) {
      const already = await tx.booking.findFirst({
        where: { user_id: memberId, class_schedule_id: input.classScheduleId, status: { in: [...OCCUPYING_STATUSES] } },
        select: { id: true },
      });
      if (already) continue;
      await tx.booking.create({
        data: {
          user_id: memberId,
          class_schedule_id: input.classScheduleId,
          status: BOOKING_STATUS.payment_pending,
          class_name: className,
          class_time: classTimeIso,
          confirmation_status: confirmationStatus,
          invited_by_user_id: input.userId,
          hold_expires_at: new Date(Date.now() + HOLD_MINUTES * 60_000),
        },
      });
    }
    return created.id;
  });
}
