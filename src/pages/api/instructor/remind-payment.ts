/**
 * Instructor "remind" action for a payment_pending booking on one of THEIR classes.
 * Sends the recovery email only — instructors cannot reconcile/confirm payments
 * (that's admin-only). Scoped: the booking's schedule must be assigned to this instructor.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getInstructorSession } from "@/lib/instructorAuth";
import { sendPendingRecoveryEmail } from "@/lib/notifications/sendPendingRecoveryEmail";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const instructor = await getInstructorSession(req, res);
  if (!instructor) return res.status(401).json({ error: "Unauthorized" });
  if (req.method !== "POST") return res.status(405).end();

  const { bookingId } = req.body as { bookingId?: string };
  if (!bookingId) return res.status(400).json({ error: "bookingId required" });

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      class_schedule: { select: { instructor_id: true, actual_instructor_id: true } },
    },
  });
  if (!booking) return res.status(404).json({ error: "Booking not found" });

  // Scope: only the assigned (or actual) instructor of this class may remind.
  const sched = booking.class_schedule;
  const ownsClass =
    sched?.instructor_id === instructor.instructorId ||
    sched?.actual_instructor_id === instructor.instructorId;
  if (!ownsClass) return res.status(403).json({ error: "Not your class" });

  if (booking.status !== "payment_pending") {
    return res.status(409).json({ error: `Cannot remind a ${booking.status} booking` });
  }

  await sendPendingRecoveryEmail(booking.id);
  return res.json({ ok: true, reminded: true });
}
