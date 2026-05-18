import type { NextApiRequest, NextApiResponse } from "next";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { getInstructorsSummary } from "@/lib/adminDashboardSections";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  if ((session.user as { role?: string }).role !== "admin") return res.status(403).json({ error: "Forbidden" });
  if (req.method !== "GET") return res.status(405).end();
  try {
    return res.json({ instructors: await getInstructorsSummary() });
  } catch (e) {
    console.error("[dashboard/instructors-summary]", e);
    return res.status(200).json({ instructors: [], _partial: true });
  }
}
