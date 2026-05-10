import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  const userId = (session.user as { id: string }).id;

  if (req.method === "GET") {
    const profile = await prisma.profile.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, full_name: true, phone: true,
        avatar_url: true, movement_streak: true, pass_type: true,
        created_at: true, updated_at: true,
      },
    });
    if (!profile) return res.status(404).json({ error: "Profile not found" });
    return res.json(profile);
  }

  if (req.method === "PATCH") {
    const { full_name, phone, avatar_url } = req.body;
    const profile = await prisma.profile.update({
      where: { id: userId },
      data: { full_name, phone, avatar_url },
      select: {
        id: true, email: true, full_name: true, phone: true,
        avatar_url: true, movement_streak: true, pass_type: true,
        created_at: true, updated_at: true,
      },
    });
    return res.json(profile);
  }

  res.status(405).end();
}
