import type { NextApiRequest, NextApiResponse } from "next";
import { ensureAdmin } from "@/lib/requireAdmin";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";

const DAY = 24 * 60 * 60 * 1000;

// ISO-ish week key (year + week number) for bucketing recent messages by week.
function weekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((date.getTime() - firstThursday.getTime()) / DAY - 3) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!ensureAdmin(session, res)) return;
  if (req.method !== "GET") {
    res.status(405).end();
    return;
  }

  const now = Date.now();
  const since7d = new Date(now - 7 * DAY);
  const since8w = new Date(now - 56 * DAY);

  const [total, last7d, sent, activeTriggers, byChannelRaw, byStatusRaw, byTemplateRaw, recent] =
    await Promise.all([
      prisma.crmMessage.count(),
      prisma.crmMessage.count({ where: { created_at: { gte: since7d } } }),
      prisma.crmMessage.count({ where: { status: "sent" } }),
      prisma.crmTrigger.count({ where: { is_active: true } }),
      prisma.crmMessage.groupBy({ by: ["channel"], _count: { _all: true } }),
      prisma.crmMessage.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.crmMessage.groupBy({ by: ["template_id"], _count: { _all: true } }),
      prisma.crmMessage.findMany({
        where: { created_at: { gte: since8w } },
        select: { created_at: true },
      }),
    ]);

  // Resolve template names for the grouped template_ids.
  const templateIds = byTemplateRaw.map((t) => t.template_id).filter((id): id is string => !!id);
  const templates = templateIds.length
    ? await prisma.crmTemplate.findMany({
        where: { id: { in: templateIds } },
        select: { id: true, name: true },
      })
    : [];
  const nameById = new Map(templates.map((t) => [t.id, t.name]));

  const byChannel = byChannelRaw
    .map((c) => ({ channel: c.channel, count: c._count._all }))
    .sort((a, b) => b.count - a.count);

  const byStatus = byStatusRaw
    .map((s) => ({ status: s.status, count: s._count._all }))
    .sort((a, b) => b.count - a.count);

  const byTemplate = byTemplateRaw
    .map((t) => ({
      template: t.template_id ? nameById.get(t.template_id) ?? "Unknown" : "No template",
      count: t._count._all,
    }))
    .sort((a, b) => b.count - a.count);

  // Bucket the last 8 weeks of messages into ascending-week counts.
  const buckets = new Map<string, number>();
  for (const r of recent) {
    const k = weekKey(r.created_at);
    buckets.set(k, (buckets.get(k) ?? 0) + 1);
  }
  const overTime = Array.from(buckets.entries())
    .map(([week, count]) => ({ week, count }))
    .sort((a, b) => a.week.localeCompare(b.week));

  return res.json({
    total,
    last7d,
    deliveryRate: total > 0 ? Math.round((sent / total) * 100) : 0,
    activeTriggers,
    byChannel,
    byStatus,
    byTemplate,
    overTime,
  });
}
