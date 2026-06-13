import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { upsertFriendship } from "@/lib/friendship";
import { activeFriendIds, profilesToDtos } from "@/lib/friendQueries";
import logger from "@/lib/logger";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  const me = session?.user?.id;
  if (!me) return res.status(401).json({ error: "Unauthorized" });

  if (req.method === "GET") {
    const ids = await activeFriendIds(me);
    const dtos = await profilesToDtos(ids);
    const friends = ids.map((id) => dtos.get(id)).filter(Boolean);
    return res.status(200).json(friends);
  }

  if (req.method === "POST") {
    const { friendId } = req.body as { friendId?: string };
    if (!friendId) return res.status(400).json({ error: "friendId required" });
    if (friendId === me) return res.status(400).json({ error: "Can't friend yourself" });
    const target = await prisma.profile.findFirst({ where: { id: friendId, role: "user" }, select: { id: true } });
    if (!target) return res.status(404).json({ error: "Member not found" });
    try {
      await upsertFriendship(prisma, me, friendId, "manual", "request", me);
      return res.status(200).json({ ok: true });
    } catch (e) {
      logger.error({ err: e }, "[friends POST]");
      return res.status(500).json({ error: "Could not send request" });
    }
  }

  if (req.method === "DELETE") {
    const friendId = typeof req.query.friendId === "string" ? req.query.friendId : "";
    if (!friendId) return res.status(400).json({ error: "friendId required" });
    const [a, b] = me < friendId ? [me, friendId] : [friendId, me];
    await prisma.friendship.deleteMany({
      where: {
        user_a_id: a,
        user_b_id: b,
        OR: [
          { status: "active" },
          { status: "pending", requested_by_id: me },
        ],
      },
    });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
