import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";

function isAdmin(session: unknown) {
  const role = (session as { user?: { role?: string } } | null | undefined)?.user?.role;
  return role === "admin";
}

const STATUSES = new Set(["new", "contacted", "closed"]);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user || !isAdmin(session)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "GET") {
    const rows = await prisma.mealSubscriptionInquiry.findMany({
      orderBy: { created_at: "desc" },
      take: 500,
    });
    return res.json(rows);
  }

  if (req.method === "PATCH") {
    const { id, status } = req.body ?? {};
    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "id required" });
    }
    const s = String(status ?? "");
    if (!STATUSES.has(s)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    try {
      const updated = await prisma.mealSubscriptionInquiry.update({
        where: { id },
        data: { status: s },
      });
      return res.json(updated);
    } catch {
      return res.status(400).json({ error: "Could not update" });
    }
  }

  res.status(405).end();
}
