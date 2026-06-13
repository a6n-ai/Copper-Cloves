import assert from "node:assert/strict";
import {
  netPerClass,
  autoBlendedRate,
  effectiveBlendedRate,
  payoutForUnits,
  instructorPctFrom,
  resolveRateCard,
  type RateCard,
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

console.log("payoutCalc tests passed");
process.exit(0);
