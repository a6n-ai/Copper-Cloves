import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  const me = session?.user?.id;
  if (!me) return res.status(401).json({ error: "Unauthorized" });
  if (req.method !== "POST") return res.status(405).end();

  const { friendId } = req.body as { friendId?: string };
  if (!friendId) return res.status(400).json({ error: "friendId required" });
  if (friendId === me) return res.status(400).json({ error: "Can't block yourself" });

  const target = await prisma.profile.findFirst({ where: { id: friendId, role: "user" }, select: { id: true } });
  if (!target) return res.status(404).json({ error: "Member not found" });

  const [a, b] = me < friendId ? [me, friendId] : [friendId, me];
  await prisma.friendship.upsert({
    where: { user_a_id_user_b_id: { user_a_id: a, user_b_id: b } },
    update: { status: "blocked", blocked_by_id: me, requested_by_id: null },
    create: { user_a_id: a, user_b_id: b, status: "blocked", blocked_by_id: me, source: "manual" },
  });
  return res.status(200).json({ ok: true });
}
