import type { NextApiRequest, NextApiResponse } from "next";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { getMemberStats } from "@/lib/adminDashboardSections";
import logger from "@/lib/logger";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  if ((session.user as { role?: string }).role !== "admin") return res.status(403).json({ error: "Forbidden" });
  if (req.method !== "GET") return res.status(405).end();
  try {
    // No-show reconciliation moved off the request path — runs via /api/cron/reconcile-no-shows.
    return res.json({ memberStats: await getMemberStats() });
  } catch (e) {
    logger.error({ err: e }, "[dashboard/member-stats]");
    return res.status(200).json({
      memberStats: {
        memberOfMonth: { id: null, name: "—", classes: 0, streak: 0 },
        topClass: { name: "—", bookings: 0 },
        weeklyStreak: { average: 0, top: 0 },
        onTimeCheckIns: 0, lateCheckIns: 0, checkInSample: 0,
        onTimeCheckInPct: 0, lateCheckInPct: 0, noShows: 0,
        expiring7Days: 0, expiring15Days: 0, expiring30Days: 0,
        specialtyActive: 0, inactiveUsers: 0,
        totalMembers: 0, activeMembers: 0, studioPassActive: 0, classPassActive: 0, checkInsThisMonth: 0,
        memberGrowth: [], streakDistribution: [],
      },
      _partial: true,
    });
  }
}
