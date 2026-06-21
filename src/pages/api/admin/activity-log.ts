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
  const pageRaw = Number(req.query.page);
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;

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
      // Search by class name stored in the audit metadata (booking + schedule events).
      { metadata: { path: ["class_name"], string_contains: term } },
    ];
  }

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
      include: {
        actor: { select: { id: true, full_name: true, email: true, role: true } },
        target: { select: { id: true, full_name: true, email: true, role: true } },
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
      actorName: r.actor_name ?? r.actor?.full_name ?? null,
      actorRole: r.actor_role,
      actorEmail: r.actor?.email ?? null,
      target: r.target ? { id: r.target.id, name: r.target.full_name, email: r.target.email, role: r.target.role } : null,
      entityType: r.entity_type,
      entityId: r.entity_id,
      metadata: r.metadata ?? null,
      ip: r.ip ?? null,
      userAgent: r.user_agent ?? null,
      createdAt: r.created_at,
    })),
    page,
    pageCount,
    total,
  });
}
