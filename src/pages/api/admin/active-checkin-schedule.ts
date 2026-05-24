import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { ensureScheduleQrCodes } from "@/lib/checkinQr";
import { CHECKIN_OPEN_BEFORE_MS, CHECKIN_CLOSE_AFTER_MS } from "@/lib/checkinWindow";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  if ((session.user as { role?: string }).role !== "admin")
    return res.status(403).json({ error: "Forbidden" });

  const now = Date.now();
  const schedule = await prisma.classSchedule.findFirst({
    where: {
      status: { not: "cancelled" },
      start_time: {
        gte: new Date(now - CHECKIN_CLOSE_AFTER_MS),
        lte: new Date(now + CHECKIN_OPEN_BEFORE_MS),
      },
    },
    orderBy: { start_time: "asc" },
    select: {
      id: true,
      start_time: true,
      end_time: true,
      instructor_check_in_time: true,
      class_model: { select: { name: true } },
      instructor: { select: { name: true } },
    },
  });

  if (!schedule) return res.json({ active: null });

  const qrs = await ensureScheduleQrCodes(schedule.id);
  return res.json({
    active: {
      scheduleId: schedule.id,
      className: schedule.class_model?.name ?? "Class",
      instructorName: schedule.instructor?.name ?? null,
      startTime: schedule.start_time.toISOString(),
      endTime: schedule.end_time.toISOString(),
      instructorCheckedIn: !!schedule.instructor_check_in_time,
      instructorQrUrl: qrs.instructor.imageUrl,
      memberQrUrl: qrs.member.imageUrl,
    },
  });
}
