import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { verifyCheckinToken } from "@/lib/checkinToken";
import { withinCheckinWindow } from "@/lib/checkinWindow";
import { getInstructorSession } from "@/lib/instructorAuth";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { hasRole } from "@/lib/auth/roles";
import { checkInOutcomeFromTimes } from "@/lib/bookingAttendance";
import { OCCUPYING_STATUSES, ROSTER_STATUSES } from "@/lib/bookingStatus";
import { reconcileScheduleSeats } from "@/lib/seatCounts";
import { logActivity } from "@/lib/activityLog";
import { requestLogger } from "@/lib/logger";
import { awardPtmBadges } from "@/lib/awardPtmBadges";

type ScanLog = ReturnType<typeof requestLogger>;
type ScanSchedule = NonNullable<Awaited<ReturnType<typeof loadSchedule>>>;

const KIND_INSTRUCTOR = "instructor" as const;
const KIND_MEMBER = "member" as const;

function loadSchedule(scheduleId: string) {
  return prisma.classSchedule.findUnique({
    where: { id: scheduleId },
    select: {
      id: true,
      instructor_id: true,
      start_time: true,
      status: true,
      capacity: true,
      instructor_check_in_time: true,
      class_model: { select: { name: true, max_capacity: true } },
    },
  });
}

/**
 * The QR beacon rotates to whatever class is inside its ±30m window, so a member
 * who scans a few minutes after their own window closed gets the NEXT class's
 * token. Surface the booking they most likely meant so the UI can offer that
 * instead of silently selling them a walk-in seat.
 */
const NEARBY_BOOKING_MS = 3 * 60 * 60 * 1000;

async function findIntendedBooking(userId: string, now: Date) {
  const row = await prisma.booking.findFirst({
    where: {
      user_id: userId,
      checked_in: false,
      status: { in: [...ROSTER_STATUSES] },
      class_schedule: {
        status: { not: "cancelled" },
        start_time: {
          gte: new Date(now.getTime() - NEARBY_BOOKING_MS),
          lte: new Date(now.getTime() + NEARBY_BOOKING_MS),
        },
      },
    },
    select: {
      id: true,
      class_schedule: {
        select: { id: true, start_time: true, class_model: { select: { name: true } } },
      },
    },
    orderBy: { class_schedule: { start_time: "asc" } },
  });
  if (!row?.class_schedule) return null;
  return {
    bookingId: row.id,
    scheduleId: row.class_schedule.id,
    className: row.class_schedule.class_model?.name ?? "your class",
    startTime: row.class_schedule.start_time.toISOString(),
  };
}

async function handleInstructorScan(
  req: NextApiRequest,
  res: NextApiResponse,
  schedule: ScanSchedule,
  log: ScanLog,
) {
  const inst = await getInstructorSession(req, res);
  if (!inst) return res.status(401).json({ error: "Sign in as instructor first" });
  if (schedule.instructor_id !== inst.instructorId) {
    log.warn({ instructorId: inst.instructorId, scheduleId: schedule.id }, "instructor wrong class");
    return res.status(403).json({ error: "This is not your class" });
  }
  if (schedule.instructor_check_in_time)
    return res.json({ ok: true, kind: KIND_INSTRUCTOR, status: "already" });
  await prisma.classSchedule.update({
    where: { id: schedule.id },
    data: { instructor_check_in_time: new Date() },
  });
  log.info({ instructorId: inst.instructorId, scheduleId: schedule.id }, "instructor checked in");
  return res.json({ ok: true, kind: KIND_INSTRUCTOR, status: "checked_in" });
}

// Walk-in: need an active, non-expired pass. Unlimited → book without decrement;
// credit pass → decrement one credit. Returns null if a pass is available.
async function findWalkInPackageId(
  userId: string,
  scheduleId: string,
  now: Date,
  log: ScanLog,
): Promise<{ blocked: boolean; usePackageId?: string | null }> {
  const activePackages = await prisma.userPackage.findMany({
    where: { user_id: userId, is_active: true, expiration_date: { gt: now } },
    include: { package_type: { select: { is_unlimited: true } } },
    orderBy: { expiration_date: "asc" },
  });
  const unlimited = activePackages.find((p) => p.package_type?.is_unlimited);
  const creditPass = activePackages.find(
    (p) => !p.package_type?.is_unlimited && (p.credits_remaining ?? 0) >= 1,
  );
  if (!unlimited && !creditPass) {
    log.warn({ userId, scheduleId }, "walk-in blocked no pass");
    return { blocked: true };
  }
  return { blocked: false, usePackageId: unlimited ? null : (creditPass?.id ?? null) };
}

