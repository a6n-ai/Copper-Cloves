import prisma from "@/lib/prisma";

export type ReconcileStatusValue = "done" | "in_progress" | "dropped" | "needs_refund";

export const RECONCILE_STATUSES: ReconcileStatusValue[] = ["done", "in_progress", "dropped", "needs_refund"];

export function isReconcileStatus(v: unknown): v is ReconcileStatusValue {
  return typeof v === "string" && (RECONCILE_STATUSES as string[]).includes(v);
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
