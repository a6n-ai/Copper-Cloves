import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";

/** Admin-only: paginated raw activity feed for analysis / exports. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  const role = (session.user as { role?: string }).role;
  if (role !== "admin") return res.status(403).json({ error: "Forbidden" });

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end();
  }

  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
  const profileId = typeof req.query.profile_id === "string" ? req.query.profile_id : undefined;
  const visitorId = typeof req.query.visitor_id === "string" ? req.query.visitor_id : undefined;
  const eventName = typeof req.query.event_name === "string" ? req.query.event_name : undefined;

  const where = {
    ...(profileId ? { profile_id: profileId } : {}),
    ...(visitorId ? { visitor_id: visitorId } : {}),
    ...(eventName ? { event_name: eventName } : {}),
  };

  const items = await prisma.userActivityEvent.findMany({
    where,
    orderBy: { created_at: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      profile: { select: { email: true, full_name: true } },
      session: true,
    },
  });

  const hasMore = items.length > limit;
  const slice = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? slice[slice.length - 1]?.id : null;

  return res.json({
    items: slice,
    next_cursor: nextCursor,
  });
}
