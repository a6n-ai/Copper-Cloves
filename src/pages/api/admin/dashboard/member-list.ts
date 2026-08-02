import type { NextApiRequest, NextApiResponse } from "next";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { getMemberList } from "@/lib/adminDashboardSections";
import logger from "@/lib/logger";
import { hasRole } from "@/lib/auth/roles";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  if (!hasRole((session.user as { role?: string }).role, "admin")) return res.status(403).json({ error: "Forbidden" });
  if (req.method !== "GET") return res.status(405).end();
  try {
    return res.json({ memberList: await getMemberList() });
  } catch (e) {
    logger.error({ err: e }, "[dashboard/member-list]");
    return res.status(200).json({ memberList: [], _partial: true });
  }
}
