import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { sendBookingConfirmationEmail } from "@/lib/notifications/sendBookingEmail";
import { buildBookingCrmVariables, dispatchCrmEmailTriggers } from "@/lib/notifications/crmTemplatedDispatch";
import { CrmTriggerType } from "@/lib/crmTriggerTypes";

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
  if (booking.confirmation_status !== "pending") {
    return res.json({ ok: true, already: true, status: booking.confirmation_status });
  }

  if (action === "confirm") {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { confirmation_status: "confirmed" },
    });
    await sendBookingConfirmationEmail(booking.id).catch((e) => console.error("[partner confirm email]", e));
    await buildBookingCrmVariables(booking.id)
      .then((variables) =>
        dispatchCrmEmailTriggers({
          triggerType: CrmTriggerType.ClassBookingConfirmed,
          userId: booking.user_id,
          variables,
        }),
      )
      .catch((e) => console.error("[partner confirm CRM]", e));
    return res.json({ ok: true, status: "confirmed" });
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
            where: { class_schedule_id: booking.class_schedule_id, status: { in: ["confirmed", "pending"] } },
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

  await buildBookingCrmVariables(booking.id)
    .then((variables) =>
      dispatchCrmEmailTriggers({
        triggerType: CrmTriggerType.ClassBookingCancelled,
        userId: booking.user_id,
        variables,
      }),
    )
    .catch((e) => console.error("[partner reject CRM]", e));

  return res.json({ ok: true, status: "rejected" });
}
