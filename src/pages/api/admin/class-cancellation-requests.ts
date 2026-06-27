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
import { cancelBookingWithRefund } from "@/lib/classCancellation";

const STATUSES = ["open", "approved", "denied"] as const;
type CancellationStatus = (typeof STATUSES)[number];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  if ((session.user as { role?: string }).role !== "admin") return res.status(403).json({ error: "Forbidden" });
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
    const { id, action, reason } = (req.body ?? {}) as {
      id?: string;
      action?: string;
      reason?: string;
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

    if (action === "approve") {
      // Cancel + refund-as-pass. Phase 6 owns the body of this helper.
      await cancelBookingWithRefund(existing.booking_id, {
        cancelledBy: adminId ?? undefined,
        reason: reason ?? existing.reason ?? undefined,
      });
    }

    const updated = await prisma.classCancellationRequest.update({
      where: { id },
      data: {
        status: newStatus,
        decided_by: adminId,
        decided_at: new Date(),
        ...(reason !== undefined ? { reason } : {}),
      },
    });
    return res.json({ request: updated });
  }

  res.setHeader("Allow", "GET, PATCH");
  return res.status(405).end();
}