async function commitWalkIn(args: {
  userId: string;
  schedule: ScanSchedule;
  now: Date;
  usePackageId: string | null;
}) {
  const { userId, schedule, now, usePackageId } = args;
  return prisma.$transaction(async (tx) => {
    if (usePackageId) {
      const upd = await tx.userPackage.updateMany({
        where: { id: usePackageId, user_id: userId, credits_remaining: { gte: 1 } },
        data: { credits_remaining: { decrement: 1 } },
      });
      if (upd.count !== 1) throw new Error("NO_CREDITS");
    }
    const created = await tx.booking.create({
      data: {
        user_id: userId,
        class_schedule_id: schedule.id,
        user_package_id: usePackageId,
        status: "confirmed",
        booking_date: now,
        // Denormalised copies every other create path writes — without them the
        // walk-in row renders blank in the portal and admin class history.
        class_name: schedule.class_model?.name ?? null,
        class_time: schedule.start_time.toISOString(),
        checked_in: true,
        check_in_time: now,
        check_in_outcome: checkInOutcomeFromTimes(schedule.start_time, now),
      },
    });
    // Recompute from live rows (the just-created booking included) so counters stay
    // consistent with every other surface — never an optimistic seatsTaken+1.
    await reconcileScheduleSeats(schedule.id, tx);
    return created.id;
  });
}

async function handleMemberScan(
  req: NextApiRequest,
  res: NextApiResponse,
  schedule: ScanSchedule,
  log: ScanLog,
) {
  const { confirm } = req.body as { confirm?: boolean };
  const session = await getStudioServerSession(req, res);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || !hasRole(user.role, "user"))
    return res.status(401).json({ error: "Sign in as a member first" });
  const userId = user.id;

  const now = new Date();
  const existing = await prisma.booking.findFirst({
    where: { user_id: userId, class_schedule_id: schedule.id, status: { not: "cancelled" } },
    select: { id: true, checked_in: true },
  });

  if (existing) {
    if (existing.checked_in) return res.json({ ok: true, kind: KIND_MEMBER, status: "already" });
    await prisma.booking.update({
      where: { id: existing.id },
      data: {
        checked_in: true,
        check_in_time: now,
        check_in_outcome: checkInOutcomeFromTimes(schedule.start_time, now),
      },
    });
    log.info({ userId, bookingId: existing.id, scheduleId: schedule.id }, "member checked in");
    void awardPtmBadges(userId, log);
    return res.json({ ok: true, kind: KIND_MEMBER, status: "checked_in" });
  }

  const pass = await findWalkInPackageId(userId, schedule.id, now, log);
  if (pass.blocked) {
    return res.status(402).json({ error: "No active pass with credits. Please buy a package." });
  }

  // Live seat count (booker = 1 seat each, + their extra guests).
  const cap = schedule.capacity ?? schedule.class_model?.max_capacity ?? 0;
  const seatRows = await prisma.booking.findMany({
    // Count every seat-occupying status (incl. unpaid payment_pending holds) so a
    // walk-in can't be admitted into a class that's actually full of held seats.
    where: { class_schedule_id: schedule.id, status: { in: [...OCCUPYING_STATUSES] } },
    select: { extra_guest_count: true },
  });
  const seatsTaken = seatRows.reduce((s, r) => s + 1 + Math.max(0, r.extra_guest_count ?? 0), 0);
  if (cap > 0 && seatsTaken + 1 > cap) {
    log.warn({ scheduleId: schedule.id, cap, seatsTaken }, "walk-in blocked class full");
    return res.status(400).json({ error: "Class is full" });
  }

  // Not booked for THIS class. Never spend a credit on the strength of a scan
  // alone — a stale beacon token and a real walk-in look identical here, so make
  // the member say which one it is.
  if (!confirm) {
    const intended = await findIntendedBooking(userId, now);
    log.info({ userId, scheduleId: schedule.id, hasIntended: !!intended }, "walk-in confirm required");
    return res.status(409).json({
      needsWalkInConfirm: true,
      className: schedule.class_model?.name ?? "this class",
      startTime: schedule.start_time.toISOString(),
      costsCredit: pass.usePackageId !== null,
      intended,
    });
  }

  const bookingId = await commitWalkIn({ userId, schedule, now, usePackageId: pass.usePackageId });

  log.info({ userId, scheduleId: schedule.id, usedPackageId: pass.usePackageId }, "walk-in checked in");
  void awardPtmBadges(userId, log);
  void logActivity({
    req,
    action: "booking.created",
    targetProfileId: userId,
    entity: { type: "booking", id: bookingId },
    metadata: {
      class_name: schedule.class_model?.name ?? null,
      walk_in: true,
      used_package_id: pass.usePackageId,
    },
  });
  return res.json({ ok: true, kind: KIND_MEMBER, status: "walk_in_checked_in" });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const log = requestLogger(req, res);
  if (req.method !== "POST") return res.status(405).end();
  const { token } = req.body as { token?: string };
  if (!token) {
    log.warn("checkin scan missing token");
    return res.status(400).json({ error: "token required" });
  }

  const payload = verifyCheckinToken(token);
  if (!payload) {
    log.warn("checkin scan invalid token");
    return res.status(400).json({ error: "Invalid or expired QR. Ask the desk for a fresh code." });
  }

  const schedule = await loadSchedule(payload.scheduleId);
  if (!schedule) {
    log.warn({ scheduleId: payload.scheduleId }, "checkin schedule not found");
    return res.status(404).json({ error: "Class not found" });
  }
  if (schedule.status === "cancelled") return res.status(400).json({ error: "Class is cancelled" });
  if (!withinCheckinWindow(schedule.start_time))
    return res.status(400).json({ error: "Check-in window is closed for this class." });

  if (payload.kind === KIND_INSTRUCTOR) {
    return handleInstructorScan(req, res, schedule, log);
  }

  return handleMemberScan(req, res, schedule, log);
}
