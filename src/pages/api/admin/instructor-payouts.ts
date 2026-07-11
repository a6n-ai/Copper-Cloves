import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import {
  instructorPctFrom,
  payableForSchedule,
  payoutForUnits,
  parsePayoutPeriod,
  resolvePayoutPeriod,
  resolveRateCard,
  autoBlendedRate,
  netRateBreakdown,
  effectiveBlendedRate,
  PAYOUT_ELIGIBLE_STATUSES,
  type PayableBasis,
  type RateCard,
} from "@/lib/payoutCalc";
import { getPayoutSettings } from "@/lib/payoutSettings";

/**
 * Per-instructor payout for the requested structured period (default current month).
 * Merges admin adjustments + paid state from `instructor_payout_adjustments`, keyed on
 * the resolved period key (always a non-empty string — every period, including "all",
 * has one).
 *
 * Query:
 *   granularity=month|quarter|year|all      (default month)
 *   year=<number>                           (required for month/quarter/year)
 *   index=<number>                          (month 1-12, quarter 1-4; ignored for year/all)
 *   instructorId=<id>                       (optional filter to one instructor)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  const role = (session.user as { role?: string }).role;
  if (role !== "admin") return res.status(403).json({ error: "Forbidden" });
  if (req.method !== "GET") return res.status(405).end();

  const instructorFilter =
    typeof req.query.instructorId === "string" && req.query.instructorId.trim()
      ? req.query.instructorId.trim()
      : null;

  const now = new Date();
  const period = parsePayoutPeriod(req.query as Record<string, unknown>, now);
  const { start, end, key: periodKey } = resolvePayoutPeriod(period, now);

  const settings = await getPayoutSettings();
  const globalCard: RateCard = {
    rate12: settings.rate12,
    rate8: settings.rate8,
    rate4: settings.rate4,
    rate1: settings.rate1,
  };

  // Only schedules that have already started (no payout for future classes).
  const scheduleStart: Record<string, Date> = { lte: now };
  if (start) scheduleStart.gte = start;
  if (end && end < now) scheduleStart.lt = end;

  const schedules = await prisma.classSchedule.findMany({
    where: {
      start_time: scheduleStart,
      OR: [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { status: { in: PAYOUT_ELIGIBLE_STATUSES as unknown as any[] } },
        // Cron-lag guard: an `available` class whose end_time has passed is
        // effectively completed (mirrors scheduleEditLock) and must be payable
        // even if the lifecycle cron hasn't flipped it to `completed` yet.
        // cancelled / abandoned / inactive stay excluded.
        { status: "available", end_time: { lt: now } },
      ],
    },
    select: {
      id: true,
      start_time: true,
      instructor_id: true,
      actual_instructor_id: true,
      instructor_check_in_outcome: true,
      instructor: {
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
      },
      actual_instructor: {
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
      },
      bookings: {
        select: { status: true, checked_in: true, cancellation_date: true, check_in_outcome: true },
      },
    },
  });

  type Agg = {
    instructorId: string;
    name: string;
    imageUrl: string | null;
    specialties: string[];
    studioCutPercent: number;
    classes: number;
    checkIns: number;
    payableUnits: number;
    rateOverride: {
      rate_12_paise: number | null;
      rate_8_paise: number | null;
      rate_4_paise: number | null;
      rate_1_paise: number | null;
    };
  };
  const tally = new Map<string, Agg>();

  for (const s of schedules) {
    const teachId = s.actual_instructor_id ?? s.instructor_id;
    if (!teachId) continue;
    if (instructorFilter && teachId !== instructorFilter) continue;
    const ins = s.actual_instructor_id ? s.actual_instructor : s.instructor;
    if (!ins) continue;

    const checkIns = s.bookings.filter((b) => b.checked_in).length;
    const payable = payableForSchedule(
      s.bookings,
      s.start_time,
      s.instructor_check_in_outcome,
      settings.payableBasis as PayableBasis,
    );
    const studioCutRaw = ins.studio_payout_cut_percent;
    const studioCut =
      studioCutRaw != null && Number.isFinite(Number(studioCutRaw))
        ? Number(studioCutRaw)
        : settings.defaultStudioCutPercent;

    const prev = tally.get(teachId);
    if (prev) {
      prev.classes += 1;
      prev.checkIns += checkIns;
      prev.payableUnits += payable;
    } else {
      tally.set(teachId, {
        instructorId: teachId,
        name: ins.name,
        imageUrl: ins.image_url ?? null,
        specialties: ins.specialties ?? [],
        studioCutPercent: studioCut,
        classes: 1,
        checkIns,
        payableUnits: payable,
        rateOverride: {
          rate_12_paise: ins.rate_12_paise ?? null,
          rate_8_paise: ins.rate_8_paise ?? null,
          rate_4_paise: ins.rate_4_paise ?? null,
          rate_1_paise: ins.rate_1_paise ?? null,
        },
      });
    }
  }

  const instructorIds = [...tally.keys()];
  const adjustments = instructorIds.length
    ? await prisma.instructorPayoutAdjustment.findMany({
        where: { instructor_id: { in: instructorIds }, period_key: periodKey },
      })
    : [];
  const adjByInstructor = new Map(adjustments.map((a) => [a.instructor_id, a]));

  const instructors = [...tally.values()].map((a) => {
    const adj = adjByInstructor.get(a.instructorId);
    const extraPayable = adj?.extra_payable_units ?? 0;
    const extraClasses = adj?.extra_classes ?? 0;
    const effectivePayable = Math.max(0, a.payableUnits + extraPayable);
    const instructorPct = instructorPctFrom(a.studioCutPercent);

    const card = resolveRateCard(a.rateOverride, globalCard);
    const autoBlended = autoBlendedRate(card, settings.gstPercent, instructorPct);
    const breakdown = netRateBreakdown(card, settings.gstPercent, instructorPct);

    const isPaid = !!adj?.paid_at;
    const blendedPaise = isPaid && adj?.paid_blended_rate_paise != null
      ? adj.paid_blended_rate_paise
      : effectiveBlendedRate(adj?.override_blended_rate_paise ?? null, autoBlended);

    const computedTotalPaise = payoutForUnits(effectivePayable, blendedPaise);
    const overridePaise = adj?.override_payout_paise ?? null;
    const totalPaise = isPaid && adj?.paid_total_paise != null
      ? adj.paid_total_paise
      : overridePaise != null
        ? overridePaise
        : computedTotalPaise;

    return {
      instructorId: a.instructorId,
      name: a.name,
      imageUrl: a.imageUrl,
      specialties: a.specialties.slice(0, 2).join(", ") || "Classes",
      classes: a.classes + extraClasses,
      computedClasses: a.classes,
      extraClasses,
      checkIns: a.checkIns,
      payableUnits: effectivePayable,
      computedPayableUnits: a.payableUnits,
      extraPayableUnits: extraPayable,
      percentage: instructorPct,
      studioCutPercent: a.studioCutPercent,
      rateCard: card,
      netBreakdown: breakdown,
      autoBlendedRatePaise: autoBlended,
      overrideBlendedRatePaise: adj?.override_blended_rate_paise ?? null,
      blendedRatePaise: blendedPaise,
      netPerUnit: blendedPaise / 100,
      gstPercent: settings.gstPercent,
      total: Math.round(totalPaise) / 100,
      overrideTotal: overridePaise != null ? overridePaise / 100 : null,
      paidAt: adj?.paid_at ?? null,
      paidMethod: adj?.paid_method ?? null,
      notes: adj?.notes ?? null,
      status: adj?.paid_at ? ("paid" as const) : ("pending" as const),
    };
  });

  instructors.sort((a, b) => b.payableUnits - a.payableUnits);

  const totalPayouts = instructors.reduce((s, i) => s + i.total, 0);
  const pendingPayments = instructors
    .filter((i) => !i.paidAt)
    .reduce((s, i) => s + i.total, 0);
  const completedPayments = instructors
    .filter((i) => i.paidAt)
    .reduce((s, i) => s + i.total, 0);
  const pendingCount = instructors.filter((i) => !i.paidAt && i.total > 0).length;

  return res.json({
    summary: {
      totalPayouts: Math.round(totalPayouts * 100) / 100,
      pendingPayments: Math.round(pendingPayments * 100) / 100,
      completedPayments: Math.round(completedPayments * 100) / 100,
      totalCheckIns: instructors.reduce((s, i) => s + i.checkIns, 0),
      totalPayableUnits: instructors.reduce((s, i) => s + i.payableUnits, 0),
      instructorsCount: instructors.length,
      pendingCount,
      granularity: period.granularity,
      periodKey,
      periodStart: start?.toISOString() ?? null,
      periodEnd: end?.toISOString() ?? null,
      gstPercent: settings.gstPercent,
      payableBasis: settings.payableBasis,
    },
    instructors,
  });
}
