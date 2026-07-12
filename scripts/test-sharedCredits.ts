import assert from "node:assert/strict";
import {
  maxShareableCredits,
  canShare,
  SHARE_PERCENT_MIN,
  SHARE_PERCENT_MAX,
} from "../src/lib/sharedCredits";

// Cap formula: floor(pct/100 * total)
assert.equal(maxShareableCredits(12, 75), 9);
assert.equal(maxShareableCredits(12, 100), 12);
assert.equal(maxShareableCredits(8, 75), 6);
assert.equal(maxShareableCredits(1, 75), 0); // floor(0.75) = 0
assert.equal(maxShareableCredits(null, 75), 0); // unlimited => not shareable
assert.equal(maxShareableCredits(0, 100), 0);

// Range constants
assert.equal(SHARE_PERCENT_MIN, 75);
assert.equal(SHARE_PERCENT_MAX, 100);

// canShare — happy path: 12-pass, 75% cap => 9 shareable, nothing shared yet
assert.deepEqual(
  canShare({ creditsTotal: 12, creditsRemaining: 12, alreadyShared: 0, requested: 3, maxSharedPercent: 75 }),
  { ok: true }
);

// At the cap boundary: 9 already shared, request 0 more is invalid amount; request 1 exceeds cap
assert.equal(canShare({ creditsTotal: 12, creditsRemaining: 3, alreadyShared: 9, requested: 1, maxSharedPercent: 75 }).ok, false);
assert.equal(canShare({ creditsTotal: 12, creditsRemaining: 3, alreadyShared: 9, requested: 1, maxSharedPercent: 75 }).reason, "CAP_EXCEEDED");

// Unlimited pass cannot share
assert.equal(canShare({ creditsTotal: null, creditsRemaining: 999, alreadyShared: 0, requested: 1, maxSharedPercent: 100 }).reason, "UNLIMITED_NOT_SHAREABLE");

// Not enough remaining credits (reserve-at-share can't overdraw)
assert.equal(canShare({ creditsTotal: 12, creditsRemaining: 2, alreadyShared: 0, requested: 3, maxSharedPercent: 100 }).reason, "INSUFFICIENT_CREDITS");

// Invalid request amounts
assert.equal(canShare({ creditsTotal: 12, creditsRemaining: 12, alreadyShared: 0, requested: 0, maxSharedPercent: 75 }).reason, "INVALID_AMOUNT");
assert.equal(canShare({ creditsTotal: 12, creditsRemaining: 12, alreadyShared: 0, requested: -1, maxSharedPercent: 75 }).reason, "INVALID_AMOUNT");

console.log("sharedCredits tests passed");
