import assert from "node:assert/strict";
import {
  netPerClass,
  autoBlendedRate,
  effectiveBlendedRate,
  payoutForUnits,
  instructorPctFrom,
  resolveRateCard,
  payableForSchedule,
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

console.log("payoutCalc tests passed");
process.exit(0);
