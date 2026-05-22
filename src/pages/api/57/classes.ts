import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getP57Session } from "@/lib/p57Auth";
import { startOfMondayWeekLocal, endOfSundayWeekLocal } from "@/lib/calendarWeek";

function parseDate(v: unknown): Date | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const session = getP57Session(req);
  if (!session) return res.status(401).json({ error: "Not authenticated" });

  // Range comes from the client (week or month being viewed). Defaults to the
  // current Monday-based week when not provided.
  const now = new Date();
  let rangeStart = parseDate(req.query.from);
  let rangeEnd = parseDate(req.query.to);
  if (!rangeStart || !rangeEnd) {
    rangeStart = startOfMondayWeekLocal(now);
    rangeEnd = endOfSundayWeekLocal(rangeStart);
  }
  // Cap the span to ~3 months to keep the query bounded.
  if (rangeEnd.getTime() - rangeStart.getTime() > 1000 * 60 * 60 * 24 * 100) {
    rangeEnd = new Date(rangeStart.getTime() + 1000 * 60 * 60 * 24 * 100);
  }

  // Physique 57 classes are identified by "57" in the class name
  // (Barre 57, Mat 57, FIT 57, Barre 57 Express, …).
  const schedules = await prisma.classSchedule.findMany({
    where: {
      start_time: { gte: rangeStart, lte: rangeEnd },
      status: { not: "cancelled" },
      class_model: { is: { name: { contains: "57" } } },
    },
    include: {
      class_model: true,
      instructor: { select: { name: true } },
      bookings: {
        where: { status: { not: "cancelled" } },
        include: {
          profile: { select: { id: true, full_name: true, email: true, avatar_url: true } },
        },
        orderBy: { booking_date: "asc" },
      },
    },
    orderBy: { start_time: "asc" },
  });

  const result = schedules.map((s) => {
    const capacity = s.capacity ?? s.available_spots + s.current_bookings;
    const signups = s.bookings.reduce((n, b) => n + 1 + (b.extra_guest_count ?? 0), 0);
    return {
      id: s.id,
      className: s.class_model?.name ?? "Class",
      category: s.class_model?.category ?? "",
      instructorName: s.instructor?.name ?? "—",
      startTime: s.start_time,
      endTime: s.end_time,
      capacity,
      signups,
      openSpots: Math.max(0, capacity - signups),
      checkedInCount: s.bookings.filter((b) => b.checked_in).length,
      status: s.status,
      bookings: s.bookings.map((b) => ({
        id: b.id,
        memberName: b.profile.full_name ?? b.profile.email ?? "Guest",
        email: b.profile.email,
        avatarUrl: b.profile.avatar_url ?? null,
        checkedIn: b.checked_in,
        checkInOutcome: b.check_in_outcome,
        extraGuests: b.extra_guest_count ?? 0,
      })),
    };
  });

  return res.json(result);
}
