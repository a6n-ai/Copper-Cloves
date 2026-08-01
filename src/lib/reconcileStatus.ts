import prisma from "@/lib/prisma";

export type ReconcileStatusValue = "done" | "in_progress" | "dropped" | "needs_refund";

export const RECONCILE_STATUSES: ReconcileStatusValue[] = ["done", "in_progress", "dropped", "needs_refund"];

export function isReconcileStatus(v: unknown): v is ReconcileStatusValue {
  return typeof v === "string" && (RECONCILE_STATUSES as string[]).includes(v);
}

/**
 * Money-refund state per booking: `PaymentReconcile.status` for the gateway payment
 * sitting on each booking. Drop-in (no-pass) cancellations get money back rather
 * than a class credit, and that decision lives on the reconcile row — this is how
 * booking lists surface it ("Refund pending" etc.).
 *
 * Joins Payment → PaymentReconcile on `razorpay_payment_id`, NOT the nullable
 * `PaymentReconcile.payment_id` FK: auto-flagged rows (flagPaidCancelledOrphans)
 * only ever know the gateway id and leave that FK null.
 */
export async function moneyRefundStatusByBooking(
  bookingIds: string[],
): Promise<Map<string, ReconcileStatusValue>> {
  const out = new Map<string, ReconcileStatusValue>();
  if (bookingIds.length === 0) return out;

  const payments = await prisma.payment.findMany({
    where: { booking_id: { in: bookingIds }, razorpay_payment_id: { not: null } },
    select: { booking_id: true, razorpay_payment_id: true },
  });
  if (payments.length === 0) return out;

  const records = await prisma.paymentReconcile.findMany({
    where: { razorpay_payment_id: { in: payments.map((p) => p.razorpay_payment_id as string) } },
    select: { razorpay_payment_id: true, status: true },
  });
  const statusByRzpId = new Map(records.map((r) => [r.razorpay_payment_id, r.status]));

  for (const p of payments) {
    const status = statusByRzpId.get(p.razorpay_payment_id as string);
    if (status && p.booking_id && isReconcileStatus(status)) out.set(p.booking_id, status);
  }
  return out;
}

/**
 * Persist (upsert) the admin reconciliation state for one gateway payment.
 * Once a record exists, that payment drops out of the live reconcile tab and
 * shows in the saved/handled log instead.
 */
export async function upsertReconcileStatus(args: {
  razorpayPaymentId: string;
  status: ReconcileStatusValue;
  razorpayOrderId?: string | null;
  amountPaise?: number | null;
  note?: string | null;
  paymentId?: string | null;
  resolvedBy?: string | null;
}): Promise<void> {
  const { razorpayPaymentId, status } = args;
  await prisma.paymentReconcile.upsert({
    where: { razorpay_payment_id: razorpayPaymentId },
    create: {
      razorpay_payment_id: razorpayPaymentId,
      razorpay_order_id: args.razorpayOrderId ?? null,
      status,
      amount_paise: args.amountPaise ?? null,
      note: args.note ?? null,
      payment_id: args.paymentId ?? null,
      resolved_by: args.resolvedBy ?? null,
    },
    update: {
      status,
      ...(args.razorpayOrderId != null ? { razorpay_order_id: args.razorpayOrderId } : {}),
      ...(args.amountPaise != null ? { amount_paise: args.amountPaise } : {}),
      ...(args.note != null ? { note: args.note } : {}),
      ...(args.paymentId != null ? { payment_id: args.paymentId } : {}),
      ...(args.resolvedBy != null ? { resolved_by: args.resolvedBy } : {}),
    },
  });
}
