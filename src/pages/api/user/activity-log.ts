import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getStudioServerSession(req, res);
  const me = session?.user ? (session.user as { id: string }).id : null;
  if (!me) return res.status(401).json({ error: "Unauthorized" });

  const limitRaw = Number(req.query.limit);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), MAX_LIMIT) : DEFAULT_LIMIT;
  const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;

  const rows = await prisma.activityLog.findMany({
    where: { OR: [{ target_profile_id: me }, { actor_profile_id: me }] },
    orderBy: { created_at: "desc" },
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    select: {
      id: true,
      action: true,
      category: true,
      summary: true,
      actor_profile_id: true,
      actor_name: true,
      entity_type: true,
      entity_id: true,
      created_at: true,
    },
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return res.status(200).json({
    items: page.map((r) => ({
      id: r.id,
      action: r.action,
      category: r.category,
      summary: r.summary,
      actorIsSelf: r.actor_profile_id === me,
      actorName: r.actor_name,
      entityType: r.entity_type,
      entityId: r.entity_id,
      createdAt: r.created_at,
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
}
