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
import { refundOutcomeFor } from "@/lib/classCancellation";

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
      cancellation_date: true,
      cancellation_reason: true,
      cancelled_by: true,
      refund_status: true,
      refund_amount_paise: true,
      invited_by_user_id: true,
      user_package_id: true,
      checked_in: true,
      class_schedule_id: true,
      invited_by: { select: { full_name: true } },
      user_package: { select: { package_type: { select: { is_unlimited: true, name: true } } } },
      cancellation_requests: {
        select: { kind: true, status: true, reason: true, refund_type: true, refund_amount_paise: true, created_at: true, decided_at: true },
        orderBy: { created_at: "desc" },
      },
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
    // Surface a plain-language payment state so a cancelled/unpaid booking visibly says so
    // (the booking-status pill alone can't tell "cancelled but money taken" from "cancelled
    // cleanly"). Reads the gateway payment + any admin refund flag on the linked order.
    let paymentNote: string | null = null;
    const orderId = booking.razorpay_order?.razorpay_order_id ?? null;
    if (orderId) {
      const pay = await prisma.razorpayPayment.findFirst({
        where: { razorpay_order_id: orderId },
        orderBy: { created_at: "desc" },
        select: { status: true, razorpay_payment_id: true },
      });
      if (pay) {
        const rec = await prisma.paymentReconcile.findUnique({
          where: { razorpay_payment_id: pay.razorpay_payment_id },
          select: { status: true },
        });
        if (rec?.status === "needs_refund") {
          paymentNote = "Payment received but the booking was cancelled — refund is under review.";
        } else if (pay.status === "authorized") {
          paymentNote = "Payment was authorized but not completed.";
        } else if (pay.status !== "captured" && booking.status !== "confirmed") {
          paymentNote = "Payment not completed.";
        }
      }
    }
    const isUnlimited = booking.user_package?.package_type?.is_unlimited ?? false;
    const seatRefund = refundOutcomeFor({
      user_package_id: booking.user_package_id, checked_in: booking.checked_in, is_unlimited: isUnlimited,
    });

    // Per-person refund line ("what was refunded to whom") for cancelled bookings.
    const memberRefundText = (r: {
      refund_status?: string | null; refund_amount_paise?: number | null;
      user_package_id?: string | null; checked_in?: boolean | null; is_unlimited?: boolean | null;
    }): string => {
      switch (r.refund_status) {
        case "auto_pass":
        case "approved_pass": return "1 Class Pass";
        case "approved_amount": return `₹${Math.round((r.refund_amount_paise ?? 0) / 100).toLocaleString("en-IN")}`;
        case "requested": return "refund requested";
        case "denied": return "no refund (denied)";
        default: {
          const o = refundOutcomeFor({ user_package_id: r.user_package_id, checked_in: r.checked_in, is_unlimited: r.is_unlimited });
          return o === "class_pass" ? "eligible — not yet refunded" : o === "none_unlimited" ? "no refund (unlimited)" : "no refund";
        }
      }
    };

    // Group members (booker's invited rows) + a unified "refunds" roster.
    let group: { name: string; status: string; refund: string }[] = [];
    if (booking.invited_by_user_id === null && booking.class_schedule_id) {
      const rows = await prisma.booking.findMany({
        where: { invited_by_user_id: booking.user_id, class_schedule_id: booking.class_schedule_id },
        select: {
          status: true, refund_status: true, refund_amount_paise: true, user_package_id: true, checked_in: true,
          profile: { select: { full_name: true, email: true } },
          user_package: { select: { package_type: { select: { is_unlimited: true } } } },
        },
      });
      group = rows.map((r) => ({
        name: r.profile?.full_name?.trim() || r.profile?.email?.split("@")[0] || "Member",
        status: r.status,
        refund: memberRefundText({
          refund_status: r.refund_status, refund_amount_paise: r.refund_amount_paise,
          user_package_id: r.user_package_id, checked_in: r.checked_in,
          is_unlimited: r.user_package?.package_type?.is_unlimited ?? false,
        }),
      }));
    }

    // Who-got-what: this member first, then each group member they brought.
    const refundRoster = [
      {
        name: "You", isYou: true,
        refund: memberRefundText({
          refund_status: booking.refund_status, refund_amount_paise: booking.refund_amount_paise,
          user_package_id: booking.user_package_id, checked_in: booking.checked_in, is_unlimited: isUnlimited,
        }),
      },
      ...group.map((g) => ({ name: g.name, isYou: false, refund: g.refund })),
    ];
    const refundRequest = booking.cancellation_requests.find((r) => r.kind === "refund") ?? null;
    // A manual refund request is only offered when this seat would have earned a
    // refund, none was auto-given, and the booking is cancelled.
    const canRequestRefund =
      booking.status === "cancelled" &&
      (booking.refund_status ?? "none") === "none" &&
      seatRefund === "class_pass" &&
      !refundRequest;

    return res.json({
      id: booking.id,
      status: booking.status,
      confirmationStatus: booking.confirmation_status,
      className: booking.class_name ?? booking.class_schedule?.class_model?.name ?? null,
      classTime: booking.class_time ?? booking.class_schedule?.start_time?.toISOString() ?? null,
      classStatus: booking.class_schedule?.status ?? null,
      holdExpiresAt: booking.hold_expires_at?.toISOString() ?? null,
      financeSnapshot: booking.finance_snapshot ?? null,
      razorpayOrderId: orderId,
      paymentNote,
      bookedAt: booking.created_at?.toISOString() ?? null,
      cancellationDate: booking.cancellation_date?.toISOString() ?? null,
      cancellationReason: booking.cancellation_reason ?? null,
      cancelledBy: booking.cancelled_by ?? null,
      refundStatus: booking.refund_status ?? "none",
      refundAmountPaise: booking.refund_amount_paise ?? null,
      refundPassName: booking.user_package?.package_type?.name ?? null,
      seatRefund,
      invitedByName: booking.invited_by?.full_name ?? null,
      group,
      refundRoster,
      refundRequest,
      canRequestRefund,
    });
  }

  if (req.method === "POST") {
    const action = (req.body as { action?: string })?.action;

    // Member-initiated refund request on an already-cancelled booking — only when
    // it was eligible for a refund yet none was auto-given (no double refund).
    if (action === "request_refund") {
      if (booking.status !== "cancelled") {
        return res.status(409).json({ error: "Only a cancelled booking can request a refund" });
      }
      if ((booking.refund_status ?? "none") !== "none") {
        return res.status(409).json({ error: "A refund has already been processed for this booking" });
      }
      const isUnlimited = booking.user_package?.package_type?.is_unlimited ?? false;
      if (refundOutcomeFor({ user_package_id: booking.user_package_id, checked_in: booking.checked_in, is_unlimited: isUnlimited }) !== "class_pass") {
        return res.status(409).json({ error: "This booking isn't eligible for a refund" });
      }
      if (booking.cancellation_requests.some((r) => r.kind === "refund" && r.status === "open")) {
        return res.status(409).json({ error: "A refund request is already pending" });
      }
      if (!booking.class_schedule_id) return res.status(400).json({ error: "This booking is not linked to a class" });
      const reason = typeof (req.body as { reason?: unknown }).reason === "string" ? (req.body as { reason: string }).reason : null;
      const request = await prisma.classCancellationRequest.create({
        data: {
          booking_id: booking.id, user_id: booking.user_id, class_schedule_id: booking.class_schedule_id,
          status: "open", kind: "refund", reason,
        },
      });
      await prisma.booking.update({ where: { id: booking.id }, data: { refund_status: "requested" } });
      return res.status(201).json({ request });
    }

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
