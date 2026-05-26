import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";

/**
 * Admin-only: mark the instructor checked in (or undo) for a class.
 * Mirrors /api/admin/manual-check-in for members. No time window — admin override.
 *
 * Body: { scheduleId: string, checked?: boolean }   // checked defaults to true
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  if ((session.user as { role?: string }).role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { scheduleId, checked } = req.body as { scheduleId?: string; checked?: boolean };
  if (!scheduleId) return res.status(400).json({ error: "scheduleId required" });
  const setChecked = checked !== false; // default true

  const existing = await prisma.classSchedule.findUnique({
    where: { id: scheduleId },
    select: { id: true, instructor_check_in_time: true },
  });
  if (!existing) return res.status(404).json({ error: "Schedule not found" });

  // Idempotent on set: keep the original timestamp so logs stay accurate.
  if (setChecked && existing.instructor_check_in_time) {
    return res.json({
      ok: true,
      instructorCheckedIn: true,
      instructorCheckInTime: existing.instructor_check_in_time.toISOString(),
    });
  }

  const now = setChecked ? new Date() : null;
  const updated = await prisma.classSchedule.update({
    where: { id: scheduleId },
    data: { instructor_check_in_time: now },
    select: { instructor_check_in_time: true },
  });

  return res.json({
    ok: true,
    instructorCheckedIn: !!updated.instructor_check_in_time,
    instructorCheckInTime: updated.instructor_check_in_time?.toISOString() ?? null,
  });
}
