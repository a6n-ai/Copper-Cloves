import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { startOfMondayWeekLocal, endOfSundayWeekLocal } from "@/lib/calendarWeek";
import { ROSTER_STATUSES } from "@/lib/bookingStatus";

function parseDate(v: unknown): Date | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const sess = await getStudioServerSession(req, res);
  const user = sess?.user as { role?: string; partner_id?: string | null } | undefined;
  if (!user || user.role !== "partner" || !user.partner_id) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  const partnerId = user.partner_id;

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

  // Only this partner's classes (instructor role would further scope to own classes later).
  const schedules = await prisma.classSchedule.findMany({
    where: {
      start_time: { gte: rangeStart, lte: rangeEnd },
      status: { not: "cancelled" },
      class_model: { is: { partner_id: partnerId } },
    },
    include: {
      class_model: true,
      instructor: { select: { name: true } },
      bookings: {
        // Roster = seat-holders (confirmed + unpaid holds); excludes released
        // (expired) and cancelled. Consistent with admin/instructor rosters.
        where: { status: { in: [...ROSTER_STATUSES] } },
        include: {
          profile: {
            select: { id: true, full_name: true, email: true, phone: true, avatar_url: true },
          },
        },
        orderBy: { booking_date: "asc" },
      },
    },
    orderBy: { start_time: "asc" },
  });

  // Which attendees have signed any waiver (one batch query).
  const attendeeIds = Array.from(
    new Set(schedules.flatMap((s) => s.bookings.map((b) => b.profile.id))),
  );
  const signedWaivers = attendeeIds.length
    ? await prisma.waiver.findMany({
        where: { user_id: { in: attendeeIds } },
        select: { user_id: true },
      })
    : [];
  const waiverSignedIds = new Set(signedWaivers.map((w) => w.user_id));

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
        phone: b.profile.phone ?? null,
        avatarUrl: b.profile.avatar_url ?? null,
        checkedIn: b.checked_in,
        checkInOutcome: b.check_in_outcome,
        extraGuests: b.extra_guest_count ?? 0,
        status: b.status,
        confirmationStatus: b.confirmation_status ?? null,
        hasWaiver: waiverSignedIds.has(b.profile.id),
      })),
    };
  });

  return res.json(result);
}
