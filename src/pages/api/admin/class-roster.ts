import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  if ((session.user as { role?: string }).role !== "admin") return res.status(403).json({ error: "Forbidden" });
  if (req.method !== "GET") return res.status(405).end();

  const { scheduleId } = req.query;
  if (!scheduleId || typeof scheduleId !== "string") {
    return res.status(400).json({ error: "scheduleId required" });
  }

  const schedule = await prisma.classSchedule.findUnique({
    where: { id: scheduleId },
    select: {
      id: true,
      class_id: true,
      start_time: true,
      end_time: true,
      status: true,
      capacity: true,
      instructor_check_in_outcome: true,
      instructor_check_in_time: true,
      class_notes: true,
      class_model: { select: { name: true } },
      instructor: { select: { id: true, name: true } },
      actual_instructor: { select: { id: true, name: true } },
      bookings: {
        // Admin sees confirmed AND payment_pending (so they can remind / reconcile unpaid holds).
        where: { status: { in: ["confirmed", "payment_pending"] } },
        select: {
          id: true,
          user_id: true,
          status: true,
          checked_in: true,
          check_in_time: true,
          check_in_outcome: true,
          extra_guest_count: true,
          confirmation_status: true,
          hold_expires_at: true,
          invited_by_user_id: true,
          profile: { select: { full_name: true, email: true, avatar_url: true } },
        },
        orderBy: { created_at: "asc" },
      },
    },
  });

  if (!schedule) return res.status(404).json({ error: "Not found" });

  return res.json({
    scheduleId: schedule.id,
    classId: schedule.class_id,
    className: schedule.class_model?.name ?? "Class",
    instructor: schedule.instructor?.name ?? "—",
    instructorId: schedule.instructor?.id ?? null,
    actualInstructor: schedule.actual_instructor?.name ?? null,
    actualInstructorId: schedule.actual_instructor?.id ?? null,
    instructorCheckInOutcome: schedule.instructor_check_in_outcome ?? null,
    instructorCheckedIn: !!schedule.instructor_check_in_time,
    instructorCheckInTime: schedule.instructor_check_in_time?.toISOString() ?? null,
    classNotes: schedule.class_notes ?? null,
    startTime: schedule.start_time.toISOString(),
    endTime: schedule.end_time.toISOString(),
    status: schedule.status,
    capacity: schedule.capacity,
    bookings: schedule.bookings.map(b => ({
      id: b.id,
      userId: b.user_id,
      status: b.status,
      name: b.profile?.full_name || "Member",
      email: b.profile?.email ?? "",
      avatarUrl: b.profile?.avatar_url ?? null,
      checkedIn: b.checked_in,
      checkInTime: b.check_in_time?.toISOString() ?? null,
      checkInOutcome: b.check_in_outcome ?? null,
      extraGuests: b.extra_guest_count ?? 0,
      confirmationStatus: b.confirmation_status ?? null,
      holdExpiresAt: b.hold_expires_at?.toISOString() ?? null,
      // Group linkage by id only — every attendee is a row in this same list, so
      // the client derives "guest of X" / "brought Y" without duplicated names.
      invitedByUserId: b.invited_by_user_id ?? null,
    })),
  });
}