import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { sendBookingConfirmationEmail } from "@/lib/notifications/sendBookingEmail";
import { sendStudioEmail } from "@/lib/notifications/email";
import logger from "@/lib/logger";
import { logActivity } from "@/lib/activityLog";
import { OCCUPYING_STATUSES } from "@/lib/bookingStatus";

const CONFIRMATION_CONFIRMED = "confirmed" as const;
const CONFIRMATION_PENDING = "pending" as const;

/**
 * Partner manager confirms or rejects a pending booking for one of THEIR classes.
 * - confirm → confirmation_status = "confirmed" + send the booking confirmation email.
 * - reject  → cancel booking, restore the class credit (non-unlimited), free the seat.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const sess = await getStudioServerSession(req, res);
  const user = sess?.user as { role?: string; partner_id?: string | null } | undefined;
  if (!user || user.role !== "partner" || !user.partner_id) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  const partnerId = user.partner_id;

  const { bookingId, action } = req.body ?? {};
  if (typeof bookingId !== "string" || !bookingId.trim()) {
    return res.status(400).json({ error: "bookingId required" });
  }
  if (action !== "confirm" && action !== "reject") {
    return res.status(400).json({ error: "action must be confirm or reject" });
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId.trim() },
    include: {
      user_package: { include: { package_type: true } },
      class_schedule: { include: { class_model: { select: { partner_id: true } } } },
    },
  });
  if (!booking) return res.status(404).json({ error: "Booking not found" });

  // A partner may only act on bookings for their own classes.
  if (booking.class_schedule?.class_model?.partner_id !== partnerId) {
    return res.status(403).json({ error: "This booking is not for your classes" });
  }
  if (booking.confirmation_status !== CONFIRMATION_PENDING) {
    return res.json({ ok: true, already: true, status: booking.confirmation_status });
  }

  if (action === "confirm") {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { confirmation_status: CONFIRMATION_CONFIRMED },
    });
    await sendBookingConfirmationEmail(booking.id).catch((e) => logger.error({ err: e }, "[partner confirm email]"));
    await logActivity({ req, action: "partner.booking_confirmed", entity: { type: "booking", id: booking.id } });
    return res.json({ ok: true, status: CONFIRMATION_CONFIRMED });
  }

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: booking.id },
      data: { status: "cancelled", cancellation_date: new Date(), confirmation_status: null },
    });

    if (
      booking.user_package_id &&
      booking.user_package &&
      !booking.user_package.package_type?.is_unlimited &&
      booking.user_package.credits_remaining != null
    ) {
      await tx.userPackage.update({
        where: { id: booking.user_package_id },
        data: { credits_remaining: { increment: 1 } },
      });
    }

    if (booking.class_schedule_id) {
      const sched = await tx.classSchedule.findUnique({
        where: { id: booking.class_schedule_id },
        include: { class_model: { select: { max_capacity: true } } },
      });
      if (sched) {
        const cap = sched.capacity ?? sched.class_model?.max_capacity ?? 0;
        if (cap > 0) {
          const remaining = await tx.booking.findMany({
            // Seat-occupying statuses incl. unpaid payment_pending holds — must
            // match every other roster/seat path or a reject leaks held seats.
            where: { class_schedule_id: booking.class_schedule_id, status: { in: [...OCCUPYING_STATUSES] } },
            select: { extra_guest_count: true },
          });
          const occupied = remaining.reduce((s, r) => s + 1 + Math.max(0, r.extra_guest_count ?? 0), 0);
          await tx.classSchedule.update({
            where: { id: booking.class_schedule_id },
            data: { current_bookings: occupied, available_spots: Math.max(0, cap - occupied) },
          });
        }
      }
    }
  });

  await sendStudioEmail("booking_cancelled", {
    userId: booking.user_id,
    data: { bookingId: booking.id, creditsCount: "1" },
  }).catch((e) => logger.error({ err: e }, "[partner reject CRM]"));
  await logActivity({ req, action: "partner.booking_rejected", entity: { type: "booking", id: booking.id } });
  return res.json({ ok: true, status: "rejected" });
}
