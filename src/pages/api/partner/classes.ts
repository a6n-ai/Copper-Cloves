import type { NextApiRequest, NextApiResponse } from "next";
import { requirePartner } from "@/lib/partnerAuth";
import { startOfMondayWeekLocal, endOfSundayWeekLocal } from "@/lib/calendarWeek";
import { getClassScheduleList } from "@/lib/classScheduleList";

const MAX_RANGE_MS = 1000 * 60 * 60 * 24 * 100;

function parseDate(v: unknown): Date | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * The caller's own classes with rosters (booking ids feed POST /api/partner/booking-action).
 * Same builder as /api/schedule-roster, but partner-only so an API key can never
 * reach the admin "all partners" branch.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const auth = await requirePartner(req, res);
  if (!auth) return;

  let rangeStart = parseDate(req.query.from);
  let rangeEnd = parseDate(req.query.to);
  if (!rangeStart || !rangeEnd) {
    rangeStart = startOfMondayWeekLocal(new Date());
    rangeEnd = endOfSundayWeekLocal(rangeStart);
  }
  if (rangeEnd < rangeStart) return res.status(400).json({ error: "to must be after from" });
  if (rangeEnd.getTime() - rangeStart.getTime() > MAX_RANGE_MS) {
    rangeEnd = new Date(rangeStart.getTime() + MAX_RANGE_MS);
  }

  const classes = await getClassScheduleList({ rangeStart, rangeEnd, partnerId: auth.partnerId });
  return res.json(classes);
}
