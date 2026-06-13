import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await getStudioServerSession(req, res);
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" });

  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!q || q.length < 2) return res.status(200).json([]);

  const results = await prisma.profile.findMany({
    where: {
      role: "user",
      id: { not: session.user.id },
      OR: [
        { full_name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
        { whatsapp_phone: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, full_name: true, email: true, phone: true, avatar_url: true },
    take: 8,
  });

  return res.status(200).json(
    results.map((r) => ({
      id: r.id,
      name: r.full_name ?? r.email,
      email: r.email,
      phone: r.phone ?? null,
      avatar_url: r.avatar_url ?? null,
    })),
  );
}
