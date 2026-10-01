import assert from "node:assert";
import { computeUpgradeDifferencePaise, computeUpgradeExpiry, validateCreditAdjust } from "../src/lib/passAdjust";

// upgrade diff: target more expensive than current → positive paise, rounded
assert.strictEqual(computeUpgradeDifferencePaise(3000, 5000), 200000);
// fractional rupees round correctly
assert.strictEqual(computeUpgradeDifferencePaise(2999.5, 3999.99), 100049);
// target cheaper or equal → floored at 0, never negative
assert.strictEqual(computeUpgradeDifferencePaise(5000, 3000), 0);
assert.strictEqual(computeUpgradeDifferencePaise(4000, 4000), 0);

// credit adjust: unlimited pass rejected regardless of value
assert.deepStrictEqual(validateCreditAdjust({ credits: 5, isUnlimited: true }), {
  ok: false,
  error: "Unlimited passes have no credit balance to adjust",
});
// negative rejected
assert.strictEqual(validateCreditAdjust({ credits: -1, isUnlimited: false }).ok, false);
// non-integer rejected
assert.strictEqual(validateCreditAdjust({ credits: 2.5, isUnlimited: false }).ok, false);
// zero and positive integers accepted
assert.deepStrictEqual(validateCreditAdjust({ credits: 0, isUnlimited: false }), { ok: true });
assert.deepStrictEqual(validateCreditAdjust({ credits: 12, isUnlimited: false }), { ok: true });

// upgrade expiry: 6→12 month adds only the 6-month difference to the current expiry
const now = new Date("2026-10-01T00:00:00Z");
const exp = new Date("2027-01-01T00:00:00Z");
assert.strictEqual(computeUpgradeExpiry(exp, 6, 12, now)?.toISOString(), "2027-07-01T00:00:00.000Z");
// no month duration on current pass → remaining validity + full target term
assert.strictEqual(computeUpgradeExpiry(exp, null, 3, now)?.toISOString(), "2027-04-01T00:00:00.000Z");
// lapsed current expiry → starts from now
assert.strictEqual(computeUpgradeExpiry(new Date("2026-09-01T00:00:00Z"), 6, 12, now)?.toISOString(), "2027-04-01T00:00:00.000Z");
// equal/shorter target never shortens the pass
assert.strictEqual(computeUpgradeExpiry(exp, 12, 6, now)?.toISOString(), exp.toISOString());
// target without duration → null (caller falls back)
assert.strictEqual(computeUpgradeExpiry(exp, 6, null, now), null);

console.log("passAdjust OK");
