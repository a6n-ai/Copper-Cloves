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
  const paymentRowIds = records.map((r) => r.payment_id).filter((v): v is string => !!v);
  const resolverIds = Array.from(new Set(records.map((r) => r.resolved_by).filter((v): v is string => !!v)));

  const [payments, resolvers] = await Promise.all([
    paymentRowIds.length
      ? prisma.payment.findMany({
          where: { id: { in: paymentRowIds } },
          select: {
            id: true,
            booking_id: true,
            user_package_id: true,
            profile: { select: { full_name: true, email: true } },
          },
        })
      : Promise.resolve([]),
    resolverIds.length
      ? prisma.profile.findMany({ where: { id: { in: resolverIds } }, select: { id: true, full_name: true } })
      : Promise.resolve([]),
  ]);

  const payById = new Map(payments.map((p) => [p.id, p]));
  const resolverById = new Map(resolvers.map((r) => [r.id, r.full_name]));

  const rows: ReconcileLogRow[] = records.map((r) => {
    const pay = r.payment_id ? payById.get(r.payment_id) : undefined;
    return {
      paymentId: r.razorpay_payment_id,
      orderId: r.razorpay_order_id,
      status: r.status,
      amountPaise: r.amount_paise,
      note: r.note,
      paymentRowId: r.payment_id,
      resolvedBy: r.resolved_by,
      resolvedByName: r.resolved_by ? resolverById.get(r.resolved_by) ?? null : null,
      bookingId: pay?.booking_id ?? null,
      userPackageId: pay?.user_package_id ?? null,
      memberName: pay?.profile?.full_name ?? null,
      memberEmail: pay?.profile?.email ?? null,
      updatedAt: r.updated_at.toISOString(),
    };
  });

  return res.json({ rows });
}
