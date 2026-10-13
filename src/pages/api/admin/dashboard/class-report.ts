import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { hasRole } from "@/lib/auth/roles";
import { BOOKING_STATUS, REVENUE_STATUSES } from "@/lib/bookingStatus";
import { buildClassReport, byInstructor, resolveRange, taughtBy, toSessionRow } from "@/lib/classReport";
import logger from "@/lib/logger";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  if (!hasRole((session.user as { role?: string }).role, "admin")) return res.status(403).json({ error: "Forbidden" });
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const now = new Date();
  const range = resolveRange(req.query.from, req.query.to, now);
  if ("error" in range) return res.status(400).json({ error: range.error });
  const param = (v: unknown) => (typeof v === "string" && v ? v : undefined);
  const classId = param(req.query.classId);
  const instructorId = param(req.query.instructorId);
  const groupByInstructor = req.query.groupBy === "instructor";

  try {
    const schedules = await prisma.classSchedule.findMany({
      where: {
        start_time: { gte: range.prevFromUtc, lt: range.toUtcExclusive },
        ...(classId ? { class_id: classId } : {}),
      },
      select: {
        id: true,
        class_id: true,
        status: true,
        start_time: true,
        end_time: true,
        capacity: true,
        class_model: { select: { name: true, category: true, max_capacity: true } },
        instructor: { select: { id: true, name: true } },
        actual_instructor: { select: { id: true, name: true } },
        bookings: {
          where: { status: { in: [...REVENUE_STATUSES, BOOKING_STATUS.cancelled] } },
          select: { status: true, checked_in: true, check_in_outcome: true, extra_guest_count: true },
        },
      },
    });

    // ponytail: the instructor filter runs in JS because "taught by" is actual_instructor ?? instructor;
    // push it into the query if a year of schedules ever gets slow.
    let rows = schedules.map(toSessionRow);
    if (instructorId) rows = taughtBy(rows, instructorId);
    else if (groupByInstructor) rows = byInstructor(rows);

    return res.json(buildClassReport(rows, range, now, Boolean(classId || instructorId)));
  } catch (e) {
    logger.error({ err: e }, "[dashboard/class-report]");
    return res.status(500).json({ error: "Could not load the class report" });
  }
}
