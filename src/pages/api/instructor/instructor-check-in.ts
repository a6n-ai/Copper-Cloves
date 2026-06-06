import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getInstructorSession } from "@/lib/instructorAuth";
import { requestLogger } from "@/lib/logger";
import { logActivity } from "@/lib/activityLog";

// Window: 15 min before class start → 5 min after class start
const OPEN_BEFORE_MS = 15 * 60 * 1000;
const CLOSE_AFTER_MS = 5 * 60 * 1000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const log = requestLogger(req, res);
  if (req.method !== "POST") return res.status(405).end();

  const session = await getInstructorSession(req, res);
  if (!session) return res.status(401).json({ error: "Not authenticated" });

  const { scheduleId } = req.body as { scheduleId?: string };
  if (!scheduleId) return res.status(400).json({ error: "scheduleId required" });

  const schedule = await prisma.classSchedule.findUnique({
    where: { id: scheduleId },
    select: { id: true, instructor_id: true, start_time: true, instructor_check_in_time: true },
  });

  if (!schedule) return res.status(404).json({ error: "Schedule not found" });
  if (schedule.instructor_id !== session.instructorId)
    return res.status(403).json({ error: "Not your class" });

  // Already checked in
  if (schedule.instructor_check_in_time)
    return res.json({ alreadyCheckedIn: true, checkInTime: schedule.instructor_check_in_time });

  const now = new Date();
  const classStart = schedule.start_time.getTime();
  const earliest = classStart - OPEN_BEFORE_MS;
  const latest = classStart + CLOSE_AFTER_MS;

  if (now.getTime() < earliest) {
    const minutesUntilOpen = Math.ceil((earliest - now.getTime()) / 60000);
    return res.status(400).json({
      error: `Check-in opens ${minutesUntilOpen} min before class. Try again closer to class time.`,
      code: "TOO_EARLY",
    });
  }

  if (now.getTime() > latest) {
    return res.status(400).json({
      error: "Check-in window has closed (more than 5 min after class start).",
      code: "TOO_LATE",
    });
  }

  const updated = await prisma.classSchedule.update({
    where: { id: scheduleId },
    data: { instructor_check_in_time: now },
  });

  log.info({ instructorId: session.instructorId, scheduleId }, "instructor self checked in");
  await logActivity({ req, action: "instructor.self_check_in", entity: { type: "class_schedule", id: scheduleId } });
  return res.json({ ok: true, checkInTime: updated.instructor_check_in_time });
}
