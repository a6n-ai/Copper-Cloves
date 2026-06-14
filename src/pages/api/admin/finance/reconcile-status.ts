/**
 * Set/clear the saved reconcile status for a gateway payment (admin).
 *
 *  POST   { paymentId, status, orderId?, amountPaise?, note? }  → upsert status
 *  DELETE { paymentId }                                         → remove (re-opens in reconcile tab)
 *
 * Statuses: done | in_progress | dropped | needs_refund. Once a record exists the
 * payment drops out of the live reconcile tab and shows in the saved log.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { ensureAdmin } from "@/lib/requireAdmin";
import { upsertReconcileStatus, isReconcileStatus } from "@/lib/reconcileStatus";
import { logActivity } from "@/lib/activityLog";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!ensureAdmin(session, res)) return;
  const adminId = (session?.user as { id?: string } | undefined)?.id ?? null;

  if (req.method === "DELETE") {
    const { paymentId } = req.body as { paymentId?: string };
    if (!paymentId) return res.status(400).json({ error: "paymentId required" });
    await prisma.paymentReconcile.deleteMany({ where: { razorpay_payment_id: paymentId } });
    return res.json({ ok: true, cleared: true });
  }

  if (req.method !== "POST") return res.status(405).end();

  const { paymentId, status, orderId, amountPaise, note } = req.body as {
    paymentId?: string;
    status?: string;
    orderId?: string;
    amountPaise?: number;
    note?: string;
  };
  if (!paymentId) return res.status(400).json({ error: "paymentId required" });
  if (!isReconcileStatus(status)) {
    return res.status(400).json({ error: "status must be done | in_progress | dropped | needs_refund" });
  }

  await upsertReconcileStatus({
    razorpayPaymentId: paymentId,
    status,
    razorpayOrderId: orderId ?? null,
    amountPaise: typeof amountPaise === "number" ? amountPaise : null,
    note: note ?? null,
    resolvedBy: adminId,
  });

  logActivity({
    req,
    action: "admin.reconcile_status_set",
    entity: { type: "payment", id: paymentId },
    metadata: { status, note: note ?? undefined },
  });

  return res.json({ ok: true, status });
}
