import assert from "node:assert";
import { computeUpgradeDifferencePaise, validateCreditAdjust } from "../src/lib/passAdjust";

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

console.log("passAdjust OK");
