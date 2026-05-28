import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import {
  CLASS_RATE_INR,
  GST_PERCENT,
  NET_PER_UNIT,
  DEFAULT_STUDIO_CUT_PERCENT,
  instructorPctFrom,
  payableForSchedule,
  payoutForUnits,
  periodBoundsFor,
  periodKeyFor,
  type PayoutWindow,
} from "@/lib/payoutCalc";

/**
 * Per-instructor payout for the requested calendar window (default current month),
 * merging admin adjustments + paid state from `instructor_payout_adjustments`.
 *
 * Query:
 *   window=week|month|quarter|all   (default month)
 *   instructorId=<id>               (optional filter to one instructor)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  const role = (session.user as { role?: string }).role;
  if (role !== "admin") return res.status(403).json({ error: "Forbidden" });
  if (req.method !== "GET") return res.status(405).end();

  const windowRaw = typeof req.query.window === "string" ? req.query.window : "month";
  const window: PayoutWindow = (["week", "month", "quarter", "all"] as const).includes(
    windowRaw as PayoutWindow,
  )
    ? (windowRaw as PayoutWindow)
    : "month";
  const instructorFilter =
    typeof req.query.instructorId === "string" && req.query.instructorId.trim()
      ? req.query.instructorId.trim()
      : null;

  const now = new Date();
  const { start, end } = periodBoundsFor(window, now);
  const periodKey = periodKeyFor(window, now);

  // Only schedules that have already started (no payout for future classes).
  const scheduleStart: Record<string, Date> = { lte: now };
  if (start) scheduleStart.gte = start;
  if (end && end < now) scheduleStart.lt = end;

  const schedules = await prisma.classSchedule.findMany({
    where: { start_time: scheduleStart },
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
        },
      },
      actual_instructor: {
        select: {
          id: true,
          name: true,
          image_url: true,
          specialties: true,
          studio_payout_cut_percent: true,
        },
      },
      bookings: {
        select: { status: true, checked_in: true, cancellation_date: true },
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
  };
  const tally = new Map<string, Agg>();

  for (const s of schedules) {
    const teachId = s.actual_instructor_id ?? s.instructor_id;
    if (!teachId) continue;
    if (instructorFilter && teachId !== instructorFilter) continue;
    const ins = s.actual_instructor_id ? s.actual_instructor : s.instructor;
    if (!ins) continue;

    const checkIns = s.bookings.filter((b) => b.checked_in).length;
    const payable = payableForSchedule(s.bookings, s.start_time, s.instructor_check_in_outcome);
    const studioCutRaw = ins.studio_payout_cut_percent;
    const studioCut =
      studioCutRaw != null && Number.isFinite(Number(studioCutRaw))
        ? Number(studioCutRaw)
        : DEFAULT_STUDIO_CUT_PERCENT;

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

  const instructors = [...tally.values()].map((a, idx) => {
    const adj = adjByInstructor.get(a.instructorId);
    const extraPayable = adj?.extra_payable_units ?? 0;
    const extraClasses = adj?.extra_classes ?? 0;
    const effectivePayable = Math.max(0, a.payableUnits + extraPayable);
    const instructorPct = instructorPctFrom(a.studioCutPercent);
    const computedPayout = payoutForUnits(effectivePayable, instructorPct);
    const overridePaise = adj?.override_payout_paise ?? null;
    const total = overridePaise != null ? overridePaise / 100 : computedPayout;
    return {
      id: idx + 1,
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
      netPerUnit: NET_PER_UNIT,
      rate: CLASS_RATE_INR,
      gstPercent: GST_PERCENT,
      percentage: instructorPct,
      studioCutPercent: a.studioCutPercent,
      total: Math.round(total * 100) / 100,
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
      window,
      periodKey,
      periodStart: start?.toISOString() ?? null,
      periodEnd: end?.toISOString() ?? null,
      netPerUnit: NET_PER_UNIT,
      classRate: CLASS_RATE_INR,
      gstPercent: GST_PERCENT,
    },
    instructors,
  });
}
