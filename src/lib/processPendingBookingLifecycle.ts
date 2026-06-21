import prisma from "@/lib/prisma";
import { getRazorpay, razorpayConfigured } from "@/lib/razorpayServer";
import { BOOKING_STATUS, OCCUPYING_STATUSES } from "@/lib/bookingStatus";
import { classifyPendingBooking } from "@/lib/bookingLifecycle";
import { reconcileRazorpayPaymentFromWebhook } from "@/lib/razorpayPersistence";
import { sendPendingRecoveryEmail } from "@/lib/notifications/sendPendingRecoveryEmail";
import { logActivity } from "@/lib/activityLog";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "pendingBookingLifecycle" });

type RazorpayOrderPaymentsClient = {
  orders: { fetchPayments: (id: string) => Promise<{ items?: unknown[] }> };
};

/** Recompute denormalized seat counters on a schedule from live seat-holding rows. */
async function refreshScheduleSeatCounters(scheduleId: string): Promise<void> {
  const sched = await prisma.classSchedule.findUnique({
    where: { id: scheduleId },
    include: { class_model: { select: { max_capacity: true } } },
  });
  if (!sched) return;
  const cap = sched.capacity ?? sched.class_model?.max_capacity ?? 0;
  if (cap <= 0) return;
  const rows = await prisma.booking.findMany({
    where: { class_schedule_id: scheduleId, status: { in: [...OCCUPYING_STATUSES] } },
    select: { extra_guest_count: true },
  });
  const seatsTaken = rows.reduce((s, r) => s + 1 + Math.max(0, r.extra_guest_count ?? 0), 0);
  await prisma.classSchedule.update({
    where: { id: scheduleId },
    data: { current_bookings: seatsTaken, available_spots: Math.max(0, cap - seatsTaken) },
  });
}

export type LifecycleResult = {
  scanned: number;
  emailed: number;
  confirmed: number;
  expired: number;
  errors: number;
};

/**
 * Sweep payment_pending bookings:
 *  - aged ≥ recovery min age, not emailed → send recovery email (once)
 *  - past hold_expires_at → ask Razorpay; captured/authorized → confirm; else expire + release seat
 * Idempotent; safe to run every ~15 min.
 */
export async function processPendingBookingLifecycle(opts?: { limit?: number }): Promise<LifecycleResult> {
  const result: LifecycleResult = { scanned: 0, emailed: 0, confirmed: 0, expired: 0, errors: 0 };
  const now = new Date();
  const limit = opts?.limit ?? 500;

  const pendings = await prisma.booking.findMany({
    where: { status: BOOKING_STATUS.payment_pending },
    select: {
      id: true,
      user_id: true,
      class_name: true,
      created_at: true,
      class_schedule_id: true,
      hold_expires_at: true,
      recovery_email_sent_at: true,
      razorpay_order: { select: { razorpay_order_id: true } },
    },
    orderBy: { created_at: "asc" },
    take: limit,
  });

  const rzp = razorpayConfigured() ? (getRazorpay() as unknown as RazorpayOrderPaymentsClient) : null;

  for (const b of pendings) {
    result.scanned += 1;
    const action = classifyPendingBooking(b, now);
    try {
      if (action === "send_email") {
        await sendPendingRecoveryEmail(b.id);
        await prisma.booking.update({ where: { id: b.id }, data: { recovery_email_sent_at: now } });
        result.emailed += 1;
        continue;
      }
      if (action === "release") {
        const orderId = b.razorpay_order?.razorpay_order_id ?? null;
        let captured: unknown = null;
        if (rzp && orderId) {
          const resp = await rzp.orders.fetchPayments(orderId);
          const items = Array.isArray(resp.items) ? resp.items : [];
          captured =
            items.find((p) => (p as { status?: string }).status === "captured") ??
            items.find((p) => (p as { status?: string }).status === "authorized") ??
            null;
        }
        if (captured && orderId) {
          const status = (captured as { status?: string }).status;
          await reconcileRazorpayPaymentFromWebhook({
            event: status === "captured" ? "payment.captured" : "payment.authorized",
            payload: { payment: { entity: captured } },
          });
          result.confirmed += 1;
        } else {
          const upd = await prisma.booking.updateMany({
            where: { id: b.id, status: BOOKING_STATUS.payment_pending },
            data: { status: BOOKING_STATUS.expired, hold_expires_at: null },
          });
          if (upd.count > 0) {
            result.expired += 1;
            if (b.class_schedule_id) await refreshScheduleSeatCounters(b.class_schedule_id);
            await logActivity({
              actor: { role: "system", name: "System" },
              action: "booking.expired",
              targetProfileId: b.user_id,
              entity: { type: "booking", id: b.id },
              metadata: {
                class_name: b.class_name ?? undefined,
                changes: [{ field: "status", from: "payment_pending", to: "expired" }],
              },
            }).catch(() => {});
          }
        }
      }
    } catch (e) {
      result.errors += 1;
      log.error({ err: e, bookingId: b.id }, "pending lifecycle step failed");
    }
  }

  log.info(result, "processPendingBookingLifecycle complete");
  return result;
}
