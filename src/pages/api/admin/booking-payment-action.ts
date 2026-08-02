/**
 * Admin actions on a member's payment_pending booking from the roster:
 *  - "remind"    → send the "complete your payment" recovery email.
 *  - "reconcile" → check Razorpay for the booking's order and confirm if a payment
 *                  was captured/authorized (same path as member self-reconcile + cron).
 *
 * Admin-only. Instructors get a separate remind-only endpoint.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { getRazorpay, razorpayConfigured } from "@/lib/razorpayServer";
import { reconcileRazorpayPaymentFromWebhook } from "@/lib/razorpayPersistence";
import { sendPendingRecoveryEmail } from "@/lib/notifications/sendPendingRecoveryEmail";
import { requestLogger } from "@/lib/logger";
import { hasRole } from "@/lib/auth/roles";

type RazorpayOrderPaymentsClient = {
  orders: { fetchPayments: (id: string) => Promise<{ items?: unknown[] }> };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const log = requestLogger(req, res);
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  if (!hasRole((session.user as { role?: string }).role, "admin")) return res.status(403).json({ error: "Forbidden" });
  if (req.method !== "POST") return res.status(405).end();

  const { bookingId, action } = req.body as { bookingId?: string; action?: string };
  if (!bookingId) return res.status(400).json({ error: "bookingId required" });
  if (action !== "remind" && action !== "reconcile") {
    return res.status(400).json({ error: "action must be remind | reconcile" });
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      razorpay_order: { select: { razorpay_order_id: true } },
    },
  });
  if (!booking) return res.status(404).json({ error: "Booking not found" });

  if (action === "remind") {
    if (booking.status !== "payment_pending") {
      return res.status(409).json({ error: `Cannot remind a ${booking.status} booking` });
    }
    await sendPendingRecoveryEmail(booking.id);
    return res.json({ ok: true, reminded: true });
  }

  // action === "reconcile"
  if (booking.status === "confirmed") {
    return res.json({ reconciled: true, status: "confirmed", alreadyConfirmed: true });
  }
  if (booking.status !== "payment_pending" && booking.status !== "expired") {
    return res.status(409).json({ error: `Cannot reconcile a ${booking.status} booking` });
  }
  const orderId = booking.razorpay_order?.razorpay_order_id;
  if (!orderId) return res.status(400).json({ error: "No payment order linked to this booking" });
  if (!razorpayConfigured()) return res.status(503).json({ error: "Payments are not configured" });

  try {
    const rzp = getRazorpay() as unknown as RazorpayOrderPaymentsClient;
    const resp = await rzp.orders.fetchPayments(orderId);
    const items = Array.isArray(resp.items) ? resp.items : [];
    const captured =
      items.find((p) => (p as { status?: string }).status === "captured") ??
      items.find((p) => (p as { status?: string }).status === "authorized") ??
      null;

    if (!captured) return res.json({ reconciled: false, status: booking.status });

    const capturedStatus = (captured as { status?: string }).status;
    await reconcileRazorpayPaymentFromWebhook({
      event: capturedStatus === "captured" ? "payment.captured" : "payment.authorized",
      payload: { payment: { entity: captured } },
    });

    const after = await prisma.booking.findUnique({ where: { id: booking.id }, select: { status: true } });
    return res.json({ reconciled: after?.status === "confirmed", status: after?.status ?? booking.status });
  } catch (e) {
    log.error({ err: e, bookingId: booking.id }, "admin reconcile failed");
    return res.status(502).json({ error: "Could not check payment status. Try again shortly." });
  }
}
