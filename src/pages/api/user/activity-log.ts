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
  const pageRaw = Number(req.query.page);
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;

  const where = { OR: [{ target_profile_id: me }, { actor_profile_id: me }] };

  const SORTABLE = new Set(["created_at", "category", "summary", "actor_name"]);
  const sortField =
    typeof req.query.sort === "string" && SORTABLE.has(req.query.sort) ? req.query.sort : "created_at";
  const sortDir = req.query.dir === "asc" ? "asc" : "desc";

  const [total, rows] = await prisma.$transaction([
    prisma.activityLog.count({ where }),
    prisma.activityLog.findMany({
    where,
    orderBy: { [sortField]: sortDir },
    skip: (page - 1) * limit,
    take: limit,
    select: {
      id: true,
      action: true,
      category: true,
      summary: true,
      actor_profile_id: true,
      actor_name: true,
      actor_role: true,
      entity_type: true,
      entity_id: true,
      metadata: true,
      created_at: true,
    },
    }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / limit));

  return res.status(200).json({
    items: rows.map((r) => ({
      id: r.id,
      action: r.action,
      category: r.category,
      summary: r.summary,
      actorIsSelf: r.actor_profile_id === me,
      actorName: r.actor_name,
      actorRole: r.actor_role,
      entityType: r.entity_type,
      entityId: r.entity_id,
      metadata: r.metadata ?? null,
      createdAt: r.created_at,
    })),
    page,
    pageCount,
    total,
  });
}
