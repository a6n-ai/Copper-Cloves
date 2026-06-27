/**
 * Member-owned late-cancel request (spec §9).
 *
 *   POST /api/bookings/:id/cancel-request { reason? }
 *     - Only the booking owner may call.
 *     - If NOW is still BEFORE the cancellation cutoff
 *       (class_start - StudioSettings.cancellation_cutoff_hours), the member can
 *       self-cancel → respond 409 { code: "USE_SELF_CANCEL" } telling the client
 *       to use the normal PATCH /api/bookings cancel.
 *     - If NOW is AFTER the cutoff, create an `open` ClassCancellationRequest for
 *       admin review.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { getStudioSettings } from "@/lib/studioSettings";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }

  const id = typeof req.query.id === "string" ? req.query.id : "";
  if (!id) return res.status(400).json({ error: "Booking id required" });

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: {
      id: true,
      user_id: true,
      status: true,
      class_schedule_id: true,
      class_schedule: { select: { id: true, start_time: true } },
    },
  });

  // Owner gate: do not leak existence of other members' bookings.
  if (!booking || booking.user_id !== userId) {
    return res.status(404).json({ error: "Booking not found" });
  }

  if (booking.status === "cancelled") {
    return res.status(409).json({ error: "Booking is already cancelled" });
  }

  const classStart = booking.class_schedule?.start_time;
  if (!booking.class_schedule_id || !classStart) {
    return res.status(400).json({ error: "This booking is not linked to a scheduled class" });
  }

  const { cancellation_cutoff_hours } = await getStudioSettings();
  const cutoffMs = cancellation_cutoff_hours * 60 * 60 * 1000;
  const beforeCutoff = Date.now() <= classStart.getTime() - cutoffMs;
  if (beforeCutoff) {
    return res.status(409).json({
      code: "USE_SELF_CANCEL",
      error: "This class can still be cancelled directly. Please use the normal cancel option.",
    });
  }

  // Avoid stacking duplicate open requests for the same booking.
  const existingOpen = await prisma.classCancellationRequest.findFirst({
    where: { booking_id: booking.id, status: "open" },
  });
  if (existingOpen) {
    return res.status(409).json({ error: "A cancellation request is already pending for this booking", request: existingOpen });
  }

  const reason = typeof (req.body as { reason?: unknown })?.reason === "string" ? (req.body as { reason: string }).reason : null;

  const request = await prisma.classCancellationRequest.create({
    data: {
      booking_id: booking.id,
      user_id: userId,
      class_schedule_id: booking.class_schedule_id,
      status: "open",
      reason,
    },
  });

  return res.status(201).json({ request });
}
