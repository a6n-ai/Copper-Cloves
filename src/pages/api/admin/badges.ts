import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { ensureAdmin } from "@/lib/requireAdmin";
import { hasRole } from "@/lib/auth/roles";

const PTM_DEFAULTS = [
  {
    name: "The Seeker",
    description: "The start of your journey",
    icon: "🌱",
    color: "#7C9070",
    threshold_classes: 5,
    sort_order: 1,
    badge_type: "path_to_mastery",
    is_active: true,
  },
  {
    name: "The Warrior",
    description: "Strength and consistency",
    icon: "⚔️",
    color: "#C17A5A",
    threshold_classes: 30,
    sort_order: 2,
    badge_type: "path_to_mastery",
    is_active: true,
  },
  {
    name: "The Alchemist",
    description: "Movement meets mindfulness",
    icon: "☀️",
    color: "#a05e38",
    threshold_classes: 75,
    sort_order: 3,
    badge_type: "path_to_mastery",
    is_active: true,
  },
  {
    name: "The Immortal",
    description: "Legendary status achieved",
    icon: "👑",
    color: "#B8860B",
    threshold_classes: 150,
    sort_order: 4,
    badge_type: "path_to_mastery",
    is_active: true,
  },
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  // GET is readable by any authenticated user — path_to_mastery templates are the
  // member's own milestone track (rendered on their dashboard). Non-admins get the
  // PTM track only (no custom-badge catalog, no cold-start seed write). Mutations
  // stay admin-only (guarded below). Previously ensureAdmin gated GET too, so every
  // member dashboard 403'd here and SWR retried the failed call repeatedly.
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" });
  const isAdmin = hasRole(session.user.role, "admin");

  if (req.method === "GET") {
    let ptmTemplates = await prisma.badgeTemplate.findMany({
      where: { badge_type: "path_to_mastery" },
      orderBy: { sort_order: "asc" },
    });

    // Auto-seed defaults if none exist (cold start only) — admin reads trigger the
    // write; member reads just fall back to the in-memory defaults, never writing.
    if (ptmTemplates.length === 0) {
      if (isAdmin) {
        await prisma.badgeTemplate.createMany({ data: PTM_DEFAULTS });
        ptmTemplates = await prisma.badgeTemplate.findMany({
          where: { badge_type: "path_to_mastery" },
          orderBy: { sort_order: "asc" },
        });
      } else {
        return res.json({ path_to_mastery: PTM_DEFAULTS });
      }
    }

    if (!isAdmin) return res.json({ path_to_mastery: ptmTemplates });

    const customTemplates = await prisma.badgeTemplate.findMany({
      where: { badge_type: "custom" },
      orderBy: { created_at: "desc" },
    });
    return res.json({ path_to_mastery: ptmTemplates, custom: customTemplates });
  }

  if (!ensureAdmin(session, res)) return;

  if (req.method === "POST") {
    const { name, description, badge_type, icon, color, threshold_classes, sort_order } =
      req.body ?? {};
    if (!name || !badge_type) {
      return res.status(400).json({ error: "name and badge_type are required" });
    }
    const template = await prisma.badgeTemplate.create({
      data: {
        name,
        description: description ?? null,
        badge_type,
        icon: icon ?? "🏆",
        color: color ?? "#7C9070",
        threshold_classes: threshold_classes ?? null,
        sort_order: sort_order ?? 0,
      },
    });
    return res.status(201).json(template);
  }

  if (req.method === "PATCH") {
    const { id, name, description, icon, color, threshold_classes, sort_order, is_active } =
      req.body ?? {};
    if (!id) return res.status(400).json({ error: "id is required" });
    const template = await prisma.badgeTemplate.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(icon !== undefined && { icon }),
        ...(color !== undefined && { color }),
        ...(threshold_classes !== undefined && { threshold_classes }),
        ...(sort_order !== undefined && { sort_order }),
        ...(is_active !== undefined && { is_active }),
      },
    });
    return res.json(template);
  }

  if (req.method === "DELETE") {
    const id = typeof req.query.id === "string" ? req.query.id.trim() : "";
    if (!id) return res.status(400).json({ error: "id query param required" });
    await prisma.userBadge.deleteMany({ where: { badge_template_id: id } });
    await prisma.badgeTemplate.delete({ where: { id } });
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
