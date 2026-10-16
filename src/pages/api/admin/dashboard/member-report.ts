import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { hasRole } from "@/lib/auth/roles";
import { BOOKING_STATUS, REVENUE_STATUSES } from "@/lib/bookingStatus";
import { resolveRange } from "@/lib/classReport";
import { buildMemberReport } from "@/lib/memberReport";
import logger from "@/lib/logger";

const NOT_ADMIN = { NOT: { role: { equals: "admin", mode: "insensitive" as const } } };
const displayName = (p: { full_name: string | null; email: string }) => p.full_name || p.email || "Member";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  if (!hasRole((session.user as { role?: string }).role, "admin")) return res.status(403).json({ error: "Forbidden" });
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const now = new Date();
  const range = resolveRange(req.query.from, req.query.to, now);
  if ("error" in range) return res.status(400).json({ error: range.error });
  const window = { gte: range.prevFromUtc, lt: range.toUtcExclusive };

  try {
    const [bookings, signups, passes] = await Promise.all([
      prisma.booking.findMany({
        where: {
          status: { in: [...REVENUE_STATUSES, BOOKING_STATUS.cancelled] },
          class_schedule: { start_time: window },
        },
        select: {
          user_id: true,
          status: true,
          checked_in: true,
          check_in_outcome: true,
          profile: { select: { full_name: true, email: true } },
          class_schedule: { select: { status: true, start_time: true, end_time: true } },
        },
      }),
      prisma.profile.findMany({ where: { created_at: window, ...NOT_ADMIN }, select: { created_at: true } }),
      prisma.userPackage.findMany({
        where: { is_active: true, expiration_date: { gte: now } },
        select: { user_id: true, expiration_date: true, profile: { select: { full_name: true, email: true } } },
      }),
    ]);

    const visits = bookings.flatMap((b) =>
      b.class_schedule
        ? [{
            userId: b.user_id,
            name: displayName(b.profile),
            sessionStatus: b.class_schedule.status,
            startTime: b.class_schedule.start_time,
            endTime: b.class_schedule.end_time,
            status: b.status,
            checkedIn: b.checked_in,
            outcome: b.check_in_outcome,
          }]
        : [],
    );

    return res.json(
      buildMemberReport(
        visits,
        signups.map((s) => s.created_at),
        passes.map((p) => ({ userId: p.user_id, name: displayName(p.profile), expiresAt: p.expiration_date })),
        range,
        now,
      ),
    );
  } catch (e) {
    logger.error({ err: e }, "[dashboard/member-report]");
    return res.status(500).json({ error: "Could not load the member report" });
  }
}
