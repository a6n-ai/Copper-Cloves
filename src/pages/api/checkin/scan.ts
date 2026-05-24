import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { verifyCheckinToken } from "@/lib/checkinToken";
import { withinCheckinWindow } from "@/lib/checkinWindow";
import { getInstructorSession } from "@/lib/instructorAuth";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { checkInOutcomeFromTimes } from "@/lib/bookingAttendance";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const { token } = req.body as { token?: string };
  if (!token) return res.status(400).json({ error: "token required" });

  const payload = verifyCheckinToken(token);
  if (!payload)
    return res.status(400).json({ error: "Invalid or expired QR. Ask the desk for a fresh code." });

  const schedule = await prisma.classSchedule.findUnique({
    where: { id: payload.scheduleId },
    select: {
      id: true,
      instructor_id: true,
      start_time: true,
      status: true,
      capacity: true,
      instructor_check_in_time: true,
      class_model: { select: { max_capacity: true } },
    },
  });
  if (!schedule) return res.status(404).json({ error: "Class not found" });
  if (schedule.status === "cancelled") return res.status(400).json({ error: "Class is cancelled" });
  if (!withinCheckinWindow(schedule.start_time))
    return res.status(400).json({ error: "Check-in window is closed for this class." });

  // ── Instructor self check-in ──────────────────────────────
  if (payload.kind === "instructor") {
    const inst = await getInstructorSession(req, res);
    if (!inst) return res.status(401).json({ error: "Sign in as instructor first" });
    if (schedule.instructor_id !== inst.instructorId)
      return res.status(403).json({ error: "This is not your class" });
    if (schedule.instructor_check_in_time)
      return res.json({ ok: true, kind: "instructor", status: "already" });
    await prisma.classSchedule.update({
      where: { id: schedule.id },
      data: { instructor_check_in_time: new Date() },
    });
    return res.json({ ok: true, kind: "instructor", status: "checked_in" });
  }

  // ── Member check-in (existing booking or walk-in) ─────────
  const session = await getStudioServerSession(req, res);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || user.role !== "user")
    return res.status(401).json({ error: "Sign in as a member first" });
  const userId = user.id;

  const now = new Date();
  const existing = await prisma.booking.findFirst({
    where: { user_id: userId, class_schedule_id: schedule.id, status: { not: "cancelled" } },
    select: { id: true, checked_in: true },
  });

  if (existing) {
    if (existing.checked_in) return res.json({ ok: true, kind: "member", status: "already" });
    await prisma.booking.update({
      where: { id: existing.id },
      data: {
        checked_in: true,
        check_in_time: now,
        check_in_outcome: checkInOutcomeFromTimes(schedule.start_time, now),
      },
    });
    return res.json({ ok: true, kind: "member", status: "checked_in" });
  }

  // Walk-in: need an active, non-expired pass. Unlimited → book without decrement;
  // credit pass → decrement one credit. Hard block if neither.
  const activePackages = await prisma.userPackage.findMany({
    where: { user_id: userId, is_active: true, expiration_date: { gt: now } },
    include: { package_type: { select: { is_unlimited: true } } },
    orderBy: { expiration_date: "asc" },
  });
  const unlimited = activePackages.find((p) => p.package_type?.is_unlimited);
  const creditPass = activePackages.find(
    (p) => !p.package_type?.is_unlimited && (p.credits_remaining ?? 0) >= 1,
  );
  if (!unlimited && !creditPass)
    return res.status(402).json({ error: "No active pass with credits. Please buy a package." });

  // Live seat count (booker = 1 seat each, + their extra guests).
  const cap = schedule.capacity ?? schedule.class_model?.max_capacity ?? 0;
  const seatRows = await prisma.booking.findMany({
    where: { class_schedule_id: schedule.id, status: { in: ["confirmed", "pending"] } },
    select: { extra_guest_count: true },
  });
  const seatsTaken = seatRows.reduce((s, r) => s + 1 + Math.max(0, r.extra_guest_count ?? 0), 0);
  if (cap > 0 && seatsTaken + 1 > cap) return res.status(400).json({ error: "Class is full" });

  const usePackageId = unlimited ? null : creditPass!.id;

  await prisma.$transaction(async (tx) => {
    if (usePackageId) {
      const upd = await tx.userPackage.updateMany({
        where: { id: usePackageId, user_id: userId, credits_remaining: { gte: 1 } },
        data: { credits_remaining: { decrement: 1 } },
      });
      if (upd.count !== 1) throw new Error("NO_CREDITS");
    }
    await tx.booking.create({
      data: {
        user_id: userId,
        class_schedule_id: schedule.id,
        user_package_id: usePackageId,
        status: "confirmed",
        booking_date: now,
        checked_in: true,
        check_in_time: now,
        check_in_outcome: checkInOutcomeFromTimes(schedule.start_time, now),
      },
    });
    if (cap > 0) {
      const occupied = seatsTaken + 1;
      await tx.classSchedule.update({
        where: { id: schedule.id },
        data: { current_bookings: occupied, available_spots: Math.max(0, cap - occupied) },
      });
    }
  });

  return res.json({ ok: true, kind: "member", status: "walk_in_checked_in" });
}
