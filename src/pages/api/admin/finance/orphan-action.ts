/**
 * Admin actions on an orphan payment row (see orphan-payments.ts):
 *  - "link"          — link a stuck (payment_pending/expired) booking to this
 *                       payment and confirm it. Guarded: same member, same
 *                       amount as the booking's own Razorpay order — never
 *                       cross-links a payment to the wrong member/booking.
 *  - "mark_refunded"  — record (not action) that this payment was refunded
 *                       outside the app (Razorpay dashboard). Clears it from
 *                       the orphan list (status flips off "succeeded").
 */
import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { ensureAdmin } from "@/lib/requireAdmin";
import { BOOKING_STATUS } from "@/lib/bookingStatus";
import { reconcileConfirmedBookingSideEffects } from "@/lib/seatCounts";
import { logActivity } from "@/lib/activityLog";

export type OrphanActionBody =
  | { action: "link"; paymentId: string; bookingId: string; note?: string }
  | { action: "mark_refunded"; paymentId: string; note?: string };

class ConcurrentChangeError extends Error {}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!ensureAdmin(session, res)) return;
  if (req.method !== "POST") return res.status(405).end();

  const body = req.body as Partial<OrphanActionBody>;
  const admin = session!.user as { id?: string; role?: string; name?: string };

  if (body.action === "link") {
    const { paymentId, bookingId } = body;
    if (!paymentId || !bookingId) {
      return res.status(400).json({ error: "paymentId and bookingId are required." });
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: { id: true, user_id: true, amount_paise: true, status: true, direction: true, booking_id: true },
    });
    if (!payment) return res.status(404).json({ error: "Payment not found." });
    if (payment.status !== "succeeded" || payment.direction !== "credit" || payment.booking_id) {
      return res.status(409).json({ error: "This payment is not an unlinked, succeeded credit — cannot link." });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        user_id: true,
        status: true,
        class_schedule_id: true,
        razorpay_order: { select: { amount_paise: true } },
      },
    });
    if (!booking) return res.status(404).json({ error: "Booking not found." });

    if (payment.user_id !== booking.user_id) {
      return res.status(409).json({ error: "Payment and booking belong to different members — refusing to cross-link." });
    }
    if (booking.razorpay_order == null || payment.amount_paise !== booking.razorpay_order.amount_paise) {
      return res.status(409).json({ error: "Amount mismatch between payment and booking's order — refusing to link." });
    }

    try {
      await prisma.$transaction(async (tx) => {
        const linkResult = await tx.payment.updateMany({
          where: { id: paymentId, booking_id: null },
          data: { booking_id: bookingId },
        });
        if (linkResult.count === 0) throw new ConcurrentChangeError();

        const confirmResult = await tx.booking.updateMany({
          where: { id: bookingId, status: { in: [BOOKING_STATUS.payment_pending, BOOKING_STATUS.expired] } },
          data: { status: BOOKING_STATUS.confirmed, hold_expires_at: null },
        });
        if (confirmResult.count === 0) throw new ConcurrentChangeError();
      });
    } catch (err) {
      if (err instanceof ConcurrentChangeError) {
        return res.status(409).json({ error: "Payment or booking changed concurrently — please refresh and retry." });
      }
      throw err;
    }

    // Fulfills any group added-members (payment_pending → confirmed) alongside the
    // booker row, then recounts seats — mirrors the online confirm path.
    await reconcileConfirmedBookingSideEffects(bookingId, booking.user_id).catch(() => {});

    await logActivity({
      actor: { id: admin.id, role: admin.role, name: admin.name },
      action: "admin.orphan_payment_linked",
      targetProfileId: booking.user_id,
      entity: { type: "booking", id: bookingId },
      metadata: { payment_id: paymentId, note: body.note ?? undefined },
    });

    return res.json({ linked: true });
  }

  if (body.action === "mark_refunded") {
    const { paymentId, note } = body;
    if (!paymentId) return res.status(400).json({ error: "paymentId is required." });

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: { id: true, user_id: true, status: true, direction: true, notes: true, booking_id: true, user_package_id: true },
    });
    if (!payment) return res.status(404).json({ error: "Payment not found." });
    if (payment.status !== "succeeded" || payment.direction !== "credit") {
      return res.status(409).json({ error: "Only a succeeded credit payment can be marked refunded here." });
    }
    if (payment.booking_id || payment.user_package_id) {
      return res.status(409).json({ error: "This payment is already linked to a booking or package — cannot mark refunded as an orphan." });
    }

    const trimmedNote = note?.trim();
    const nextNotes = trimmedNote
      ? [payment.notes, `[refunded] ${trimmedNote}`].filter(Boolean).join("\n")
      : payment.notes;

    await prisma.payment.update({
      where: { id: paymentId },
      data: { status: "refunded", notes: nextNotes },
    });

    await logActivity({
      actor: { id: admin.id, role: admin.role, name: admin.name },
      action: "admin.orphan_payment_marked_refunded",
      targetProfileId: payment.user_id,
      entity: { type: "payment", id: paymentId },
      metadata: { note: trimmedNote ?? undefined },
    });

    return res.json({ refunded: true });
  }

  return res.status(400).json({ error: "Unknown action." });
}
