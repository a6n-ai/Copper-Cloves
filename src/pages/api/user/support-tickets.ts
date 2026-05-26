import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";

const MIN_LEAD_MS = 72 * 60 * 60 * 1000;

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
    const { type = "pause_subscription", reason, attachment_url, pause_from, pause_to } = req.body as {
      type?: string;
      reason?: string;
      attachment_url?: string;
      pause_from?: string;
      pause_to?: string;
    };

    if (!reason?.trim()) {
      return res.status(400).json({ error: "Reason is required" });
    }

    let pauseFromDate: Date | null = null;
    let pauseToDate: Date | null = null;

    if (type === "pause_subscription") {
      if (!pause_from || !pause_to) {
        return res.status(400).json({ error: "Pause start and end dates are required" });
      }
      pauseFromDate = new Date(pause_from);
      pauseToDate = new Date(pause_to);
      if (Number.isNaN(pauseFromDate.getTime()) || Number.isNaN(pauseToDate.getTime())) {
        return res.status(400).json({ error: "Invalid date(s)" });
      }
      if (pauseToDate <= pauseFromDate) {
        return res.status(400).json({ error: "End date must be after start date" });
      }
      const minStart = Date.now() + MIN_LEAD_MS;
      if (pauseFromDate.getTime() < minStart) {
        return res.status(400).json({ error: "Start date must be at least 72 hours from now" });
      }

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
        pause_from: pauseFromDate,
        pause_to: pauseToDate,
      },
    });

    return res.status(201).json(ticket);
  }

  res.status(405).end();
}