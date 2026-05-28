import type { NextApiRequest, NextApiResponse } from "next";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { getDynamicStats } from "@/lib/attendanceStats";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  const userId = (session.user as { id: string }).id;

  if (req.method === "GET") {
    const stats = await getDynamicStats(userId);
    // Per-user cacheable for a short window so the portal dashboard's
    // multiple consumers (header chips, stat tiles) dedupe rapid refetches.
    res.setHeader("Cache-Control", "private, max-age=10, stale-while-revalidate=60");
    return res.json(stats);
  }

  res.status(405).end();
}
