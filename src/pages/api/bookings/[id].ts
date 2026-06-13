/**
 * Member-facing single-booking endpoint, strictly scoped to the signed-in owner.
 *
 *  GET  /api/bookings/:id            → booking detail (class info + class status + payment status)
 *  POST /api/bookings/:id { action: "reconcile" }
 *        → self-service reconcile: ask Razorpay for the booking's order; if a payment was
 *          captured/authorized, confirm the booking (same path as the webhook/cron).
 *
 * Every access checks `booking.user_id === session.user.id` — a member can only see and
 * reconcile their own bookings.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { getRazorpay, razorpayConfigured } from "@/lib/razorpayServer";
import { reconcileRazorpayPaymentFromWebhook } from "@/lib/razorpayPersistence";
import { requestLogger } from "@/lib/logger";

type RazorpayOrderPaymentsClient = {
  orders: { fetchPayments: (id: string) => Promise<{ items?: unknown[] }> };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const log = requestLogger(req, res);
  const session = await getStudioServerSession(req, res);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const id = typeof req.query.id === "string" ? req.query.id : "";
  if (!id) return res.status(400).json({ error: "Booking id required" });

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: {
      id: true,
      user_id: true,
      status: true,
      confirmation_status: true,
      class_name: true,
      class_time: true,
      hold_expires_at: true,
      created_at: true,
      finance_snapshot: true,
      class_schedule: {
        select: {
          id: true,
          start_time: true,
          end_time: true,
          status: true,
          class_model: { select: { name: true } },
        },
      },
      razorpay_order: { select: { razorpay_order_id: true, status: true } },
    },
  });

  // Owner gate: do not leak existence of other members' bookings.
  if (!booking || booking.user_id !== userId) {
    return res.status(404).json({ error: "Booking not found" });
  }

  if (req.method === "GET") {
    return res.json({
      id: booking.id,
      status: booking.status,
      confirmationStatus: booking.confirmation_status,
      className: booking.class_name ?? booking.class_schedule?.class_model?.name ?? null,
      classTime: booking.class_time ?? booking.class_schedule?.start_time?.toISOString() ?? null,
      classStatus: booking.class_schedule?.status ?? null,
      holdExpiresAt: booking.hold_expires_at?.toISOString() ?? null,
      financeSnapshot: booking.finance_snapshot ?? null,
      razorpayOrderId: booking.razorpay_order?.razorpay_order_id ?? null,
    });
  }

  if (req.method === "POST") {
    const action = (req.body as { action?: string })?.action;
    if (action !== "reconcile") return res.status(400).json({ error: "Unknown action" });

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

      if (!captured) {
        return res.json({ reconciled: false, status: booking.status });
      }

      const capturedStatus = (captured as { status?: string }).status;
      await reconcileRazorpayPaymentFromWebhook({
        event: capturedStatus === "captured" ? "payment.captured" : "payment.authorized",
        payload: { payment: { entity: captured } },
      });

      const after = await prisma.booking.findUnique({
        where: { id: booking.id },
        select: { status: true },
      });
      return res.json({ reconciled: after?.status === "confirmed", status: after?.status ?? booking.status });
    } catch (e) {
      log.error({ err: e, bookingId: booking.id }, "self-reconcile failed");
      return res.status(502).json({ error: "Could not check payment status. Try again shortly." });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).end();
}
