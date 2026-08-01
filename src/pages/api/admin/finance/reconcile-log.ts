/**
 * Saved reconcile log (admin): every payment that's been handled (done / in_progress
 * / dropped / needs_refund), so handled items don't need re-reconciling and the
 * admin can act on them from here. Optional ?status= filter.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { ensureAdmin } from "@/lib/requireAdmin";
import { isReconcileStatus } from "@/lib/reconcileStatus";

export type ReconcileLogRow = {
  paymentId: string;
  orderId: string | null;
  status: string;
  amountPaise: number | null;
  note: string | null;
  paymentRowId: string | null;
  resolvedBy: string | null;
  resolvedByName: string | null;
  bookingId: string | null;
  userPackageId: string | null;
  memberName: string | null;
  memberEmail: string | null;
  /** Class this payment was for, when the linked Payment carries a booking. */
  className: string | null;
  classTimeISO: string | null;
  updatedAt: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!ensureAdmin(session, res)) return;
  if (req.method !== "GET") return res.status(405).end();

  const statusQ = typeof req.query.status === "string" ? req.query.status : "";
  const where = isReconcileStatus(statusQ) ? { status: statusQ } : {};

  const records = await prisma.paymentReconcile.findMany({
    where,
    orderBy: { updated_at: "desc" },
    take: 500,
  });

  // Enrich with the linked Payment (member/booking/package) + resolver name.
  //
  // Join on `razorpay_payment_id`, NOT the `payment_id` FK: rows written by the
  // auto-flag path (flagPaidCancelledOrphans) only know the gateway id and leave
  // that FK null, which used to blank out the Member column for every
  // machine-flagged refund candidate.
  const gatewayPaymentIds = records.map((r) => r.razorpay_payment_id);
  const resolverIds = Array.from(new Set(records.map((r) => r.resolved_by).filter((v): v is string => !!v)));

  const [payments, resolvers] = await Promise.all([
    gatewayPaymentIds.length
      ? prisma.payment.findMany({
          where: { razorpay_payment_id: { in: gatewayPaymentIds } },
          select: {
            id: true,
            razorpay_payment_id: true,
            booking_id: true,
            user_package_id: true,
            profile: { select: { full_name: true, email: true } },
            booking: {
              select: {
                class_name: true,
                class_time: true,
                class_schedule: {
                  select: { start_time: true, class_model: { select: { name: true } } },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
    resolverIds.length
      ? prisma.profile.findMany({ where: { id: { in: resolverIds } }, select: { id: true, full_name: true } })
      : Promise.resolve([]),
  ]);

  const payByGatewayId = new Map(
    payments.filter((p) => p.razorpay_payment_id).map((p) => [p.razorpay_payment_id as string, p]),
  );
  const resolverById = new Map(resolvers.map((r) => [r.id, r.full_name]));

  const rows: ReconcileLogRow[] = records.map((r) => {
    const pay = payByGatewayId.get(r.razorpay_payment_id);
    const bk = pay?.booking;
    const classTime = bk?.class_schedule?.start_time ?? bk?.class_time ?? null;
    return {
      paymentId: r.razorpay_payment_id,
      orderId: r.razorpay_order_id,
      status: r.status,
      amountPaise: r.amount_paise,
      note: r.note,
      paymentRowId: r.payment_id ?? pay?.id ?? null,
      resolvedBy: r.resolved_by,
      resolvedByName: r.resolved_by ? resolverById.get(r.resolved_by) ?? null : null,
      bookingId: pay?.booking_id ?? null,
      userPackageId: pay?.user_package_id ?? null,
      memberName: pay?.profile?.full_name ?? null,
      memberEmail: pay?.profile?.email ?? null,
      className: bk?.class_schedule?.class_model?.name ?? bk?.class_name ?? null,
      classTimeISO: classTime ? new Date(classTime).toISOString() : null,
      updatedAt: r.updated_at.toISOString(),
    };
  });

  return res.json({ rows });
}
