import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { ensureAdmin } from "@/lib/requireAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getStudioServerSession(req, res);
  if (!ensureAdmin(session, res)) return;

  const now = Date.now();
  const since24h = new Date(now - 24 * 60 * 60 * 1000);
  const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const [total, last24h, last7d, byCategory, topActionGroup, topActorGroup] = await Promise.all([
    prisma.activityLog.count(),
    prisma.activityLog.count({ where: { created_at: { gte: since24h } } }),
    prisma.activityLog.count({ where: { created_at: { gte: since7d } } }),
    prisma.activityLog.groupBy({ by: ["category"], _count: { _all: true } }),
    prisma.activityLog.groupBy({
      by: ["action"],
      _count: { _all: true },
      orderBy: { _count: { action: "desc" } },
      take: 1,
    }),
    prisma.activityLog.groupBy({
      by: ["actor_name"],
      where: { actor_name: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { actor_name: "desc" } },
      take: 1,
    }),
  ]);

  const topAction = topActionGroup[0]
    ? { action: topActionGroup[0].action, count: topActionGroup[0]._count._all }
    : null;
  const topActor = topActorGroup[0]
    ? { name: topActorGroup[0].actor_name, count: topActorGroup[0]._count._all }
    : null;

  return res.status(200).json({
    total,
    last24h,
    last7d,
    byCategory: byCategory
      .map((c) => ({ category: c.category, count: c._count._all }))
      .sort((a, b) => b.count - a.count),
    topAction,
    topActor,
  });
}
