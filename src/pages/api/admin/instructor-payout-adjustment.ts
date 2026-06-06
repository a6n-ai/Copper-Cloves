import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { periodKeyFor, periodBoundsFor, type PayoutWindow } from "@/lib/payoutCalc";
import { recordPayoutExpense, removePayoutExpense } from "@/lib/expenses";
import type { PaymentMethod } from "@/generated/prisma/client";
import logger from "@/lib/logger";

function asString(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean" || typeof v === "bigint") return v.toString();
  return "";
}

// Best-effort map a free-text payout method onto the PaymentMethod enum used by
// the expense ledger. Unknown values record with no method rather than failing.
function coercePaymentMethod(raw: string | null | undefined): PaymentMethod | null {
  const m = (raw ?? "").toLowerCase();
  if (!m) return null;
  if (m.includes("cash")) return "cash";
  if (m.includes("card")) return "pine_lab_card";
  if (m.includes("upi")) return "direct_upi";
  if (m.includes("razorpay") || m.includes("online")) return "razorpay_online";
  return null;
}

/**
 * Admin overrides + paid state per (instructor, period).
 *
 * GET    ?instructorId=&window=     → adjustment row or {} if none
 * PUT    body { instructorId, window, extra_payable_units?, extra_classes?,
 *               override_payout_paise?, notes?, paid?, paid_method? }
 *        Upserts on (instructor_id, period_key).
 *        `paid: true` sets paid_at = now; `paid: false` clears it.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  const role = (session.user as { role?: string }).role;
  if (role !== "admin") return res.status(403).json({ error: "Forbidden" });

  const adminId = (session.user as { id?: string }).id ?? null;

  if (req.method === "GET") {
    const instructorId = String(req.query.instructorId ?? "").trim();
    const payoutWindow = parseWindow(req.query.window);
    if (!instructorId) return res.status(400).json({ error: "instructorId required" });
    const periodKey = periodKeyFor(payoutWindow, new Date());
    const row = await prisma.instructorPayoutAdjustment.findUnique({
      where: { instructor_id_period_key: { instructor_id: instructorId, period_key: periodKey } },
    });
    return res.json({ adjustment: row, periodKey, window: payoutWindow });
  }

  if (req.method === "PUT") {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const instructorId = asString(body.instructorId).trim();
    const payoutWindow = parseWindow(body.window);
    if (!instructorId) return res.status(400).json({ error: "instructorId required" });

    const now = new Date();
    const periodKey = periodKeyFor(payoutWindow, now);
    const bounds = periodBoundsFor(payoutWindow, now);

    const data: {
      extra_payable_units?: number;
      extra_classes?: number;
      override_payout_paise?: number | null;
      notes?: string | null;
      paid_at?: Date | null;
      paid_method?: string | null;
      recorded_by?: string | null;
    } = {};

    if (body.extra_payable_units != null) data.extra_payable_units = Number(body.extra_payable_units);
    if (body.extra_classes != null) data.extra_classes = Number(body.extra_classes);
    if (body.override_payout_paise === null) data.override_payout_paise = null;
    else if (body.override_payout_paise != null)
      data.override_payout_paise = Number(body.override_payout_paise);
    if (body.notes !== undefined) data.notes = body.notes ? asString(body.notes) : null;
    if (body.paid_method !== undefined)
      data.paid_method = body.paid_method ? asString(body.paid_method) : null;
    if (body.paid === true) data.paid_at = now;
    if (body.paid === false) data.paid_at = null;
    data.recorded_by = adminId;

    // Validate numeric fields.
    if (data.extra_payable_units != null && !Number.isFinite(data.extra_payable_units)) {
      return res.status(400).json({ error: "extra_payable_units must be a number" });
    }
    if (data.extra_classes != null && !Number.isFinite(data.extra_classes)) {
      return res.status(400).json({ error: "extra_classes must be a number" });
    }
    if (data.override_payout_paise != null && !Number.isFinite(data.override_payout_paise)) {
      return res.status(400).json({ error: "override_payout_paise must be a number" });
    }

    const row = await prisma.instructorPayoutAdjustment.upsert({
      where: { instructor_id_period_key: { instructor_id: instructorId, period_key: periodKey } },
      create: {
        instructor_id: instructorId,
        period_key: periodKey,
        period_start: bounds.start ?? new Date(0),
        period_end: bounds.end ?? new Date("9999-12-31"),
        extra_payable_units: data.extra_payable_units ?? 0,
        extra_classes: data.extra_classes ?? 0,
        override_payout_paise: data.override_payout_paise ?? null,
        notes: data.notes ?? null,
        paid_at: data.paid_at ?? null,
        paid_method: data.paid_method ?? null,
        recorded_by: data.recorded_by,
      },
      update: data,
    });

    // Payout → expense automation. Opt-in via `recordExpense` (defaults true).
    // Marking paid records the payout as an expense (idempotent per period);
    // un-marking paid removes it. Best-effort: never blocks the paid-state write.
    let expenseRecorded: boolean | null = null;
    try {
      const recordExpense = body.recordExpense !== false; // default on
      const payoutPaise = Number(body.payout_paise);
      if (body.paid === true && recordExpense && Number.isFinite(payoutPaise) && payoutPaise > 0) {
        await recordPayoutExpense({
          instructorId,
          periodKey,
          amountPaise: payoutPaise,
          incurredAt: now,
          method: coercePaymentMethod(data.paid_method),
          notes: data.notes ?? null,
          recordedBy: adminId,
        });
        expenseRecorded = true;
      } else if (body.paid === false) {
        await removePayoutExpense(instructorId, periodKey);
        expenseRecorded = false;
      }
    } catch (err) {
      logger.error({ err }, "payout→expense sync failed");
    }

    return res.json({ adjustment: row, periodKey, expenseRecorded });
  }

  res.status(405).end();
}

function parseWindow(raw: unknown): PayoutWindow {
  const allowed: PayoutWindow[] = ["week", "month", "quarter", "all"];
  return allowed.includes(raw as PayoutWindow) ? (raw as PayoutWindow) : "month";
}
