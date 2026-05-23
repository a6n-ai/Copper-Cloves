import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getInstructorSession } from "@/lib/instructorAuth";
import { checkInOutcomeFromTimes } from "@/lib/bookingAttendance";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getInstructorSession(req, res);
  if (!session) return res.status(401).json({ error: "Not authenticated" });

  const { bookingId } = req.body as { bookingId?: string };
  if (!bookingId) return res.status(400).json({ error: "bookingId required" });

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      class_schedule: {
        select: { instructor_id: true, start_time: true },
      },
    },
  });
  if (!booking) return res.status(404).json({ error: "Booking not found" });
  if (booking.class_schedule?.instructor_id !== session.instructorId)
    return res.status(403).json({ error: "Not your class" });
  if (booking.status === "cancelled")
    return res.status(400).json({ error: "Booking is cancelled" });

  if (booking.checked_in) {
    return res.json({ alreadyCheckedIn: true, booking });
  }

  const now = new Date();
  const classStart = booking.class_schedule?.start_time ?? now;
  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      checked_in: true,
      check_in_time: now,
      check_in_outcome: checkInOutcomeFromTimes(classStart, now),
    },
  });

  return res.json({ ok: true, booking: updated });
}
