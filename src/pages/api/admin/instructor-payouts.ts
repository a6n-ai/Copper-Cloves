import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";

const CHECKIN_RATE_INR = 150;
const DEFAULT_STUDIO_CUT_PERCENT = 40;

/** Check-ins per instructor in the rolling window (from confirmed bookings where member checked in). */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  const role = (session.user as { role?: string }).role;
  if (role !== "admin") return res.status(403).json({ error: "Forbidden" });
  if (req.method !== "GET") return res.status(405).end();

  const windowParam = typeof req.query.window === "string" ? req.query.window : "month";
  const since = new Date();
  if (windowParam === "week") since.setDate(since.getDate() - 7);
  else since.setMonth(since.getMonth() - 1);

  const rows = await prisma.booking.findMany({
    where: {
      checked_in: true,
      booking_date: { gte: since },
      class_schedule: { instructor_id: { not: null } },
    },
    select: {
      id: true,
      class_schedule: {
        select: {
          instructor_id: true,
          instructor: {
            select: {
              id: true,
              name: true,
              specialties: true,
              studio_payout_cut_percent: true,
            },
          },
        },
      },
    },
  });

  const tally = new Map<string, { name: string; specialties: string; count: number }>();
  for (const b of rows) {
    const ins = b.class_schedule?.instructor;
    const iid = b.class_schedule?.instructor_id;
    if (!ins || !iid) continue;
    const prev = tally.get(iid);
    const spec = (ins.specialties?.slice(0, 2).join(", ") || "Classes") as string;
    if (prev) prev.count += 1;
    else tally.set(iid, { name: ins.name, specialties: spec, count: 1 });
  }

  const instructors = [...tally.entries()].map(([id, v], idx) => {
    const instructorRow = rows.find((b) => b.class_schedule?.instructor_id === id)?.class_schedule
      ?.instructor;
    const studioCutRaw = instructorRow?.studio_payout_cut_percent;
    const studioCut = studioCutRaw != null ? Number(studioCutRaw) : DEFAULT_STUDIO_CUT_PERCENT;
    const instructorPct = Math.max(
      0,
      Math.min(100, 100 - (Number.isFinite(studioCut) ? studioCut : DEFAULT_STUDIO_CUT_PERCENT))
    );
    const gross = v.count * CHECKIN_RATE_INR;
    const total = Math.round((gross * instructorPct) / 100);
    return {
      id: idx + 1,
      instructorId: id,
      name: v.name,
      specialties: v.specialties,
      checkIns: v.count,
      rate: CHECKIN_RATE_INR,
      total,
      percentage: instructorPct,
      studioCutPercent: Number.isFinite(studioCut) ? studioCut : DEFAULT_STUDIO_CUT_PERCENT,
      status: "pending" as const,
    };
  });

  instructors.sort((a, b) => b.checkIns - a.checkIns);

  const grossTotal = instructors.reduce((s, i) => s + i.total, 0);
  const pendingCount = instructors.filter((i) => i.total > 0).length;

  return res.json({
    summary: {
      totalPayouts: grossTotal,
      pendingPayments: grossTotal,
      completedPayments: 0,
      totalCheckIns: instructors.reduce((s, i) => s + i.checkIns, 0),
      instructorsCount: instructors.length,
      pendingCount,
    },
    instructors,
  });
}
