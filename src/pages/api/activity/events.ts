import type { NextApiRequest, NextApiResponse } from "next";
import type { IncomingMessage } from "http";
import prisma from "@/lib/prisma";
import type { Prisma } from "../../../generated/prisma/client";
import { getStudioServerSession } from "@/lib/getStudioServerSession";

function getClientIp(req: IncomingMessage): string | null {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string") return xf.split(",")[0]?.trim() || null;
  if (Array.isArray(xf)) return xf[0] || null;
  return req.socket?.remoteAddress ?? null;
}

const MAX_EVENTS = 50;

type IncomingEvent = {
  event_name: string;
  event_category?: string;
  path?: string;
  referrer?: string;
  entity_type?: string;
  entity_id?: string;
  metadata?: Record<string, unknown>;
  duration_ms?: number;
  client_occurred_at?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }

  const session = await getStudioServerSession(req, res);
  const profileId = session?.user ? (session.user as { id: string }).id : null;
  const role = session?.user ? ((session.user as { role?: string }).role ?? "user") : "guest";

  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const visitorId: unknown = body?.visitor_id;
  const sessionId: unknown = body?.session_id;
  const eventsUnknown: unknown = body?.events;

  if (typeof visitorId !== "string" || visitorId.length < 8 || visitorId.length > 64) {
    return res.status(400).json({ error: "Invalid or missing visitor_id" });
  }

  if (!Array.isArray(eventsUnknown) || eventsUnknown.length === 0) {
    return res.status(400).json({ error: "events must be a non-empty array" });
  }

  if (eventsUnknown.length > MAX_EVENTS) {
    return res.status(400).json({ error: `Maximum ${MAX_EVENTS} events per request` });
  }

  const ip = getClientIp(req);
  const userAgent =
    typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null;

  let dbSessionId: string | null = null;
  if (typeof sessionId === "string" && sessionId.length >= 8 && sessionId.length <= 64) {
    const existing = await prisma.userActivitySession.findFirst({
      where: { id: sessionId },
    });
    if (existing) {
      dbSessionId = existing.id;
      await prisma.userActivitySession.update({
        where: { id: existing.id },
        data: {
          profile_id: profileId ?? existing.profile_id,
          role: role ?? existing.role,
          last_seen_at: new Date(),
        },
      });
    }
  }

  if (!dbSessionId) {
    const createdSession = await prisma.userActivitySession.create({
      data: {
        visitor_id: visitorId,
        profile_id: profileId ?? undefined,
        role,
        ip: ip ?? undefined,
        user_agent: userAgent ?? undefined,
      },
    });
    dbSessionId = createdSession.id;
  }

  const normalized: IncomingEvent[] = eventsUnknown.map((e: unknown) => {
    if (!e || typeof e !== "object") throw new Error("invalid event");
    const o = e as Record<string, unknown>;
    if (typeof o.event_name !== "string" || o.event_name.length === 0) {
      throw new Error("each event requires event_name");
    }
    return {
      event_name: o.event_name.slice(0, 120),
      event_category:
        typeof o.event_category === "string" ? o.event_category.slice(0, 64) : "general",
      path: typeof o.path === "string" ? o.path.slice(0, 2048) : undefined,
      referrer: typeof o.referrer === "string" ? o.referrer.slice(0, 2048) : undefined,
      entity_type: typeof o.entity_type === "string" ? o.entity_type.slice(0, 120) : undefined,
      entity_id: typeof o.entity_id === "string" ? o.entity_id.slice(0, 120) : undefined,
      metadata:
        o.metadata && typeof o.metadata === "object" && !Array.isArray(o.metadata)
          ? (o.metadata as Record<string, unknown>)
          : undefined,
      duration_ms: typeof o.duration_ms === "number" ? Math.floor(o.duration_ms) : undefined,
      client_occurred_at:
        typeof o.client_occurred_at === "string" ? o.client_occurred_at : undefined,
    };
  });

  await prisma.$transaction(
    normalized.map((ev) =>
      prisma.userActivityEvent.create({
        data: {
          session_id: dbSessionId,
          visitor_id: visitorId,
          profile_id: profileId ?? undefined,
          role_at_time: role,
          event_name: ev.event_name,
          event_category: ev.event_category ?? "general",
          path: ev.path,
          referrer: ev.referrer,
          entity_type: ev.entity_type,
          entity_id: ev.entity_id,
          metadata: ev.metadata as Prisma.InputJsonValue | undefined,
          duration_ms: ev.duration_ms,
          client_occurred_at: ev.client_occurred_at
            ? new Date(ev.client_occurred_at)
            : undefined,
        },
      })
    )
  );

  return res.status(201).json({ ok: true, session_id: dbSessionId });
}
