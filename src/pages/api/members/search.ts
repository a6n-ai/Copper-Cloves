import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { FRIEND_DTO_SELECT, toFriendDto } from "@/lib/friendQueries";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await getStudioServerSession(req, res);
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" });

  const raw = typeof req.query.q === "string" ? req.query.q.trim() : "";
  // "@priya" searches the handle; the @ is display sugar, not part of it.
  const q = raw.replace(/^@+/, "");
  if (!q || q.length < 2) return res.status(200).json([]);

  // Name or username ONLY. Any member can call this, so matching on email or
  // phone would let them probe whether a given address/number is a member —
  // and returning either would hand it to them outright.
  const results = await prisma.profile.findMany({
    where: {
      role: "user",
      id: { not: session.user.id },
      OR: [
        { full_name: { contains: q, mode: "insensitive" } },
        { identity: { username: { startsWith: q.toLowerCase() } } },
      ],
    },
    select: FRIEND_DTO_SELECT,
    take: 8,
  });

  return res.status(200).json(results.map(toFriendDto));
}
