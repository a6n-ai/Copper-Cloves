import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getInstructorSession } from "@/lib/instructorAuth";
import { ROSTER_STATUSES } from "@/lib/bookingStatus";
import { startOfDay } from "date-fns";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await getInstructorSession(req, res);
  if (!session) return res.status(401).json({ error: "Not authenticated" });

  const now = new Date();
  // SCOPE NOTE (schedule "today" windows are intentionally per-surface, not one shared window):
  //   • this endpoint = today + next 6 days (rolling week) — the instructor dashboard groups by day.
  //   • partner/classes = Mon–Sun calendar week.
  //   • admin dashboard today-card = literally today only.
  // Despite the filename, this returns a rolling week by design.
  const weekEnd = new Date(startOfDay(now));
  weekEnd.setDate(weekEnd.getDate() + 7);
  weekEnd.setHours(23, 59, 59, 999);

  const schedules = await prisma.classSchedule.findMany({
    where: {
      instructor_id: session.instructorId,
      start_time: { gte: startOfDay(now), lte: weekEnd },
      status: { not: "cancelled" },
    },
    include: {
      class_model: true,
      bookings: {
        // Roster = seat-holders (confirmed + unpaid holds); excludes released
        // (expired) and cancelled. Consistent with admin/partner rosters.
        where: { status: { in: [...ROSTER_STATUSES] } },
        include: {
          profile: { select: { id: true, full_name: true, email: true, avatar_url: true } },
        },
        orderBy: { booking_date: "asc" },
      },
    },
    orderBy: { start_time: "asc" },
  });

  const result = schedules.map((s) => ({
    id: s.id,
    className: s.class_model?.name ?? "Class",
    category: s.class_model?.category ?? "",
    startTime: s.start_time,
    endTime: s.end_time,
    capacity: s.capacity ?? s.available_spots + s.current_bookings,
    enrolled: s.current_bookings,
    availableSpots: s.available_spots,
    status: s.status,
    instructorCheckedIn: !!s.instructor_check_in_time,
    instructorCheckInTime: s.instructor_check_in_time ?? null,
    bookings: s.bookings.map((b) => ({
      id: b.id,
      memberName: b.profile.full_name ?? b.profile.email ?? "Guest",
      email: b.profile.email,
      avatarUrl: b.profile.avatar_url ?? null,
      checkedIn: b.checked_in,
      checkInTime: b.check_in_time,
      checkInOutcome: b.check_in_outcome,
      extraGuests: b.extra_guest_count,
      status: b.status,
      userId: b.user_id,
      // Group linkage by id only — client derives grouping from co-present rows.
      invitedByUserId: b.invited_by_user_id ?? null,
    })),
  }));

  return res.json(result);
}
