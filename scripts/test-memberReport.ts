import assert from "node:assert/strict";
import { resolveRange, type ReportRange } from "../src/lib/classReport";
import { buildMemberReport, memberRates, type MemberVisit } from "../src/lib/memberReport";

// Mon 12 Oct 2026, 17:30 IST. Range 1–12 Oct; previous period 19–30 Sep.
const NOW = new Date("2026-10-12T12:00:00Z");
const range = resolveRange("2026-10-01", "2026-10-12", NOW) as ReportRange;
const ist = (day: string, hhmm = "10:00") => new Date(`${day}T${hhmm}:00+05:30`);

function visit(userId: string, day: string, over: Partial<MemberVisit> = {}): MemberVisit {
  const startTime = ist(day);
  return {
    userId,
    name: userId.toUpperCase(),
    sessionStatus: "completed",
    startTime,
    endTime: new Date(startTime.getTime() + 3_600_000),
    status: "confirmed",
    checkedIn: true,
    outcome: "on_time",
    ...over,
  };
}
const noShow = { checkedIn: false, outcome: "no_show" };

const visits = [
  // a: regular in both periods
  visit("a", "2026-09-22"), visit("a", "2026-10-05"), visit("a", "2026-10-06"), visit("a", "2026-10-07", noShow),
  // b: came last period, nothing since
  visit("b", "2026-09-23"), visit("b", "2026-09-24"),
  // c: came last period, not yet this one, but is booked for later today
  visit("c", "2026-09-25"), visit("c", "2026-10-12", { startTime: ist("2026-10-12", "19:00"), endTime: ist("2026-10-12", "20:00"), checkedIn: false, outcome: null }),
  // d: new this period; one cancelled booking, one held seat that never confirmed
  visit("d", "2026-10-08"), visit("d", "2026-10-09", { status: "cancelled", checkedIn: false, outcome: null }),
  visit("d", "2026-10-10", { status: "payment_pending", checkedIn: false, outcome: null }),
  // e: only booked a class that was then cancelled by the studio
  visit("e", "2026-10-06", { sessionStatus: "cancelled" }),
  // f: outside both periods
  visit("f", "2026-09-01"),
];
const signups = [ist("2026-10-02"), ist("2026-10-02", "23:50"), ist("2026-09-20"), ist("2026-08-01")];
const passes = [
  { userId: "a", name: "A", expiresAt: ist("2026-10-15") },
  { userId: "a", name: "A", expiresAt: ist("2027-01-01") }, // renewed: not at risk
  { userId: "d", name: "D", expiresAt: ist("2026-10-15") },
  { userId: "b", name: "B", expiresAt: ist("2026-10-12", "23:00") },
  { userId: "c", name: "C", expiresAt: ist("2026-12-01") },
  { userId: "f", name: "F", expiresAt: ist("2026-10-01") }, // already expired
];

const rep = buildMemberReport(visits, signups, passes, range, NOW);

assert.deepEqual(rep.current, { active: 2, newMembers: 2, bookings: 5, endedBookings: 4, attended: 3, noShows: 1, cancelled: 1 });
assert.deepEqual(rep.previous, { active: 3, newMembers: 1, bookings: 4, endedBookings: 4, attended: 4, noShows: 0, cancelled: 0 });
assert.deepEqual(rep.retention, { base: 3, returned: 1 });
assert.deepEqual(memberRates(rep.current), { attendance: 75, noShowRate: 25, visitsPerActive: 1.5 });
assert.deepEqual(memberRates(rep.previous).visitsPerActive, 1.3);
assert.equal(memberRates({ active: 0, attended: 0, endedBookings: 0, noShows: 0 }).attendance, null);

// Members: ordered by classes attended; e (studio-cancelled session) and f never appear.
assert.deepEqual(rep.members.map((m) => [m.userId, m.bookings, m.attended, m.noShows, m.cancelled]), [
  ["a", 3, 2, 1, 0],
  ["d", 1, 1, 0, 1],
  ["c", 1, 0, 0, 0],
]);
assert.equal(rep.members[0].lastVisit, ist("2026-10-06").toISOString());
assert.equal(rep.members[2].lastVisit, null);
assert.equal(rep.members[2].endedBookings, 0, "an upcoming booking is not yet attendance");

// Trend: a member counts once per day however many classes; 23:50 IST still belongs to that IST day.
assert.equal(rep.trend.length, 12);
const day = (d: string) => rep.trend.find((t) => t.bucket === d);
assert.deepEqual(day("2026-10-05"), { bucket: "2026-10-05", active: 1, newMembers: 0 });
assert.deepEqual(day("2026-10-02"), { bucket: "2026-10-02", active: 0, newMembers: 2 });

// At risk: b lapsed and has a pass ending today; d's pass ends in 2 days; a renewed; c is booked ahead.
assert.deepEqual(rep.atRisk, [
  { userId: "b", name: "B", reasons: ["2 classes last period, none since", "Pass ends today"] },
  { userId: "d", name: "D", reasons: ["Pass ends in 2 days"] },
]);

// Weekly buckets: a member active on two days of one week counts once for that week.
{
  const wide = resolveRange("2026-08-01", "2026-10-12", NOW) as ReportRange;
  const r = buildMemberReport(visits, [], [], wide, NOW);
  assert.equal(wide.bucket, "week");
  assert.equal(r.trend.find((t) => t.bucket === "2026-10-05")?.active, 2, "a and d in the week of 5 Oct");
  assert.equal(r.current.active, 5);
}

console.log("memberReport: all assertions passed");
