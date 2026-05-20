import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { checkInOutcomeFromTimes } from "@/lib/bookingAttendance";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  if ((session.user as { role?: string }).role !== "admin") return res.status(403).json({ error: "Forbidden" });
  if (req.method !== "POST") return res.status(405).end();

  const { bookingId } = req.body as { bookingId?: string };
  if (!bookingId) return res.status(400).json({ error: "bookingId required" });

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { class_schedule: { select: { start_time: true } } },
  });
  if (!booking) return res.status(404).json({ error: "Booking not found" });
  if (booking.status === "cancelled") return res.status(400).json({ error: "Booking is cancelled" });
  if (booking.checked_in) return res.json({ alreadyCheckedIn: true });

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