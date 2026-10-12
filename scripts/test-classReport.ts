import assert from "node:assert/strict";
import {
  attentionReason,
  buildClassReport,
  disciplineLabel,
  emptyTotals,
  percentDelta,
  pointDelta,
  rates,
  resolveRange,
  type ReportRange,
  type SessionRow,
} from "../src/lib/classReport";

// Mon 12 Oct 2026, 17:30 IST.
const NOW = new Date("2026-10-12T12:00:00Z");
const ist = (day: string, hhmm: string) => new Date(`${day}T${hhmm}:00+05:30`);

let seq = 0;
function session(day: string, hhmm: string, over: Partial<SessionRow> = {}): SessionRow {
  const startTime = ist(day, hhmm);
  return {
    id: `s${++seq}`,
    classId: "c1",
    className: "Reformer Flow",
    category: "pilates",
    status: "completed",
    startTime,
    endTime: new Date(startTime.getTime() + 60 * 60 * 1000),
    capacity: 10,
    instructorId: "i1",
    instructorName: "Asha",
    bookings: [],
    ...over,
  };
}
const booked = (checkedIn = true, guests = 0) => ({
  status: "confirmed",
  checkedIn,
  outcome: checkedIn ? "on_time" : null,
  guests,
});
const noShow = () => ({ status: "confirmed", checkedIn: false, outcome: "no_show", guests: 0 });
const cancelled = () => ({ status: "cancelled", checkedIn: false, outcome: null, guests: 0 });
const pending = () => ({ status: "payment_pending", checkedIn: false, outcome: null, guests: 0 });

function range(from: string, to: string): ReportRange {
  const r = resolveRange(from, to, NOW);
  assert.ok(!("error" in r), "expected a valid range");
  return r as ReportRange;
}

// --- resolveRange ---------------------------------------------------------
{
  const def = resolveRange(undefined, undefined, NOW) as ReportRange;
  assert.equal(def.to, "2026-10-12");
  assert.equal(def.from, "2026-09-13");
  assert.equal(def.prevTo, "2026-09-12");
  assert.equal(def.prevFrom, "2026-08-14");
  assert.equal(def.bucket, "day");

  // Malformed input falls back to the default window.
  for (const bad of ["garbage", "2026-02-31", "", 42, null]) {
    const r = resolveRange(bad, "2026-10-12", NOW) as ReportRange;
    assert.equal(r.from, "2026-09-13", `fallback for ${String(bad)}`);
  }

  assert.ok("error" in resolveRange("2026-10-12", "2026-10-01", NOW), "reversed range rejected");
  assert.ok("error" in resolveRange("2025-09-01", "2026-10-12", NOW), "over 366 days rejected");

  const r = range("2026-10-01", "2026-10-12");
  // IST midnight is 18:30 UTC the day before.
  assert.equal(r.fromUtc.toISOString(), "2026-09-30T18:30:00.000Z");
  assert.equal(r.toUtcExclusive.toISOString(), "2026-10-12T18:30:00.000Z");
  assert.equal(r.prevFrom, "2026-09-19");
  assert.equal(r.prevTo, "2026-09-30");
  assert.equal(r.prevFromUtc.toISOString(), "2026-09-18T18:30:00.000Z");

  assert.equal(range("2026-09-01", "2026-10-12").bucket, "week");
  assert.equal(range("2026-09-12", "2026-10-12").bucket, "day"); // 31 days
}

