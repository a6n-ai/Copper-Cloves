import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { ensureScheduleQrCodes } from "@/lib/checkinQr";
import { withinCheckinWindow } from "@/lib/checkinWindow";
import { requestLogger } from "@/lib/logger";
import { hasRole } from "@/lib/auth/roles";

/** Admin: QR codes for any schedule (generated/stored on demand). */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const log = requestLogger(req, res);
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).end();
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  if (!hasRole((session.user as { role?: string }).role, "admin"))
    return res.status(403).json({ error: "Forbidden" });

  const scheduleId = (req.method === "GET" ? req.query.scheduleId : req.body?.scheduleId) as
    | string
    | undefined;
  if (!scheduleId || typeof scheduleId !== "string")
    return res.status(400).json({ error: "scheduleId required" });

  try {
    const schedule = await prisma.classSchedule.findUnique({
      where: { id: scheduleId },
      select: { id: true, start_time: true, status: true },
    });
    if (!schedule) return res.status(404).json({ error: "Schedule not found" });

    const opensAt = new Date(schedule.start_time.getTime() - 30 * 60 * 1000);
    const checkinClosedAt = schedule.start_time.getTime() + 30 * 60 * 1000;
    const isStatusLocked = schedule.status === "completed" || schedule.status === "abandoned";
    const isWindowClosed = Date.now() > checkinClosedAt;
    const isPast = isStatusLocked || isWindowClosed;

    // Past classes (status-locked OR check-in window has closed): show the
    // historical QR if it exists, but never mint new ones.
    if (isPast) {
      if (req.method === "POST") {
        const reason = isStatusLocked ? schedule.status : "past";
        return res.status(409).json({ error: `Class is ${reason}; QR is locked.` });
      }
      const rows = await prisma.qrCode.findMany({
        where: { class_schedule_id: schedule.id },
        include: { file: true },
      });
      const byKind = new Map(rows.map((r) => [r.kind, r] as const));
      return res.json({
        instructorQrUrl: byKind.get("instructor")?.file?.url ?? null,
        memberQrUrl: byKind.get("member")?.file?.url ?? null,
        withinWindow: false,
        historical: true,
        startTime: schedule.start_time.toISOString(),
        windowOpensAt: opensAt.toISOString(),
      });
    }

    if (!process.env.CHECKIN_QR_SECRET?.trim()) {
      return res
        .status(500)
        .json({ error: "Server misconfigured: CHECKIN_QR_SECRET env var is not set" });
    }
    if (!process.env.BETTER_AUTH_URL?.trim()) {
      return res
        .status(500)
        .json({ error: "Server misconfigured: BETTER_AUTH_URL env var is not set" });
    }

    const force = req.method === "POST";
    const qrs = await ensureScheduleQrCodes(schedule.id, { force });
    return res.json({
      instructorQrUrl: qrs.instructor.imageUrl,
      memberQrUrl: qrs.member.imageUrl,
      withinWindow: withinCheckinWindow(schedule.start_time),
      historical: false,
      startTime: schedule.start_time.toISOString(),
      windowOpensAt: opensAt.toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    log.error({ err, scheduleId }, "admin schedule-qr failed");
    return res.status(500).json({ error: `Failed to generate QR: ${message}` });
  }
}
