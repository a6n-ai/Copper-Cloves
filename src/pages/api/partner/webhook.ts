import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { requirePartner } from "@/lib/partnerAuth";
import { PARTNER_WEBHOOK_EVENTS, generateWebhookSecret, webhookUrlProblem } from "@/lib/partnerWebhooks";

const RECENT = 20;

/**
 * The caller's webhook endpoint. GET (config + recent deliveries), PUT (set/replace),
 * DELETE (remove). The signing secret is returned only when it is created or rotated.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requirePartner(req, res);
  if (!auth) return;
  const partnerId = auth.partnerId;
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "GET") {
    const [hook, recent] = await Promise.all([
      prisma.partnerWebhook.findUnique({ where: { partner_id: partnerId } }),
      prisma.partnerWebhookEvent.findMany({
        where: { partner_id: partnerId },
        orderBy: { created_at: "desc" },
        take: RECENT,
        select: {
          id: true, type: true, booking_id: true, attempts: true, created_at: true,
          delivered_at: true, failed_at: true, next_attempt_at: true, last_status: true, last_error: true,
        },
      }),
    ]);
    return res.json({
      webhook: hook
        ? { url: hook.url, events: hook.events, isActive: hook.is_active, createdAt: hook.created_at, updatedAt: hook.updated_at }
        : null,
      availableEvents: PARTNER_WEBHOOK_EVENTS,
      recentDeliveries: recent.map((e) => ({
        id: e.id,
        type: e.type,
        bookingId: e.booking_id,
        createdAt: e.created_at,
        status: e.delivered_at ? "delivered" : e.failed_at ? "failed" : "pending",
        attempts: e.attempts,
        nextAttemptAt: e.delivered_at || e.failed_at ? null : e.next_attempt_at,
        lastResponseStatus: e.last_status,
        lastError: e.last_error,
      })),
    });
  }

  if (req.method === "PUT") {
    const { url, events, rotateSecret } = req.body ?? {};
    const problem = webhookUrlProblem(url);
    if (problem) return res.status(400).json({ error: problem });

    let chosen: string[] = [...PARTNER_WEBHOOK_EVENTS];
    if (events !== undefined) {
      if (!Array.isArray(events) || events.length === 0) {
        return res.status(400).json({ error: "events must be a non-empty array" });
      }
      const unknown = events.filter((e) => !(PARTNER_WEBHOOK_EVENTS as readonly unknown[]).includes(e));
      if (unknown.length) return res.status(400).json({ error: `unknown events: ${unknown.join(", ")}` });
      chosen = [...new Set(events as string[])];
    }

    const existing = await prisma.partnerWebhook.findUnique({ where: { partner_id: partnerId }, select: { id: true } });
    const newSecret = !existing || rotateSecret === true ? generateWebhookSecret() : null;
    const hook = await prisma.partnerWebhook.upsert({
      where: { partner_id: partnerId },
      create: { partner_id: partnerId, url, events: chosen, secret: newSecret ?? generateWebhookSecret() },
      update: { url, events: chosen, is_active: true, ...(newSecret ? { secret: newSecret } : {}) },
    });
    return res.status(existing ? 200 : 201).json({
      webhook: { url: hook.url, events: hook.events, isActive: hook.is_active, createdAt: hook.created_at, updatedAt: hook.updated_at },
      ...(newSecret ? { secret: newSecret } : {}),
    });
  }

  if (req.method === "DELETE") {
    await prisma.partnerWebhook.deleteMany({ where: { partner_id: partnerId } });
    return res.status(204).end();
  }

  return res.status(405).end();
}
