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
  parsePayoutPeriod,
  resolvePayoutPeriod,
  PAYOUT_ELIGIBLE_STATUSES,
  type PayableBasis,
  type RateCard,
} from "@/lib/payoutCalc";
import { getPayoutSettings } from "@/lib/payoutSettings";
import { hasRole } from "@/lib/auth/roles";

/**
 * Per-attendee payout ledger for ONE instructor in a structured period.
 * Merges the admin adjustment row (extras, overrides, paid state) for that period, keyed
 * on the resolved period key (always a non-empty string — every period has one).
 *
 * Query:
 *   instructorId=<id>                          (required)
 *   granularity=month|quarter|year|all          (default month)
 *   year=<number>                               (required for month/quarter/year)
 *   index=<number>                              (month 1-12, quarter 1-4; ignored for year/all)
 *
 * Line-item count reconciliation (invariant for every basis):
 *   sum of a schedule's row counts === payableForSchedule(..., basis)
 *   so the ledger footer total reconciles with the aggregate endpoint.
 *
 *   all_booked: count = isPayable(b, start) ? 1 : 0; floor bonus on first row when base=0 and on_time.
 *   checked_in: count = check_in_outcome on_time|late ? 1 : 0; no floor.
 *   per_class:  first member row count=1, rest=0; synthetic row count=1.
 *   No-bookings synthetic row: count=schedulePayable (0 or 1 for on_time floor / per_class).
 */

/**
 * Per-row payable count for a single booking row, basis-aware.
 * Does NOT apply the on_time floor — that is handled at schedule level.
 */
function rowCountFor(
  basis: PayableBasis,
  b: { status: string; checked_in: boolean; cancellation_date: Date | null; check_in_outcome: string | null },
  start: Date,
): number {
  if (basis === "per_class") return 0; // per-class unit is attached once per schedule, not per row
  if (basis === "checked_in") return b.check_in_outcome === "on_time" || b.check_in_outcome === "late" ? 1 : 0;
  return isPayable(b, start) ? 1 : 0; // all_booked
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  const role = (session.user as { role?: string }).role;
  if (!hasRole(role, "admin")) return res.status(403).json({ error: "Forbidden" });

  const instructorId =
    typeof req.query.instructorId === "string" ? req.query.instructorId.trim() : "";
  if (!instructorId) return res.status(400).json({ error: "instructorId is required" });

  const now = new Date();
  const period = parsePayoutPeriod(req.query as Record<string, unknown>, now);
  const resolved = resolvePayoutPeriod(period, now);
  const { start, end, key: periodKey, label } = resolved;

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
  // Only payout-eligible statuses are included; ineligible statuses (e.g. cancelled) are excluded.
  const schedules = await prisma.classSchedule.findMany({
    where: {
      start_time: scheduleStart,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status: { in: PAYOUT_ELIGIBLE_STATUSES as unknown as any[] },
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
          check_in_outcome: true,
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

  const basis = settings.payableBasis as PayableBasis;

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
      basis,
    );
    computedPayableUnits += schedulePayable;

    if (s.bookings.length === 0) {
      // Synthetic row. count=schedulePayable covers: per_class=1, all_booked on_time floor=1,
      // checked_in with no attendees=0.
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
      // Compute per-row counts; then reconcile with schedulePayable via a bonus on the first row.
      const rowCounts = s.bookings.map((b) => rowCountFor(basis, b, s.start_time));
      const rowSum = rowCounts.reduce((a, n) => a + n, 0);
      // Bonus = gap between schedulePayable and raw row sum:
      // - all_booked: fires when base=0 and on_time floor gives schedulePayable=1 (bonus=+1 on row 0).
      // - per_class:  rowCounts are all 0; bonus=1 on row 0 so sum equals schedulePayable=1.
      // - checked_in: rowSum === schedulePayable always (no floor), so bonus=0.
      const firstRowBonus = schedulePayable - rowSum;

      s.bookings.forEach((b, idx) => {
        lineItems.push({
          scheduleId: s.id,
          date: s.start_time.toISOString(),
          startTime: s.start_time.toISOString(),
          endTime: s.end_time?.toISOString() ?? null,
          className,
          member: b.profile?.full_name ?? "Unknown",
          membershipType: b.user_package?.package_type?.name ?? "Unknown",
          count: rowCounts[idx] + (idx === 0 ? firstRowBonus : 0),
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
    granularity: period.granularity,
    key: periodKey,
    label,
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
