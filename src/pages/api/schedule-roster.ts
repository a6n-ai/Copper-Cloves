import type { NextApiRequest, NextApiResponse } from "next";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { startOfMondayWeekLocal, endOfSundayWeekLocal } from "@/lib/calendarWeek";
import { hasRole } from "@/lib/auth/roles";
import { getClassScheduleList } from "@/lib/classScheduleList";

function parseDate(v: unknown): Date | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Shared classes-with-roster list, scoped by role: partner is forced to their
 * own partner_id (no way to see another partner's roster); admin sees every
 * partner's classes, optionally narrowed with ?partnerId=. One query builder
 * (getClassScheduleList) backs both — no separate admin-only copy to drift.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const sess = await getStudioServerSession(req, res);
  const user = sess?.user as { role?: string; partner_id?: string | null } | undefined;
  if (!user) return res.status(401).json({ error: "Not authenticated" });

  let partnerId: string | undefined;
  if (hasRole(user.role, "partner")) {
    if (!user.partner_id) return res.status(401).json({ error: "Not authenticated" });
    partnerId = user.partner_id;
  } else if (hasRole(user.role, "admin")) {
    const q = req.query.partnerId;
    partnerId = typeof q === "string" && q.trim() ? q.trim() : undefined;
  } else {
    return res.status(403).json({ error: "Forbidden" });
  }

  const now = new Date();
  let rangeStart = parseDate(req.query.from);
  let rangeEnd = parseDate(req.query.to);
  if (!rangeStart || !rangeEnd) {
    rangeStart = startOfMondayWeekLocal(now);
    rangeEnd = endOfSundayWeekLocal(rangeStart);
  }
  if (rangeEnd.getTime() - rangeStart.getTime() > 1000 * 60 * 60 * 24 * 100) {
    rangeEnd = new Date(rangeStart.getTime() + 1000 * 60 * 60 * 24 * 100);
  }

  const result = await getClassScheduleList({ rangeStart, rangeEnd, partnerId });
  return res.json(result);
}
