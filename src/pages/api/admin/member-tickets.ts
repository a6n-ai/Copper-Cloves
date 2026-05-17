import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { ensureAdmin } from "@/lib/requireAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  if (!ensureAdmin(session, res)) return;

  if (req.method === "GET") {
    const tickets = await prisma.memberTicket.findMany({
      orderBy: { created_at: "desc" },
      include: { profile: { select: { email: true, full_name: true, phone: true } } },
    });
    return res.json(tickets);
  }

  if (req.method === "PATCH") {
    const { id, status, admin_note } = req.body as { id: string; status?: string; admin_note?: string };
    if (!id) return res.status(400).json({ error: "id required" });
    const ticket = await prisma.memberTicket.update({
      where: { id },
      data: { ...(status && { status }), ...(admin_note !== undefined && { admin_note }) },
    });
    return res.json(ticket);
  }

  res.status(405).end();
}
