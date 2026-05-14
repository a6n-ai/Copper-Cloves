import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  const userId = (session.user as { id: string }).id;

  if (req.method === "GET") {
    let stats = await prisma.userStats.findUnique({ where: { user_id: userId } });
    if (!stats) {
      stats = await prisma.userStats.create({
        data: { user_id: userId },
      });
    }
    return res.json(stats);
  }

  if (req.method === "PATCH") {
    const data = req.body;
    const stats = await prisma.userStats.upsert({
      where: { user_id: userId },
      update: data,
      create: { user_id: userId, ...data },
    });
    return res.json(stats);
  }

  res.status(405).end();
}
