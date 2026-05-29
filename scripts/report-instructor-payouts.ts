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
 *   - netPerUnit = 945 - 5% = 897.75
 *   - payout = N * 897.75 * (100 - studio_cut%) / 100
 */
import { config as loadEnv } from "dotenv";
import path from "node:path";
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

import prisma from "@/lib/prisma";

const CLASS_RATE_INR = 945;
const GST_PERCENT = 5;
const NET_PER_UNIT = CLASS_RATE_INR * (1 - GST_PERCENT / 100); // 897.75
const DEFAULT_STUDIO_CUT_PERCENT = 40;
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

function isPayable(
  b: { status: string; cancellation_date: Date | null },
  startTime: Date,
): boolean {
  if (b.status === "cancelled") {
    if (!b.cancellation_date) return false; // can't prove late -> treat timely (no pay)
    const lead = startTime.getTime() - b.cancellation_date.getTime();
    return lead < SIX_HOURS_MS; // cancelled inside 6h window -> no refund -> paid
  }
  return true; // checked-in OR no-show
}

async function main() {
  const now = new Date();

  const schedules = await prisma.classSchedule.findMany({
    where: { start_time: { lte: now } },
    select: {
      id: true,
      start_time: true,
      instructor_id: true,
      actual_instructor_id: true,
      instructor_check_in_outcome: true,
      instructor: { select: { name: true, studio_payout_cut_percent: true } },
      actual_instructor: { select: { name: true, studio_payout_cut_percent: true } },
      bookings: {
        select: { status: true, checked_in: true, cancellation_date: true },
      },
    },
  });

  type Agg = {
    name: string;
    studioCut: number;
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

    const studioCutRaw = insRow.studio_payout_cut_percent;
    const studioCut =
      studioCutRaw != null && Number.isFinite(Number(studioCutRaw))
        ? Number(studioCutRaw)
        : DEFAULT_STUDIO_CUT_PERCENT;

    const prev = byInstructor.get(teachId);
    if (prev) {
      prev.classes += 1;
      prev.checkIns += checkIns;
      prev.payableUnits += payable;
    } else {
      byInstructor.set(teachId, {
        name: insRow.name,
        studioCut,
        classes: 1,
        checkIns,
        payableUnits: payable,
      });
    }
  }

  const rows = [...byInstructor.values()]
    .map((a) => {
      const instructorPct = Math.max(0, Math.min(100, 100 - a.studioCut));
      const payout = a.payableUnits * NET_PER_UNIT * (instructorPct / 100);
      return { ...a, instructorPct, payout };
    })
    .sort((x, y) => y.payout - x.payout);

  const pad = (s: string | number, n: number) => String(s).padEnd(n);
  const padL = (s: string | number, n: number) => String(s).padStart(n);

  console.log(
    `\nProjected instructor payouts (ALL-TIME, classes started <= now)\n` +
      `Class rate ₹${CLASS_RATE_INR} − ${GST_PERCENT}% GST = ₹${NET_PER_UNIT}/unit | default studio cut ${DEFAULT_STUDIO_CUT_PERCENT}%\n`,
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
