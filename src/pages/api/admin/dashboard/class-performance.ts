import type { NextApiRequest, NextApiResponse } from "next";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { getClassPerformance } from "@/lib/adminDashboardSections";
import logger from "@/lib/logger";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  if ((session.user as { role?: string }).role !== "admin") return res.status(403).json({ error: "Forbidden" });
  if (req.method !== "GET") return res.status(405).end();
  try {
    return res.json(await getClassPerformance());
  } catch (e) {
    logger.error({ err: e }, "[dashboard/class-performance]");
    return res.status(200).json({
      classPerformance: [{ name: "No bookings yet", bookings: 0, capacity: 0, utilization: 0, discipline: "—" }],
      disciplineSplit: [{ name: "—", count: 0, percentage: 100 }],
      _partial: true,
    });
  }
}
