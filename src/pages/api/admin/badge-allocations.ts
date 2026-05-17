import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { ensureAdmin } from "@/lib/requireAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!ensureAdmin(session, res)) return;

  const adminId = (session?.user as { id: string } | undefined)?.id ?? "";

  if (req.method === "GET") {
    const templateId =
      typeof req.query.template_id === "string" ? req.query.template_id.trim() : "";
    const userId = typeof req.query.user_id === "string" ? req.query.user_id.trim() : "";

    if (templateId) {
      const allocations = await prisma.userBadge.findMany({
        where: { badge_template_id: templateId },
        include: { profile: { select: { id: true, full_name: true, email: true } } },
        orderBy: { earned_at: "desc" },
      });
      return res.json(allocations);
    }

    if (userId) {
      const badges = await prisma.userBadge.findMany({
        where: { user_id: userId },
        include: { badge_template: true },
        orderBy: { earned_at: "desc" },
      });
      return res.json(badges);
    }

    return res.status(400).json({ error: "template_id or user_id query param required" });
  }

  if (req.method === "POST") {
    const { user_id, badge_template_id } = req.body ?? {};
    if (!user_id || !badge_template_id) {
      return res.status(400).json({ error: "user_id and badge_template_id are required" });
    }

    const template = await prisma.badgeTemplate.findUnique({ where: { id: badge_template_id } });
    if (!template) return res.status(404).json({ error: "Badge template not found" });

    const existing = await prisma.userBadge.findFirst({
      where: { user_id, badge_template_id },
    });
    if (existing) return res.status(409).json({ error: "Badge already allocated to this user" });

    const badge = await prisma.userBadge.create({
      data: {
        user_id,
        badge_template_id,
        badge_name: template.name,
        badge_description: template.description ?? null,
        badge_type: "custom",
        icon: template.icon,
        color: template.color,
        allocated_by: adminId,
      },
    });
    return res.status(201).json(badge);
  }

  if (req.method === "DELETE") {
    const { badge_id } = req.body ?? {};
    if (!badge_id) return res.status(400).json({ error: "badge_id is required" });
    await prisma.userBadge.delete({ where: { id: badge_id } });
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
