import type { NextApiRequest, NextApiResponse } from "next";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { getTodayClasses } from "@/lib/adminDashboardSections";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  if ((session.user as { role?: string }).role !== "admin") return res.status(403).json({ error: "Forbidden" });
  if (req.method !== "GET") return res.status(405).end();
  try {
    const dateRaw = typeof req.query.date === "string" ? req.query.date.trim() : "";
    let forDate: Date | undefined;
    if (dateRaw) {
      const parts = dateRaw.split("-").map(Number);
      if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
        forDate = new Date(parts[0], parts[1] - 1, parts[2]);
        if (Number.isNaN(forDate.getTime())) forDate = undefined;
      }
    }
    return res.json({ todayClasses: await getTodayClasses(undefined, forDate) });
  } catch (e) {
    console.error("[dashboard/today-classes]", e);
    return res.status(200).json({ todayClasses: [], _partial: true });
  }
}
