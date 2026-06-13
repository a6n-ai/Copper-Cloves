/**
 * READ-ONLY report — projected instructor payouts under the new rules.
 * Run: npx tsx scripts/report-instructor-payouts.ts
 *
 * Rules:
 *   - Per past class schedule, attribute to actual_instructor_id ?? instructor_id.
 *   - Payable booking rows = every row EXCEPT members who cancelled >=6h before start
 *     (refunded). Checked-in, no-show, and late-cancel (<6h) rows all pay.
 *   - Cancelled with no cancellation_date => treated as timely (no pay).
 *   - Guests already have their own rows, so we just count rows (no extra_guest_count).
 *   - Floor: if a class has 0 payable rows but the instructor checked in on_time, N=1.
 *   - Blended rate = autoBlendedRate(resolvedCard, gstPercent, instructorPct) — paise.
 *   - payout = payoutForUnits(N, blendedPaise) / 100  (rupees for display).
 */
import { config as loadEnv } from "dotenv";
import path from "node:path";
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

import prisma from "@/lib/prisma";
import { getPayoutSettings } from "@/lib/payoutSettings";
import {
  autoBlendedRate,
  instructorPctFrom,
  isPayable,
  payoutForUnits,
  resolveRateCard,
  type RateCard,
} from "@/lib/payoutCalc";

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

async function main() {
  const settings = await getPayoutSettings();
  const globalCard: RateCard = {
    rate12: settings.rate12,
    rate8: settings.rate8,
    rate4: settings.rate4,
    rate1: settings.rate1,
  };

  const now = new Date();

  const schedules = await prisma.classSchedule.findMany({
    where: { start_time: { lte: now } },
    select: {
      id: true,
      start_time: true,
      instructor_id: true,
      actual_instructor_id: true,
      instructor_check_in_outcome: true,
      instructor: {
        select: {
          name: true,
          studio_payout_cut_percent: true,
          rate_12_paise: true,
          rate_8_paise: true,
          rate_4_paise: true,
          rate_1_paise: true,
        },
      },
      actual_instructor: {
        select: {
          name: true,
          studio_payout_cut_percent: true,
          rate_12_paise: true,
          rate_8_paise: true,
          rate_4_paise: true,
          rate_1_paise: true,
        },
      },
      bookings: {
        select: { status: true, checked_in: true, cancellation_date: true },
      },
    },
  });

  type Agg = {
    name: string;
    studioCut: number;
    blendedRatePaise: number;
    classes: number;
    checkIns: number;
    payableUnits: number;
  };
  const byInstructor = new Map<string, Agg>();

  for (const s of schedules) {
    const teachId = s.actual_instructor_id ?? s.instructor_id;
    if (!teachId) continue;
    const insRow = s.actual_instructor_id ? s.actual_instructor : s.instructor;
    if (!insRow) continue;

    const checkIns = s.bookings.filter((b) => b.checked_in).length;
    let payable = s.bookings.filter((b) => isPayable(b, s.start_time)).length;
    if (payable === 0 && s.instructor_check_in_outcome === "on_time") payable = 1;

    const studioCutPct = insRow.studio_payout_cut_percent;
    const studioCut =
      studioCutPct != null && Number.isFinite(Number(studioCutPct))
        ? Number(studioCutPct)
        : settings.defaultStudioCutPercent;
    const instructorPct = instructorPctFrom(studioCut);

    const card = resolveRateCard(
      {
        rate_12_paise: insRow.rate_12_paise ?? null,
        rate_8_paise: insRow.rate_8_paise ?? null,
        rate_4_paise: insRow.rate_4_paise ?? null,
        rate_1_paise: insRow.rate_1_paise ?? null,
      },
      globalCard,
    );
    const blendedRatePaise = autoBlendedRate(card, settings.gstPercent, instructorPct);

    const prev = byInstructor.get(teachId);
    if (prev) {
      prev.classes += 1;
      prev.checkIns += checkIns;
      prev.payableUnits += payable;
    } else {
      byInstructor.set(teachId, {
        name: insRow.name,
        studioCut,
        blendedRatePaise,
        classes: 1,
        checkIns,
        payableUnits: payable,
      });
    }
  }

  const rows = [...byInstructor.values()]
    .map((a) => {
      const instructorPct = Math.max(0, Math.min(100, 100 - a.studioCut));
      const payoutRupees = payoutForUnits(a.payableUnits, a.blendedRatePaise) / 100;
      return { ...a, instructorPct, payout: payoutRupees };
    })
    .sort((x, y) => y.payout - x.payout);

  const pad = (s: string | number, n: number) => String(s).padEnd(n);
  const padL = (s: string | number, n: number) => String(s).padStart(n);

  const netPerUnitDisplay = (rows[0]?.blendedRatePaise ?? 0) / 100;
  console.log(
    `\nProjected instructor payouts (ALL-TIME, classes started <= now)\n` +
      `Blended rate ~₹${netPerUnitDisplay.toFixed(2)}/unit (settings-driven, tiered) | default studio cut ${settings.defaultStudioCutPercent}%\n`,
  );
  console.log(
    `${pad("Instructor", 22)} ${padL("Classes", 8)} ${padL("CheckIns", 9)} ${padL("Payable", 8)} ${padL("Studio%", 8)} ${padL("Instr%", 7)} ${padL("Payout ₹", 12)}`,
  );
  console.log("-".repeat(80));

  let tClasses = 0,
    tCheck = 0,
    tPay = 0,
    tPayout = 0;
  for (const r of rows) {
    console.log(
      `${pad(r.name.slice(0, 22), 22)} ${padL(r.classes, 8)} ${padL(r.checkIns, 9)} ${padL(r.payableUnits, 8)} ${padL(r.studioCut, 8)} ${padL(r.instructorPct, 7)} ${padL(r.payout.toFixed(2), 12)}`,
    );
    tClasses += r.classes;
    tCheck += r.checkIns;
    tPay += r.payableUnits;
    tPayout += r.payout;
  }
  console.log("-".repeat(80));
  console.log(
    `${pad("TOTAL (" + rows.length + " instructors)", 22)} ${padL(tClasses, 8)} ${padL(tCheck, 9)} ${padL(tPay, 8)} ${padL("", 8)} ${padL("", 7)} ${padL(tPayout.toFixed(2), 12)}`,
  );

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  console.error(e);
  try {
    await prisma.$disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
