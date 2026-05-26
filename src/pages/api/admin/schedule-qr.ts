import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { ensureScheduleQrCodes } from "@/lib/checkinQr";
import { withinCheckinWindow } from "@/lib/checkinWindow";

/** Admin: QR codes for any schedule (generated/stored on demand). */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).end();
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  if ((session.user as { role?: string }).role !== "admin")
    return res.status(403).json({ error: "Forbidden" });

  const scheduleId = (req.method === "GET" ? req.query.scheduleId : req.body?.scheduleId) as
    | string
    | undefined;
  if (!scheduleId || typeof scheduleId !== "string")
    return res.status(400).json({ error: "scheduleId required" });

  const schedule = await prisma.classSchedule.findUnique({
    where: { id: scheduleId },
    select: { id: true, start_time: true, status: true },
  });
  if (!schedule) return res.status(404).json({ error: "Not found" });
  if (schedule.status === "completed" || schedule.status === "abandoned") {
    return res.status(409).json({ error: `Class is ${schedule.status}; QR is locked.` });
  }

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
