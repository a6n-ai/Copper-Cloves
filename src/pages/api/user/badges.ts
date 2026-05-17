import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const userId = (session.user as { id: string }).id;

  const badges = await prisma.userBadge.findMany({
    where: { user_id: userId },
    include: { badge_template: true },
    orderBy: { earned_at: "desc" },
  });

  return res.json(badges);
}
