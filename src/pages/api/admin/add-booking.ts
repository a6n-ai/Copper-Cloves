import prisma from "@/lib/prisma";
import { SEAT_HOLDING_STATUSES } from "@/lib/bookingStatus";
import { pickActivePass } from "@/lib/pickActivePass";
import { checkInOutcomeFromTimes } from "@/lib/bookingAttendance";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { sendBookingConfirmationEmail } from "@/lib/notifications/sendBookingEmail";
import type { NextApiRequest, NextApiResponse } from "next";
import logger from "@/lib/logger";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  if ((session.user as { role?: string }).role !== "admin") return res.status(403).json({ error: "Forbidden" });
  if (req.method !== "POST") return res.status(405).end();

  const { scheduleId, userId, markCheckedIn, allowOverCapacity } = req.body as {
    scheduleId?: string;
    userId?: string;
    markCheckedIn?: boolean;
    allowOverCapacity?: boolean;
  };
  if (!scheduleId || !userId) return res.status(400).json({ error: "scheduleId and userId required" });

  const schedule = await prisma.classSchedule.findUnique({
    where: { id: scheduleId },
    include: {
      class_model: { select: { name: true } },
      bookings: { where: { status: { in: [...SEAT_HOLDING_STATUSES] } }, select: { id: true, user_id: true } },
    },
  });
  if (!schedule) return res.status(404).json({ error: "Schedule not found" });
  if (schedule.status === "cancelled") return res.status(400).json({ error: "Class is cancelled" });
  if (schedule.status === "inactive") return res.status(400).json({ error: "Class is inactive — reactivate before booking" });

  const alreadyBooked = schedule.bookings.some(b => b.user_id === userId);
  if (alreadyBooked) return res.status(409).json({ error: "Member already booked into this class" });

  // Capacity is enforced — except an admin may override it for a past/completed
  // class (the walk-in path) so a real attendee can be recorded after the fact.
  const isPastOrDone =
    schedule.end_time.getTime() < Date.now() ||
    schedule.status === "completed" ||
    schedule.status === "abandoned";
  const atCapacity = schedule.capacity != null && schedule.bookings.length >= schedule.capacity;
  if (atCapacity && !(allowOverCapacity === true && isPastOrDone)) {
    return res.status(400).json({ error: "Class is at full capacity" });
  }

  const member = await prisma.profile.findUnique({ where: { id: userId }, select: { full_name: true, email: true, avatar_url: true } });
  if (!member) return res.status(404).json({ error: "Member not found" });

  let booking;
  try {
    booking = await prisma.$transaction(async (tx) => {
      // ponytail: re-check inside the tx — the outer alreadyBooked read can race a
      // concurrent submit. Narrows (doesn't fully close) the double-book/double-deduct
      // window without a DB unique index on (user_id, class_schedule_id).
      const dup = await tx.booking.findFirst({
        where: { user_id: userId, class_schedule_id: scheduleId, status: { in: [...SEAT_HOLDING_STATUSES] } },
        select: { id: true },
      });
      if (dup) throw new Error("ALREADY_BOOKED");

      // The pass to deduct is resolved server-side from the member (the UI never
      // passes it) — booking a class always consumes a credit. Prefer a finite
      // class_pass, soonest-expiry first (so a day pass is spent before it lapses);
      // fall back to an unlimited pass. No active pass → NO_PASS (admin must assign
      // one first). This is the single chokepoint for every add-member flow.
      const candidates = await tx.userPackage.findMany({
        where: {
          user_id: userId,
          is_active: true,
          is_paused: false,
          expiration_date: { gt: new Date() },
          OR: [{ credits_remaining: null }, { credits_remaining: { gte: 1 } }],
        },
        select: { id: true, credits_remaining: true, expiration_date: true },
      });
      const effectivePackage = pickActivePass(candidates);
      if (!effectivePackage) throw new Error("NO_PASS");

      // Deduct one credit (so cancellation can refund it later via
      // user_package_id). Unlimited passes (credits null) carry no balance — link
      // without decrementing.
      const effectivePackageId = effectivePackage.id;
      if (effectivePackage.credits_remaining != null) {
        const upd = await tx.userPackage.updateMany({
          where: { id: effectivePackageId, user_id: userId, credits_remaining: { gte: 1 } },
          data: { credits_remaining: { decrement: 1 } },
        });
        if (upd.count !== 1) throw new Error("NO_CREDITS");
      }

      // Admin override: mark attended without enforcing the member/instructor
      // self-check-in window (bookingAttendance.ts) — admin presence is the gate.
      // The outcome label is still derived from the actual class time so a
      // post-start check-in reads as "late" rather than a hardcoded "on_time".
      const checkInAt = markCheckedIn === true ? new Date() : null;

      return tx.booking.create({
        data: {
          user_id: userId,
          class_schedule_id: scheduleId,
          status: "confirmed",
          class_name: schedule.class_model?.name ?? null,
          class_time: schedule.start_time.toISOString(),
          user_package_id: effectivePackageId,
          ...(checkInAt
            ? {
                checked_in: true,
                check_in_time: checkInAt,
                check_in_outcome: checkInOutcomeFromTimes(schedule.start_time, checkInAt),
              }
            : {}),
        },
      });
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "ALREADY_BOOKED") return res.status(409).json({ error: "Member already booked into this class" });
    if (msg === "NO_CREDITS") return res.status(400).json({ error: "This package has no credits remaining." });
    if (msg === "NO_PASS") return res.status(400).json({ error: "Member has no active pass with credits. Assign a pass before booking." });
    logger.error({ err: e }, "[add-booking]");
    return res.status(500).json({ error: "Could not add booking" });
  }

  await sendBookingConfirmationEmail(booking.id).catch(e => logger.error({ err: e }, "[add-booking email]"));

  return res.status(201).json({
    booking: {
      id: booking.id,
      userId,
      name: member.full_name || "Member",
      email: member.email,
      avatarUrl: member.avatar_url ?? null,
      checkedIn: booking.checked_in,
      checkInTime: booking.check_in_time?.toISOString() ?? null,
      checkInOutcome: booking.check_in_outcome ?? null,
      extraGuests: 0,
    },
  });
}
