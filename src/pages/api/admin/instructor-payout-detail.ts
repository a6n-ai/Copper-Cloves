import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import {
  isPayable,
  payableForSchedule,
  instructorPctFrom,
  resolveRateCard,
  autoBlendedRate,
  netRateBreakdown,
  effectiveBlendedRate,
  payoutForUnits,
  periodBoundsFor,
  periodKeyFor,
  type PayoutWindow,
  type RateCard,
} from "@/lib/payoutCalc";
import { getPayoutSettings } from "@/lib/payoutSettings";

/**
 * Per-attendee payout ledger for ONE instructor in a calendar window.
 *
 * Query:
 *   instructorId=<id>              (required)
 *   window=week|month|quarter|all  (default month)
 *
 * Line-item count reconciliation:
 *   Per booking row:  count = isPayable(booking, startTime) ? 1 : 0
 *   This counts BOOKING ROWS, consistent with payableForSchedule which also counts rows.
 *   For a schedule where all bookings score 0 but the instructor checked in on_time
 *   (floor=1), the synthetic "No attendees" row carries count=1 to represent that floor.
 *   Summing per-row counts across a schedule therefore equals payableForSchedule(...).
 *   The authoritative period total (footer.payableUnits = computedPayableUnits) is
 *   derived by summing payableForSchedule(...) — identical path to the aggregate endpoint.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  const role = (session.user as { role?: string }).role;
  if (role !== "admin") return res.status(403).json({ error: "Forbidden" });

  const instructorId =
    typeof req.query.instructorId === "string" ? req.query.instructorId.trim() : "";
  if (!instructorId) return res.status(400).json({ error: "instructorId is required" });

  const windowRaw = typeof req.query.window === "string" ? req.query.window : "month";
  const payoutWindow: PayoutWindow = (["week", "month", "quarter", "all"] as const).includes(
    windowRaw as PayoutWindow,
  )
    ? (windowRaw as PayoutWindow)
    : "month";

  const now = new Date();
  const { start, end } = periodBoundsFor(payoutWindow, now);
  const periodKey = periodKeyFor(payoutWindow, now);

  const settings = await getPayoutSettings();
  const globalCard: RateCard = {
    rate12: settings.rate12,
    rate8: settings.rate8,
    rate4: settings.rate4,
    rate1: settings.rate1,
  };

  // Load instructor row.
  const instructor = await prisma.instructor.findUnique({
    where: { id: instructorId },
    select: {
      id: true,
      name: true,
      image_url: true,
      specialties: true,
      studio_payout_cut_percent: true,
      rate_12_paise: true,
      rate_8_paise: true,
      rate_4_paise: true,
      rate_1_paise: true,
    },
  });
  if (!instructor) return res.status(404).json({ error: "Instructor not found" });

  // Build schedule start filter — only started classes, capped to window.
  const scheduleStart: Record<string, Date> = { lte: now };
  if (start) scheduleStart.gte = start;
  if (end && end < now) scheduleStart.lt = end;

  // Query schedules taught by this instructor (direct or as substitute).
  const schedules = await prisma.classSchedule.findMany({
    where: {
      start_time: scheduleStart,
      OR: [
        { actual_instructor_id: instructorId },
        { actual_instructor_id: null, instructor_id: instructorId },
      ],
    },
    orderBy: { start_time: "asc" },
    select: {
      id: true,
      start_time: true,
      end_time: true,
      instructor_check_in_outcome: true,
      class_model: { select: { name: true } },
      bookings: {
        select: {
          status: true,
          checked_in: true,
          cancellation_date: true,
          extra_guest_count: true,
          class_name: true,
          profile: { select: { full_name: true } },
          user_package: {
            select: { package_type: { select: { name: true } } },
          },
        },
      },
    },
  });

  // Build line items — one row per booking, or one synthetic row for empty schedules.
  type LineItem = {
    scheduleId: string;
    date: string;
    startTime: string;
    endTime: string | null;
    className: string;
    member: string;
    membershipType: string;
    count: number;
    checkedIn: boolean;
    isPlaceholder: boolean;
  };

  const lineItems: LineItem[] = [];
  let computedPayableUnits = 0;

  for (const s of schedules) {
    // Derive class name from class_model, falling back to first booking's class_name field.
    const className =
      s.class_model?.name ??
      (s.bookings.length > 0 ? s.bookings[0].class_name : null) ??
      "Class";

    const schedulePayable = payableForSchedule(
      s.bookings,
      s.start_time,
      s.instructor_check_in_outcome,
    );
    computedPayableUnits += schedulePayable;

    if (s.bookings.length === 0) {
      // Synthetic row. count=schedulePayable captures the on_time floor (0 or 1).
      lineItems.push({
        scheduleId: s.id,
        date: s.start_time.toISOString(),
        startTime: s.start_time.toISOString(),
        endTime: s.end_time?.toISOString() ?? null,
        className,
        member: "No attendees",
        membershipType: "",
        count: schedulePayable,
        checkedIn: false,
        isPlaceholder: true,
      });
    } else {
      const basePayable = s.bookings.filter((b) => isPayable(b, s.start_time)).length;
      // If base=0 but floor kicks in (on_time), emit the extra unit on the first row.
      const floorBonus = schedulePayable > basePayable ? 1 : 0;

      s.bookings.forEach((b, idx) => {
        const rowPayable = isPayable(b, s.start_time) ? 1 : 0;
        // Distribute the floor bonus onto the first row so per-row counts sum to
        // schedulePayable. This only fires when base=0 and floor=1 (all rows are 0
        // except the first, which gets the bonus +1).
        const bonus = idx === 0 ? floorBonus : 0;
        lineItems.push({
          scheduleId: s.id,
          date: s.start_time.toISOString(),
          startTime: s.start_time.toISOString(),
          endTime: s.end_time?.toISOString() ?? null,
          className,
          member: b.profile?.full_name ?? "Unknown",
          membershipType: b.user_package?.package_type?.name ?? "Unknown",
          count: rowPayable + bonus,
          checkedIn: b.checked_in === true,
          isPlaceholder: false,
        });
      });
    }
  }

  // Load adjustment for this instructor + period.
  const adj = await prisma.instructorPayoutAdjustment.findUnique({
    where: {
      instructor_id_period_key: { instructor_id: instructorId, period_key: periodKey },
    },
  });

  // Compute footer — mirrors the aggregate endpoint exactly.
  const studioCutRaw = instructor.studio_payout_cut_percent;
  const studioCut =
    studioCutRaw != null && Number.isFinite(Number(studioCutRaw))
      ? Number(studioCutRaw)
      : settings.defaultStudioCutPercent;
  const instructorPct = instructorPctFrom(studioCut);

  const rateOverride = {
    rate_12_paise: instructor.rate_12_paise ?? null,
    rate_8_paise: instructor.rate_8_paise ?? null,
    rate_4_paise: instructor.rate_4_paise ?? null,
    rate_1_paise: instructor.rate_1_paise ?? null,
  };
  const card = resolveRateCard(rateOverride, globalCard);
  const autoBlended = autoBlendedRate(card, settings.gstPercent, instructorPct);
  const breakdown = netRateBreakdown(card, settings.gstPercent, instructorPct);

  const extraPayable = adj?.extra_payable_units ?? 0;
  const effectivePayable = Math.max(0, computedPayableUnits + extraPayable);

  const isPaid = !!adj?.paid_at;
  const blendedPaise =
    isPaid && adj?.paid_blended_rate_paise != null
      ? adj.paid_blended_rate_paise
      : effectiveBlendedRate(adj?.override_blended_rate_paise ?? null, autoBlended);

  const overridePaise = adj?.override_payout_paise ?? null;
  const totalPaise =
    isPaid && adj?.paid_total_paise != null
      ? adj.paid_total_paise
      : overridePaise != null
        ? overridePaise
        : payoutForUnits(effectivePayable, blendedPaise);

  return res.json({
    instructor: {
      id: instructor.id,
      name: instructor.name,
      imageUrl: instructor.image_url ?? null,
      specialties: instructor.specialties ?? [],
      studioCutPercent: studioCut,
      rateOverride,
    },
    window: payoutWindow,
    periodKey,
    periodStart: start?.toISOString() ?? null,
    periodEnd: end?.toISOString() ?? null,
    lineItems,
    footer: {
      gstPercent: settings.gstPercent,
      instructorPct,
      rateCard: card,
      netBreakdown: breakdown,
      averageNetPaise: Math.round(
        (breakdown.net12 + breakdown.net8 + breakdown.net4 + breakdown.net1) / 4,
      ),
      autoBlendedRatePaise: autoBlended,
      overrideBlendedRatePaise: adj?.override_blended_rate_paise ?? null,
      blendedRatePaise: blendedPaise,
      payableUnits: effectivePayable,
      computedPayableUnits,
      extraPayableUnits: extraPayable,
      totalPaise,
      overridePayoutPaise: overridePaise,
      status: isPaid ? ("paid" as const) : ("pending" as const),
      paidAt: adj?.paid_at ?? null,
    },
  });
}
