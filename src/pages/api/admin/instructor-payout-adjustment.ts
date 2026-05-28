import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { periodKeyFor, periodBoundsFor, type PayoutWindow } from "@/lib/payoutCalc";

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
    const window = parseWindow(req.query.window);
    if (!instructorId) return res.status(400).json({ error: "instructorId required" });
    const periodKey = periodKeyFor(window, new Date());
    const row = await prisma.instructorPayoutAdjustment.findUnique({
      where: { instructor_id_period_key: { instructor_id: instructorId, period_key: periodKey } },
    });
    return res.json({ adjustment: row, periodKey, window });
  }

  if (req.method === "PUT") {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const instructorId = String(body.instructorId ?? "").trim();
    const window = parseWindow(body.window);
    if (!instructorId) return res.status(400).json({ error: "instructorId required" });

    const now = new Date();
    const periodKey = periodKeyFor(window, now);
    const bounds = periodBoundsFor(window, now);

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
    if (body.notes !== undefined) data.notes = body.notes ? String(body.notes) : null;
    if (body.paid_method !== undefined)
      data.paid_method = body.paid_method ? String(body.paid_method) : null;
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
    return res.json({ adjustment: row, periodKey });
  }

  res.status(405).end();
}

function parseWindow(raw: unknown): PayoutWindow {
  const allowed: PayoutWindow[] = ["week", "month", "quarter", "all"];
  return allowed.includes(raw as PayoutWindow) ? (raw as PayoutWindow) : "month";
}
