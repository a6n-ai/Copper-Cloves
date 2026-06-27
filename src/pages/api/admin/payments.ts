import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { logActivity } from "@/lib/activityLog";
import {
  deleteManualPayment,
  listManualPaymentsIn,
  recordManualPayment,
  updateManualPayment,
} from "@/lib/payments";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  const role = (session.user as { role?: string }).role;
  if (role !== "admin") return res.status(403).json({ error: "Forbidden" });
  const adminId = (session.user as { id?: string }).id ?? null;

  if (req.method === "GET") {
    // Manual Entries → Money In: serialized, member-joined, non-Razorpay credits.
    if (req.query.manual === "1") {
      return res.json({ payments: await listManualPaymentsIn() });
    }
    // Legacy raw-row shape (member Manage dialog history). Unchanged.
    const userId = typeof req.query.user_id === "string" ? req.query.user_id : "";
    const where = { direction: "credit" as const, ...(userId ? { user_id: userId } : {}) };
    const rows = await prisma.payment.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: 200,
      include: {
        booking: {
          select: {
            class_name: true,
            class_time: true,
            class_schedule: {
              select: {
                start_time: true,
                class_model: { select: { name: true } },
                instructor: { select: { name: true } },
              },
            },
          },
        },
        user_package: { select: { package_type: { select: { name: true } } } },
      },
    });
    // Flatten class context onto each payment so reconciliation reads name/
    // instructor/time directly instead of matching against a booking id.
    const enriched = rows.map((p) => {
      const sched = p.booking?.class_schedule;
      return {
        ...p,
        class_name: p.booking?.class_name ?? sched?.class_model?.name ?? null,
        instructor_name: sched?.instructor?.name ?? null,
        class_time: p.booking?.class_time ?? sched?.start_time ?? null,
        package_name: p.user_package?.package_type?.name ?? null,
      };
    });
    return res.json(enriched);
  }

  if (req.method === "POST") {
    const {
      user_id,
      user_package_id,
      booking_id,
      method,
      amount_paise,
      currency,
      reference,
      proof_url,
      notes,
    } = req.body ?? {};

    const result = await recordManualPayment({
      user_id,
      user_package_id,
      booking_id,
      method,
      amount_paise,
      currency,
      reference,
      proof_url,
      notes,
      recorded_by: adminId,
    });

    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }
    const payment = result.payment;
    if (result.replayed) {
      res.setHeader("X-Idempotent-Replay", "true");
      return res.status(200).json(payment);
    }
    await logActivity({
      req,
      action: "admin.payment_recorded",
      targetProfileId: payment.user_id,
      entity: { type: "payment", id: payment.id },
      metadata: { method: payment.method, amount_paise: payment.amount_paise },
    });
    return res.status(201).json(payment);
  }

  if (req.method === "PATCH") {
    const { id, amount_paise, method, reference, notes } = req.body ?? {};
    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "id required" });
    }
    let result;
    try {
      result = await updateManualPayment(id, { amount_paise, method, reference, notes });
    } catch (e) {
      return res.status(400).json({ error: (e as Error).message ?? "Invalid update" });
    }
    if (!result) {
      return res.status(404).json({ error: "Payment not found or not editable" });
    }
    // Log every edit, with the per-field diff. Skip the log on a no-op save.
    if (result.changes.length > 0) {
      await logActivity({
        req,
        action: "admin.payment_updated",
        entity: { type: "payment", id },
        metadata: {
          amount_paise: result.row.amountPaise,
          method: result.row.method,
          changed_fields: result.changes.map((c) => c.field),
          changes: result.changes,
        },
      });
    }
    return res.json({ payment: result.row });
  }

  if (req.method === "DELETE") {
    const id = String(req.query.id ?? "").trim();
    if (!id) return res.status(400).json({ error: "id required" });
    const ok = await deleteManualPayment(id);
    if (!ok) {
      return res.status(404).json({ error: "Payment not found or not deletable" });
    }
    await logActivity({ req, action: "admin.payment_deleted", entity: { type: "payment", id } });
    return res.json({ ok: true });
  }

  res.setHeader("Allow", "GET, POST, PATCH, DELETE");
  return res.status(405).end();
}
