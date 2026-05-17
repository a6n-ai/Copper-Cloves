import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { ensureAdmin } from "@/lib/requireAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!ensureAdmin(session, res)) return;

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!q) return res.json([]);

  const members = await prisma.profile.findMany({
    where: {
      role: { not: "admin" },
      OR: [
        { full_name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, full_name: true, email: true },
    take: 10,
    orderBy: { full_name: "asc" },
  });

  return res.json(members);
}
