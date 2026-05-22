import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { sendBookingConfirmationEmail } from "@/lib/notifications/sendBookingEmail";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  if ((session.user as { role?: string }).role !== "admin") return res.status(403).json({ error: "Forbidden" });
  if (req.method !== "POST") return res.status(405).end();

  const { scheduleId, userId } = req.body as { scheduleId?: string; userId?: string };
  if (!scheduleId || !userId) return res.status(400).json({ error: "scheduleId and userId required" });

  const schedule = await prisma.classSchedule.findUnique({
    where: { id: scheduleId },
    include: {
      class_model: { select: { name: true } },
      bookings: { where: { status: "confirmed" }, select: { id: true, user_id: true } },
    },
  });
  if (!schedule) return res.status(404).json({ error: "Schedule not found" });
  if (schedule.status === "cancelled") return res.status(400).json({ error: "Class is cancelled" });

  const alreadyBooked = schedule.bookings.some(b => b.user_id === userId);
  if (alreadyBooked) return res.status(409).json({ error: "Member already booked into this class" });

  if (schedule.capacity != null && schedule.bookings.length >= schedule.capacity) {
    return res.status(400).json({ error: "Class is at full capacity" });
  }

  const member = await prisma.profile.findUnique({ where: { id: userId }, select: { full_name: true, email: true, avatar_url: true } });
  if (!member) return res.status(404).json({ error: "Member not found" });

  const booking = await prisma.booking.create({
    data: {
      user_id: userId,
      class_schedule_id: scheduleId,
      status: "confirmed",
      class_name: schedule.class_model?.name ?? null,
      class_time: schedule.start_time.toISOString(),
    },
  });

  await sendBookingConfirmationEmail(booking.id).catch(e => console.error("[add-booking email]", e));

  return res.status(201).json({
    booking: {
      id: booking.id,
      userId,
      name: member.full_name || "Member",
      email: member.email,
      avatarUrl: member.avatar_url ?? null,
      checkedIn: false,
      checkInTime: null,
      checkInOutcome: null,
      extraGuests: 0,
    },
  });
}
