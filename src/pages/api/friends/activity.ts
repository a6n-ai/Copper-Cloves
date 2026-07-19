import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { activeFriendIds } from "@/lib/friendQueries";
import { ROSTER_STATUSES } from "@/lib/bookingStatus";
import { HIDDEN_SCHEDULE_STATUSES } from "@/lib/scheduleStatus";
import { mapFriendActivity } from "@/lib/friendActivity";
import logger from "@/lib/logger";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await getStudioServerSession(req, res);
  const me = session?.user?.id;
  if (!me) return res.status(401).json({ error: "Unauthorized" });

  try {
    const friendIds = await activeFriendIds(me);
    if (friendIds.length === 0) return res.status(200).json([]);

    const rows = await prisma.booking.findMany({
      where: {
        user_id: { in: friendIds },
        status: { in: [...ROSTER_STATUSES] },
        class_schedule: {
          start_time: { gt: new Date() },
          status: { notIn: [...HIDDEN_SCHEDULE_STATUSES] },
        },
      },
      select: {
        user_id: true,
        profile: { select: { id: true, full_name: true, avatar_url: true } },
        class_schedule: {
          select: { id: true, start_time: true, class_model: { select: { name: true } } },
        },
      },
      orderBy: { class_schedule: { start_time: "asc" } },
      take: 50,
    });

    const mappedRows = rows.map((r) => ({
      user_id: r.user_id,
      profile: r.profile ? { id: r.profile.id, name: r.profile.full_name, avatar_url: r.profile.avatar_url } : null,
      class_schedule: r.class_schedule,
    }));

    return res.status(200).json(mapFriendActivity(mappedRows));
  } catch (e) {
    logger.error({ err: e }, "[friends activity GET]");
    return res.status(500).json({ error: "Could not load activity" });
  }
}