// --- core math ------------------------------------------------------------
{
  const r = range("2026-10-01", "2026-10-12");
  const rows: SessionRow[] = [
    // Mon 5 Oct 05:00 IST = Sun 4 Oct 23:30 UTC. Ended.
    session("2026-10-05", "05:00", { bookings: [booked(), booked(true, 2), noShow(), cancelled(), pending()] }),
    // Mon 12 Oct 19:00 IST, still upcoming at NOW.
    session("2026-10-12", "19:00", { status: "available", bookings: [booked(false), booked(false)] }),
    // Excluded statuses never count.
    session("2026-10-06", "10:00", { status: "cancelled", bookings: [booked()] }),
    session("2026-10-06", "11:00", { status: "inactive", bookings: [booked()] }),
    session("2026-10-06", "12:00", { status: "abandoned", bookings: [booked()] }),
    // Previous period.
    session("2026-09-22", "10:00", { bookings: Array.from({ length: 8 }, () => booked()) }),
    // Outside both periods.
    session("2026-09-01", "10:00", { bookings: [booked()] }),
  ];
  const rep = buildClassReport(rows, r, NOW);

  assert.deepEqual(rep.current, {
    sessions: 2,
    seatsOffered: 20,
    signups: 7,
    bookedRows: 5,
    cancelledRows: 1,
    endedBookedRows: 3,
    attended: 2,
    noShows: 1,
  });
  assert.deepEqual(rates(rep.current), {
    utilization: 35,
    attendance: 66.7,
    noShowRate: 33.3,
    cancellationRate: 16.7,
  });
  assert.equal(rep.previous.sessions, 1);
  assert.equal(rates(rep.previous).utilization, 80);
  assert.equal(pointDelta(rates(rep.current).utilization, rates(rep.previous).utilization), -45);

  // Trend: one bucket per IST day, empty days present with zeros.
  assert.equal(rep.trend.length, 12);
  assert.equal(rep.trend[0].bucket, "2026-10-01");
  assert.equal(rep.trend[4].bucket, "2026-10-05");
  assert.equal(rep.trend[4].totals.signups, 5);
  assert.equal(rep.trend[3].totals.sessions, 0); // 4 Oct: the UTC day, not the IST day

  // Heatmap: IST hour and Monday-first weekday.
  assert.deepEqual(rep.heatmap.hours, [5, 19]);
  assert.equal(rep.heatmap.cells["5-0"].signups, 5);
  assert.equal(rep.heatmap.cells["19-0"].signups, 2);

  // Per-class rollup.
  assert.equal(rep.classes.length, 1);
  assert.equal(rep.classes[0].current.signups, 7);
  assert.equal(rep.classes[0].previous.signups, 8);
  assert.equal(rep.classes[0].spark.length, 12);
  assert.equal(rep.classes[0].spark[4], 50);
  assert.equal(rep.classes[0].spark[0], null);

  // Detail sections only when asked.
  assert.equal(rep.sessions, undefined);
  assert.equal(rep.instructors, undefined);
  const detail = buildClassReport(rows, r, NOW, true);
  assert.equal(detail.sessions?.length, 2);
  assert.equal(detail.sessions?.[0].ended, false); // newest first
  assert.equal(detail.sessions?.[1].signups, 5);
  assert.equal(detail.sessions?.[1].cancelled, 1);
  assert.equal(detail.instructors?.[0].name, "Asha");
  assert.equal(detail.instructors?.[0].totals.sessions, 2);
}

// --- week buckets ---------------------------------------------------------
{
  const r = range("2026-09-01", "2026-10-12"); // Tue 1 Sep .. Mon 12 Oct
  const rep = buildClassReport([session("2026-10-07", "10:00", { bookings: [booked()] })], r, NOW);
  assert.deepEqual(
    rep.trend.map((b) => b.bucket),
    ["2026-08-31", "2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28", "2026-10-05", "2026-10-12"],
  );
  assert.equal(rep.trend[5].totals.signups, 1);
}

// --- edge cases -----------------------------------------------------------
{
  const r = range("2026-10-01", "2026-10-12");
  const empty = buildClassReport([], r, NOW);
  assert.equal(empty.current.sessions, 0);
  assert.deepEqual(rates(empty.current), {
    utilization: null,
    attendance: null,
    noShowRate: null,
    cancellationRate: null,
  });
  assert.deepEqual(empty.classes, []);
  assert.deepEqual(empty.heatmap.hours, []);

  const over = buildClassReport(
    [session("2026-10-05", "10:00", { capacity: 2, bookings: [booked(), booked(), booked()] })],
    r,
    NOW,
  );
  assert.equal(rates(over.current).utilization, 150);

  const zeroCap = buildClassReport([session("2026-10-05", "10:00", { capacity: 0, bookings: [booked()] })], r, NOW);
  assert.equal(rates(zeroCap.current).utilization, null);
}

// --- deltas + attention ---------------------------------------------------
{
  assert.equal(pointDelta(null, 50), null);
  assert.equal(pointDelta(50, null), null);
  assert.equal(percentDelta(6, 8), -25);
  assert.equal(percentDelta(5, 0), null);

  const t = (sessions: number, seatsOffered: number, signups: number) => ({
    ...emptyTotals(),
    sessions,
    seatsOffered,
    signups,
  });
  assert.equal(attentionReason(t(4, 40, 15), t(4, 40, 15)), "38% full");
  assert.equal(attentionReason(t(4, 1000, 497), t(4, 1000, 497)), "49% full", "49.7 must not print the threshold");
  assert.equal(attentionReason(t(4, 1000, 495), t(4, 1000, 495)), "49% full", "49.5 must not print the threshold");
  assert.equal(attentionReason(t(4, 1000, 500), t(4, 1000, 500)), null, "exactly at the threshold is not flagged");
  assert.equal(attentionReason(t(4, 40, 24), t(4, 40, 32)), "down 20 pts");
  assert.equal(attentionReason(t(4, 40, 24), t(4, 40, 28)), null);
  assert.equal(attentionReason(t(2, 20, 2), t(4, 40, 32)), null, "too few sessions to judge");
  assert.equal(attentionReason(t(4, 40, 24), emptyTotals()), null, "no previous data");

  assert.equal(disciplineLabel("hot_yoga"), "Hot Yoga");
}

console.log("classReport: all assertions passed");
