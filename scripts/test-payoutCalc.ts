import assert from "node:assert/strict";
import {
  netPerClass,
  autoBlendedRate,
  effectiveBlendedRate,
  payoutForUnits,
  instructorPctFrom,
  resolveRateCard,
  payableForSchedule,
  resolvePeriod,
  presetRange,
  windowFromRange,
  isAdjustableWindow,
  PAYABLE_BASES,
  PAYOUT_ELIGIBLE_STATUSES,
  type RateCard,
  type PayableBasis,
} from "../src/lib/payoutCalc";

const near = (got: number, want: number, tol = 1) =>
  assert.ok(Math.abs(got - want) <= tol, `expected ~${want}, got ${got}`);

assert.equal(instructorPctFrom(40), 60);
assert.equal(instructorPctFrom(null), 60);
assert.equal(instructorPctFrom(100), 0);

near(netPerClass(850000, 12, 5, 60), 40476);
near(netPerClass(601500, 8, 5, 60), 42964);
near(netPerClass(317500, 4, 5, 60), 45357);
near(netPerClass(83500, 1, 5, 60), 47714);

const card: RateCard = { rate12: 850000, rate8: 601500, rate4: 317500, rate1: 83500 };
near(autoBlendedRate(card, 5, 60), 44128);

assert.equal(effectiveBlendedRate(46500, 44128), 46500);
assert.equal(effectiveBlendedRate(null, 44128), 44128);

assert.equal(payoutForUnits(4, 46500), 186000);

const global = { rate12: 850000, rate8: 601500, rate4: 317500, rate1: 83500 };
const resolved = resolveRateCard(
  { rate_12_paise: 900000, rate_8_paise: null, rate_4_paise: null, rate_1_paise: null },
  global,
);
assert.equal(resolved.rate12, 900000);
assert.equal(resolved.rate8, 601500);

// --- payableForSchedule basis tests ---
const sStart = new Date("2026-06-02T13:00:00Z");
const sRows = [
  { status: "confirmed", checked_in: true, cancellation_date: null, check_in_outcome: "on_time" },
  { status: "confirmed", checked_in: true, cancellation_date: null, check_in_outcome: "late" },
  { status: "confirmed", checked_in: false, cancellation_date: null, check_in_outcome: "no_show" },
  { status: "cancelled", checked_in: false, cancellation_date: new Date("2026-06-01T00:00:00Z"), check_in_outcome: null },
];
assert.equal(payableForSchedule(sRows, sStart, "on_time", "all_booked"), 3); // 3 non-timely-cancel rows
assert.equal(payableForSchedule(sRows, sStart, "on_time", "checked_in"), 2); // on_time + late
assert.equal(payableForSchedule(sRows, sStart, "on_time", "per_class"), 1);
assert.equal(payableForSchedule([], sStart, "absent", "per_class"), 1);
assert.equal(payableForSchedule([], sStart, "on_time", "all_booked"), 1); // floor
assert.equal(payableForSchedule([], sStart, "on_time", "checked_in"), 0); // no floor
assert.equal(payableForSchedule(sRows, sStart, "on_time"), 3); // default basis = all_booked
assert.deepEqual(PAYABLE_BASES, ["all_booked", "checked_in", "per_class"]);
assert.deepEqual([...PAYOUT_ELIGIBLE_STATUSES], ["started", "completed"]);

// --- resolvePeriod / windowFromRange / isAdjustableWindow ---
const REF = new Date("2026-05-14T10:00:00Z"); // a Thursday in May 2026

// presets delegate to the existing helpers and keep their period key
const m = resolvePeriod("month", undefined, undefined, REF);
assert.equal(m.window, "month");
assert.equal(m.periodKey, "2026-05");
assert.equal(m.start?.toISOString(), "2026-05-01T00:00:00.000Z");
assert.equal(m.end?.toISOString(), "2026-06-01T00:00:00.000Z");

const a = resolvePeriod("all", undefined, undefined, REF);
assert.equal(a.start, null);
assert.equal(a.end, null);
assert.equal(a.periodKey, "all");

// custom: half-open end == to + 1 day, and NO period key
const c = resolvePeriod("custom", "2026-05-05", "2026-05-22", REF);
assert.equal(c.window, "custom");
assert.equal(c.periodKey, null);
assert.equal(c.start?.toISOString(), "2026-05-05T00:00:00.000Z");
assert.equal(c.end?.toISOString(), "2026-05-23T00:00:00.000Z");
// a class at 23:59 on the `to` date is inside; 00:00 the next day is not
assert.ok(new Date("2026-05-22T23:59:00Z") < c.end);
assert.ok(new Date("2026-05-23T00:00:00Z") >= c.end);

// single-day custom range is one full day
const one = resolvePeriod("custom", "2026-05-05", "2026-05-05", REF);
assert.equal(one.start?.toISOString(), "2026-05-05T00:00:00.000Z");
assert.equal(one.end?.toISOString(), "2026-05-06T00:00:00.000Z");

// malformed / incomplete custom falls back to month rather than throwing
for (const bad of [
  ["custom", undefined, undefined],
  ["custom", "2026-05-05", undefined],
  ["custom", "not-a-date", "2026-05-22"],
  ["custom", "2026-05-22", "2026-05-05"], // reversed
  ["custom", "2026-02-30", "2026-03-01"], // non-existent day
] as const) {
  const r = resolvePeriod(bad[0], bad[1], bad[2], REF);
  assert.equal(r.window, "month", `expected month fallback for ${JSON.stringify(bad)}`);
  assert.equal(r.periodKey, "2026-05");
}
assert.equal(resolvePeriod("bogus", undefined, undefined, REF).window, "month");

// presets round-trip through windowFromRange
for (const w of ["week", "month", "quarter"] as const) {
  assert.equal(windowFromRange(presetRange(w, REF), REF), w, `${w} must round-trip`);
}
assert.equal(windowFromRange(undefined, REF), "all");
assert.equal(windowFromRange({}, REF), "all");
assert.deepEqual(presetRange("all", REF), {});

// presetRange `to` is the last INCLUDED day, not the exclusive end
assert.equal(presetRange("month", REF).to?.toISOString(), "2026-05-31T00:00:00.000Z");

// an off-by-one-day range is custom, not a preset
const off = presetRange("month", REF);
assert.equal(windowFromRange({ from: off.from, to: new Date("2026-05-30T00:00:00Z") }, REF), "custom");
// a half-picked range (start only) is custom
assert.equal(windowFromRange({ from: off.from }, REF), "custom");

// only `month` may be written to
assert.equal(isAdjustableWindow("month"), true);
for (const w of ["week", "quarter", "all", "custom", "", null, undefined, 1]) {
  assert.equal(isAdjustableWindow(w), false, `${String(w)} must not be adjustable`);
}

console.log("payoutCalc tests passed");
process.exit(0);
