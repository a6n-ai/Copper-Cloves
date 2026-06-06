import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { ensureAdmin } from "@/lib/requireAdmin";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getStudioServerSession(req, res);
  if (!ensureAdmin(session, res)) return;

  const { q, role, category, action, targetProfileId, from, to } = req.query;
  const limitRaw = Number(req.query.limit);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), MAX_LIMIT) : DEFAULT_LIMIT;
  const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;

  const where: Prisma.ActivityLogWhereInput = {};
  if (typeof role === "string" && role) where.actor_role = role;
  if (typeof category === "string" && category) where.category = category;
  if (typeof action === "string" && action) where.action = action;
  if (typeof targetProfileId === "string" && targetProfileId) where.target_profile_id = targetProfileId;
  if (typeof from === "string" || typeof to === "string") {
    where.created_at = {};
    if (typeof from === "string" && from) where.created_at.gte = new Date(from);
    if (typeof to === "string" && to) where.created_at.lte = new Date(to);
  }
  if (typeof q === "string" && q.trim()) {
    const term = q.trim();
    where.OR = [
      { actor_name: { contains: term, mode: "insensitive" } },
      { summary: { contains: term, mode: "insensitive" } },
      { actor: { email: { contains: term, mode: "insensitive" } } },
      { target: { email: { contains: term, mode: "insensitive" } } },
      { target: { full_name: { contains: term, mode: "insensitive" } } },
    ];
  }

  const rows = await prisma.activityLog.findMany({
    where,
    orderBy: { created_at: "desc" },
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    include: {
      actor: { select: { id: true, full_name: true, email: true, role: true } },
      target: { select: { id: true, full_name: true, email: true, role: true } },
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
      actorName: r.actor_name ?? r.actor?.full_name ?? null,
      actorRole: r.actor_role,
      actorEmail: r.actor?.email ?? null,
      target: r.target ? { id: r.target.id, name: r.target.full_name, email: r.target.email, role: r.target.role } : null,
      entityType: r.entity_type,
      entityId: r.entity_id,
      createdAt: r.created_at,
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
}
