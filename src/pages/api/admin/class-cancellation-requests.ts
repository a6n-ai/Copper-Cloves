/**
 * Admin review of late-cancel requests (spec §9).
 *   GET  ?status=open|approved|denied → list requests (newest first), optionally
 *        filtered by status.
 *   PATCH { id, action: "approve" | "deny", reason? }
 *        approve → cancel the booking + refund-as-pass (delegated to
 *                  cancelBookingWithRefund — Phase 6 owns that logic).
 *        deny    → leave the booking intact.
 *      Both stamp status, decided_by, decided_at.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { cancelBookingWithRefund, refundOwnerClassCredit } from "@/lib/classCancellation";
import { hasRole } from "@/lib/auth/roles";

const STATUSES = ["open", "approved", "denied"] as const;
type CancellationStatus = (typeof STATUSES)[number];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  if (!hasRole((session.user as { role?: string }).role, "admin")) return res.status(403).json({ error: "Forbidden" });
  const adminId = (session.user as { id?: string }).id ?? null;

  if (req.method === "GET") {
    const statusFilter = typeof req.query.status === "string" ? req.query.status : undefined;
    const where =
      statusFilter && (STATUSES as readonly string[]).includes(statusFilter)
        ? { status: statusFilter }
        : {};
    const requests = await prisma.classCancellationRequest.findMany({
      where,
      orderBy: { created_at: "desc" },
      include: {
        profile: { select: { id: true, full_name: true, email: true } },
        booking: { select: { id: true, class_name: true, class_time: true, status: true } },
        class_schedule: {
          select: {
            id: true,
            start_time: true,
            class_model: { select: { name: true } },
          },
        },
      },
    });
    return res.json({ requests });
  }

  if (req.method === "PATCH") {
    const { id, action, reason, refund_type, refund_amount_paise } = (req.body ?? {}) as {
      id?: string;
      action?: string;
      reason?: string;
      refund_type?: string;
      refund_amount_paise?: number;
    };
    if (!id || typeof id !== "string") return res.status(400).json({ error: "id required" });
    if (action !== "approve" && action !== "deny") {
      return res.status(400).json({ error: "action must be 'approve' or 'deny'" });
    }

    const existing = await prisma.classCancellationRequest.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Request not found" });
    if (existing.status !== "open") {
      return res.status(409).json({ error: `Request already ${existing.status}` });
    }

    const newStatus: CancellationStatus = action === "approve" ? "approved" : "denied";
    const isRefundReq = existing.kind === "refund";
    let decidedRefundType: string | null = null;
    let decidedAmount: number | null = null;

    if (action === "approve" && isRefundReq) {
      // Refund request on an ALREADY-cancelled booking: admin grants either a
      // class pass or records a money refund. Booking is not re-cancelled.
      const rtype = refund_type === "amount" ? "amount" : "class_pass";
      decidedRefundType = rtype;
      if (rtype === "class_pass") {
        // Same behavior as auto-cancel: restore the credit to the original pass
        // when live, else grant a fresh 1 Class Pass (fallback inside the helper).
        const bk = await prisma.booking.findUnique({
          where: { id: existing.booking_id },
          select: { user_package_id: true },
        });
        const passId = await prisma.$transaction((tx) =>
          refundOwnerClassCredit(tx, existing.user_id, bk?.user_package_id ?? null, existing.booking_id),
        );
        await prisma.booking.update({
          where: { id: existing.booking_id },
          data: { refund_status: "approved_pass", refund_user_package_id: passId },
        });
      } else {
        const amt = Number(refund_amount_paise);
        decidedAmount = Number.isFinite(amt) && amt > 0 ? Math.round(amt) : null;
        await prisma.booking.update({
          where: { id: existing.booking_id },
          data: { refund_status: "approved_amount", refund_amount_paise: decidedAmount },
        });
      }
    } else if (action === "approve") {
      // Late-cancel request: cancel the booking + auto refund-as-pass.
      await cancelBookingWithRefund(existing.booking_id, {
        cancelledBy: adminId ?? undefined,
        reason: reason ?? existing.reason ?? undefined,
      });
    } else if (isRefundReq) {
      // Denied refund request — mark the booking so it's not re-requestable as pending.
      await prisma.booking.update({ where: { id: existing.booking_id }, data: { refund_status: "denied" } });
    }

    const updated = await prisma.classCancellationRequest.update({
      where: { id },
      data: {
        status: newStatus,
        decided_by: adminId,
        decided_at: new Date(),
        ...(reason !== undefined ? { reason } : {}),
        ...(decidedRefundType ? { refund_type: decidedRefundType } : {}),
        ...(decidedAmount != null ? { refund_amount_paise: decidedAmount } : {}),
      },
    });
    return res.json({ request: updated });
  }

  res.setHeader("Allow", "GET, PATCH");
  return res.status(405).end();
}
