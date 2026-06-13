import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { activeFriendIds, excludedIds, profilesToDtos } from "@/lib/friendQueries";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  const me = session?.user?.id;
  if (!me) return res.status(401).json({ error: "Unauthorized" });
  if (req.method !== "GET") return res.status(405).end();

  const myFriends = await activeFriendIds(me);
  if (myFriends.length === 0) return res.status(200).json([]);

  // Active friendships touching any of my friends → their counterparts (FoF candidates).
  const rows = await prisma.friendship.findMany({
    where: { status: "active", OR: [{ user_a_id: { in: myFriends } }, { user_b_id: { in: myFriends } }] },
    select: { user_a_id: true, user_b_id: true },
  });

  const exclude = await excludedIds(me);            // self + my pending/blocked
  for (const id of myFriends) exclude.add(id);      // already-friends
  const myFriendSet = new Set(myFriends);

  // candidateId → set of MY friends who connect to them (size = mutual count)
  const mutual = new Map<string, Set<string>>();
  const link = (candidate: string, via: string) => {
    let s = mutual.get(candidate);
    if (!s) { s = new Set<string>(); mutual.set(candidate, s); }
    s.add(via);
  };
  for (const r of rows) {
    const aIsMine = myFriendSet.has(r.user_a_id);
    const bIsMine = myFriendSet.has(r.user_b_id);
    if (aIsMine && !exclude.has(r.user_b_id)) link(r.user_b_id, r.user_a_id);
    if (bIsMine && !exclude.has(r.user_a_id)) link(r.user_a_id, r.user_b_id);
  }

  const ranked = [...mutual.entries()]
    .map(([id, viaSet]) => ({ id, mutualCount: viaSet.size }))
    .sort((x, y) => y.mutualCount - x.mutualCount)
    .slice(0, 10);

  const dtos = await profilesToDtos(ranked.map((r) => r.id));
  const result = ranked
    .map((r) => { const d = dtos.get(r.id); return d ? { ...d, mutualCount: r.mutualCount } : null; })
    .filter(Boolean);

  return res.status(200).json(result);
}
