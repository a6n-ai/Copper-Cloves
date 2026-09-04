import prisma from "@/lib/prisma";
import { ROSTER_STATUSES } from "@/lib/bookingStatus";

/**
 * Canonical "classes + roster for a date range" query. Partner dashboard/classes
 * pages and any future admin range view should both call this — previously each
 * surface (admin class-roster, admin today-classes, partner classes) built its own
 * booking projection and they drifted (partner was missing refund_status /
 * hold_expires_at that admin's single-schedule roster already had).
 */
export interface ClassScheduleListParams {
  rangeStart: Date;
  rangeEnd: Date;
  /** Scope to one partner's classes. Omit for the all-classes (admin) view. */
  partnerId?: string;
}

export async function getClassScheduleList({ rangeStart, rangeEnd, partnerId }: ClassScheduleListParams) {
  const schedules = await prisma.classSchedule.findMany({
    where: {
      start_time: { gte: rangeStart, lte: rangeEnd },
      status: { not: "cancelled" },
      ...(partnerId ? { class_model: { is: { partner_id: partnerId } } } : {}),
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

  return schedules.map((s) => {
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
        userId: b.user_id,
        refundStatus: b.refund_status ?? null,
        holdExpiresAt: b.hold_expires_at?.toISOString() ?? null,
        // Group linkage by id only — client derives grouping from co-present rows.
        invitedByUserId: b.invited_by_user_id ?? null,
      })),
    };
  });
}
