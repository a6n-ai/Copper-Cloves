import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { checkInOutcomeFromTimes } from "@/lib/bookingAttendance";
import { requestLogger } from "@/lib/logger";
import type { NextApiRequest, NextApiResponse } from "next";
import { hasRole } from "@/lib/auth/roles";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const log = requestLogger(req, res);
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  if (!hasRole((session.user as { role?: string }).role, "admin")) return res.status(403).json({ error: "Forbidden" });
  if (req.method !== "POST") return res.status(405).end();

  const { bookingId, outcome } = req.body as { bookingId?: string; outcome?: string };
  if (!bookingId) return res.status(400).json({ error: "bookingId required" });

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { class_schedule: { select: { start_time: true } } },
  });
  if (!booking) return res.status(404).json({ error: "Booking not found" });
  if (booking.status === "cancelled") return res.status(400).json({ error: "Booking is cancelled" });

  const now = new Date();
  const classStart = booking.class_schedule?.start_time ?? now;

  // Manual override: admin sets an explicit attendance outcome (can correct an
  // already-checked-in row, mark no-show, or clear back to not-checked-in).
  if (typeof outcome === "string") {
    let data: { checked_in: boolean; check_in_time: Date | null; check_in_outcome: string | null };
    if (outcome === "on_time" || outcome === "late") {
      data = { checked_in: true, check_in_time: booking.check_in_time ?? now, check_in_outcome: outcome };
    } else if (outcome === "no_show") {
      data = { checked_in: false, check_in_time: null, check_in_outcome: "no_show" };
    } else if (outcome === "not_checked_in") {
      data = { checked_in: false, check_in_time: null, check_in_outcome: null };
    } else {
      return res.status(400).json({ error: "Invalid outcome" });
    }
    const updated = await prisma.booking.update({ where: { id: bookingId }, data });
    log.info({ adminId: (session.user as { id?: string }).id, bookingId, outcome }, "admin manual override");
    return res.json({ ok: true, booking: updated });
  }

  // Default: clock-based check-in (on_time/late). No-op if already checked in.
  if (booking.checked_in) return res.json({ alreadyCheckedIn: true });
  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      checked_in: true,
      check_in_time: now,
      check_in_outcome: checkInOutcomeFromTimes(classStart, now),
    },
  });

  log.info({ adminId: (session.user as { id?: string }).id, bookingId }, "admin manual check-in");
  return res.json({ ok: true, booking: updated });
}