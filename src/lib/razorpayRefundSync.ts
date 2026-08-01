/**
 * Razorpay refund auto-detection.
 *
 * A refund issued directly in the Razorpay dashboard never touches the app's
 * `Payment` row unless something pulls it back. This module flips a
 * `succeeded` Payment to `refunded` once Razorpay confirms the full captured
 * amount has been refunded — driven by the `refund.*` webhook event and by a
 * periodic pull sweep (cron backstop for missed/unsubscribed webhooks).
 */
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getRazorpay, razorpayConfigured } from "@/lib/razorpayServer";

const log = logger.child({ module: "razorpayRefundSync" });

/**
 * Pure guard: true iff the captured amount has been refunded in full.
 * Never guesses on partial refunds — `Payment.status` has no partial-refund
 * state, only `succeeded` | `refunded`.
 */
export function isFullyRefunded(
  amountPaise: number,
  amountRefundedPaise: number | null | undefined,
): boolean {
  if (amountPaise <= 0) return false;
  if (amountRefundedPaise == null) return false;
  return amountRefundedPaise >= amountPaise;
}

export type RefundSyncResult = { changed: boolean; reason?: string };

/**
 * Fetch a payment's live Razorpay state and, if fully refunded, flip the
 * matching local `Payment` row (only when it's currently `succeeded`) to
 * `refunded`. Never throws — failures are logged and returned as a reason.
 *
 * ponytail: full-refund-only. Payment has no amount_refunded/partial column,
 * so a partial refund at Razorpay is intentionally left alone here. Upgrade
 * path: add a `Payment.amount_refunded_paise` column and a `partially_refunded`
 * status if partial refunds need surfacing later.
 */
export async function syncRefundForRazorpayPayment(
  razorpayPaymentId: string,
): Promise<RefundSyncResult> {
  if (!razorpayConfigured()) return { changed: false, reason: "unconfigured" };

  let rzpPayment: { amount?: number; amount_refunded?: number | null } | null = null;
  try {
    rzpPayment = (await getRazorpay().payments.fetch(razorpayPaymentId)) as {
      amount?: number;
      amount_refunded?: number | null;
    };
  } catch (err) {
    log.warn({ err, razorpayPaymentId }, "refund sync: Razorpay fetch failed");
    return { changed: false, reason: "fetch_failed" };
  }

  const amountPaise = rzpPayment?.amount ?? 0;
  const amountRefundedPaise = rzpPayment?.amount_refunded ?? null;

  if (!isFullyRefunded(amountPaise, amountRefundedPaise)) {
    return { changed: false, reason: "not_fully_refunded" };
  }

  const updated = await prisma.payment.updateMany({
    where: { razorpay_payment_id: razorpayPaymentId, status: "succeeded" },
    data: { status: "refunded" },
  });

  if (updated.count > 0) {
    log.info({ razorpayPaymentId, amountPaise, amountRefundedPaise }, "refund sync: flipped Payment to refunded");
    // Audit on the MEMBER's timeline — a completed money refund is the single most
    // useful line in their account history, and only Razorpay knows when it lands.
    // Best-effort: never let an audit failure undo a confirmed refund.
    try {
      const { logActivity } = await import("@/lib/activityLog");
      const pay = await prisma.payment.findFirst({
        where: { razorpay_payment_id: razorpayPaymentId },
        select: { user_id: true, booking_id: true, booking: { select: { class_name: true } } },
      });
      if (pay?.user_id) {
        await logActivity({
          actor: { role: "system", name: "System" },
          action: "payment.refunded",
          targetProfileId: pay.user_id,
          entity: { type: "payment", id: razorpayPaymentId },
          metadata: {
            amount_inr: Math.round((amountRefundedPaise ?? amountPaise) / 100),
            class_name: pay.booking?.class_name ?? undefined,
          },
        });
      }
    } catch {
      /* audit only */
    }
    return { changed: true };
  }
  return { changed: false, reason: "not_fully_refunded" };
}

/** Webhook entry point — handles `refund.created` / `refund.processed` (and similar `refund.*`) events. */
export async function applyRazorpayRefundFromWebhook(body: {
  event?: string;
  payload?: unknown;
}): Promise<void> {
  const payload = body.payload as { refund?: { entity?: { payment_id?: string } } } | undefined;
  const paymentId = payload?.refund?.entity?.payment_id;
  if (!paymentId) return;
  await syncRefundForRazorpayPayment(paymentId);
}

export type RefundSweepResult = { scanned: number; refunded: number; errors: number };

/** Pull backstop: re-checks recently-succeeded Razorpay payments for a full refund Razorpay-side. */
export async function sweepRefundStatus(opts?: { limit?: number }): Promise<RefundSweepResult> {
  const limit = opts?.limit ?? 200;

  const candidates = await prisma.payment.findMany({
    where: { status: "succeeded", direction: "credit", razorpay_payment_id: { not: null } },
    select: { razorpay_payment_id: true },
    orderBy: { created_at: "desc" },
    take: limit,
  });

  let refunded = 0;
  let errors = 0;
  for (const c of candidates) {
    if (!c.razorpay_payment_id) continue;
    try {
      const result = await syncRefundForRazorpayPayment(c.razorpay_payment_id);
      if (result.changed) refunded += 1;
      else if (result.reason === "fetch_failed") errors += 1;
    } catch (err) {
      errors += 1;
      log.warn({ err, razorpayPaymentId: c.razorpay_payment_id }, "refund sweep: unexpected error");
    }
  }

  return { scanned: candidates.length, refunded, errors };
}
