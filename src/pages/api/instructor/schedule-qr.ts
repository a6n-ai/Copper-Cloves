import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getInstructorSession } from "@/lib/instructorAuth";
import { ensureScheduleQrCodes } from "@/lib/checkinQr";
import { withinCheckinWindow } from "@/lib/checkinWindow";

/**
 * Instructor: fetch / force-refresh QR for a class they own.
 * GET = fetch (cached). POST = force regenerate (S3 retry).
 * Hierarchy: instructor can only act on schedules where instructor_id OR
 * actual_instructor_id matches their own instructor row.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).end();
  const instructor = await getInstructorSession(req, res);
  if (!instructor) return res.status(401).json({ error: "Unauthorized" });

  const scheduleId = (req.method === "GET" ? req.query.scheduleId : req.body?.scheduleId) as
    | string
    | undefined;
  if (!scheduleId || typeof scheduleId !== "string")
    return res.status(400).json({ error: "scheduleId required" });

  const schedule = await prisma.classSchedule.findUnique({
    where: { id: scheduleId },
    select: { id: true, start_time: true, instructor_id: true, actual_instructor_id: true },
  });
  if (!schedule) return res.status(404).json({ error: "Not found" });

  const ownsClass =
    schedule.instructor_id === instructor.instructorId ||
    schedule.actual_instructor_id === instructor.instructorId;
  if (!ownsClass) return res.status(403).json({ error: "Not your class" });

  const force = req.method === "POST";
  const qrs = await ensureScheduleQrCodes(schedule.id, { force });
  const opensAt = new Date(schedule.start_time.getTime() - 30 * 60 * 1000);
  return res.json({
    instructorQrUrl: qrs.instructor.imageUrl,
    memberQrUrl: qrs.member.imageUrl,
    withinWindow: withinCheckinWindow(schedule.start_time),
    startTime: schedule.start_time.toISOString(),
    windowOpensAt: opensAt.toISOString(),
  });
}
