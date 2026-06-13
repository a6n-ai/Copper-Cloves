import prisma from "@/lib/prisma";
import { BOOKING_STATUS, SEAT_HOLDING_STATUSES } from "@/lib/bookingStatus";
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
};

/**
 * Reserve a seat by creating (or reusing) a payment_pending booking inside a transaction.
 * Capacity is enforced here so two members cannot both pay for the last seat.
 * Reuses an existing live pending booking for the same (user, schedule) so a repeated
 * book-click does not duplicate the hold. Throws ALREADY_BOOKED if already confirmed.
 */
export async function createPendingBooking(input: PendingBookingInput): Promise<string> {
  return prisma.$transaction(async (tx) => {
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

    const cap = schedule.capacity ?? schedule.class_model?.max_capacity ?? 0;
    if (cap > 0) {
      const held = await tx.booking.findMany({
        where: { class_schedule_id: input.classScheduleId, status: { in: [...SEAT_HOLDING_STATUSES] } },
        select: { extra_guest_count: true },
      });
      const seatsTaken = held.reduce((s, r) => s + 1 + Math.max(0, r.extra_guest_count ?? 0), 0);
      if (seatsTaken + 1 + input.extraGuestCount + (input.addedMemberCount ?? 0) > cap) throw new Error("CLASS_FULL");
    }

    const created = await tx.booking.create({
      data: {
        user_id: input.userId,
        class_schedule_id: input.classScheduleId,
        status: BOOKING_STATUS.payment_pending,
        class_name: input.className ?? schedule.class_model?.name ?? null,
        class_time: input.classTimeISO || schedule.start_time.toISOString(),
        email: input.email,
        // Partner-run classes await partner sign-off before confirmation (same as legacy create).
        confirmation_status: schedule.class_model?.partner_id ? "pending" : null,
        // Hold every group seat on the booker row for the pending window — guests and
        // added members don't get their own rows until payment confirms, so without this
        // their seats would be grabbable by others mid-hold. Reset to 0 at confirm
        // (confirmPreCreatedBookingFlow) when those rows are created.
        extra_guest_count: input.extraGuestCount + (input.addedMemberCount ?? 0),
        guest_attendees: input.guestAttendees != null ? (input.guestAttendees as object) : undefined,
        finance_snapshot: input.financeSnapshot as object,
        hold_expires_at: new Date(Date.now() + HOLD_MINUTES * 60_000),
      },
    });
    return created.id;
  });
}
