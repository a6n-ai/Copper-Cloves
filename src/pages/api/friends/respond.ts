import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  const me = session?.user?.id;
  if (!me) return res.status(401).json({ error: "Unauthorized" });
  if (req.method !== "POST") return res.status(405).end();

  const { friendId, action } = req.body as { friendId?: string; action?: "accept" | "decline" };
  if (!friendId) return res.status(400).json({ error: "friendId required" });
  if (action !== "accept" && action !== "decline") return res.status(400).json({ error: "action must be accept|decline" });

  const [a, b] = me < friendId ? [me, friendId] : [friendId, me];
  const row = await prisma.friendship.findUnique({
    where: { user_a_id_user_b_id: { user_a_id: a, user_b_id: b } },
    select: { id: true, status: true, requested_by_id: true },
  });
  if (!row || row.status !== "pending") return res.status(404).json({ error: "No pending request" });
  if (row.requested_by_id === me) return res.status(403).json({ error: "You sent this request" });

  if (action === "accept") {
    await prisma.friendship.update({ where: { id: row.id }, data: { status: "active" } });
  } else {
    await prisma.friendship.delete({ where: { id: row.id } });
  }
  return res.status(200).json({ ok: true });
}
