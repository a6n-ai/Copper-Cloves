import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  const userId = (session.user as { id: string }).id;

  if (req.method === "GET") {
    const tickets = await prisma.memberTicket.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
    });
    return res.json(tickets);
  }

  if (req.method === "POST") {
    const { type = "pause_subscription", reason, attachment_url } = req.body as {
      type?: string;
      reason?: string;
      attachment_url?: string;
    };

    if (!reason?.trim()) {
      return res.status(400).json({ error: "Reason is required" });
    }

    // One open pause ticket at a time
    if (type === "pause_subscription") {
      const existing = await prisma.memberTicket.findFirst({
        where: { user_id: userId, type: "pause_subscription", status: { in: ["open", "in_review"] } },
      });
      if (existing) {
        return res.status(409).json({ error: "You already have a pending pause request. We'll reach out soon." });
      }
    }

    const ticket = await prisma.memberTicket.create({
      data: {
        user_id: userId,
        type,
        reason: reason.trim(),
        attachment_url: attachment_url?.trim() || null,
      },
    });

    return res.status(201).json(ticket);
  }

  res.status(405).end();
}
