import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { profilesToDtos } from "@/lib/friendQueries";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  const me = session?.user?.id;
  if (!me) return res.status(401).json({ error: "Unauthorized" });
  if (req.method !== "GET") return res.status(405).end();

  const rows = await prisma.friendship.findMany({
    where: { status: "pending", OR: [{ user_a_id: me }, { user_b_id: me }] },
    select: { user_a_id: true, user_b_id: true, requested_by_id: true },
  });

  const counterpartIds = rows.map((r) => (r.user_a_id === me ? r.user_b_id : r.user_a_id));
  const dtos = await profilesToDtos(counterpartIds);

  const incoming: unknown[] = [];
  const outgoing: unknown[] = [];
  for (const r of rows) {
    const otherId = r.user_a_id === me ? r.user_b_id : r.user_a_id;
    const dto = dtos.get(otherId);
    if (!dto) continue;
    if (r.requested_by_id === me) outgoing.push(dto);
    else incoming.push(dto);
  }

  return res.status(200).json({ incoming, outgoing });
}
