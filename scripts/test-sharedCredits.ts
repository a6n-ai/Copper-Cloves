import assert from "node:assert/strict";
import { maxShareableCredits, canShare, SHARE_PERCENT_MIN, SHARE_PERCENT_MAX } from "../src/lib/sharedCredits";

// maxShareableCredits is retained for the admin settings UI copy; formula unchanged.
assert.equal(maxShareableCredits(12, 75), 9);
assert.equal(maxShareableCredits(null, 75), 0);
assert.equal(SHARE_PERCENT_MIN, 75);
assert.equal(SHARE_PERCENT_MAX, 100);

// Cap is now REMAINING credits only — the percentage no longer constrains sharing.
// Sharing every remaining class is allowed.
assert.deepEqual(canShare({ creditsTotal: 12, creditsRemaining: 12, requested: 12 }), { ok: true });
assert.deepEqual(canShare({ creditsTotal: 12, creditsRemaining: 3, requested: 3 }), { ok: true });
assert.deepEqual(canShare({ creditsTotal: 12, creditsRemaining: 8, requested: 1 }), { ok: true });

// Over-remaining denied.
assert.equal(canShare({ creditsTotal: 12, creditsRemaining: 2, requested: 3 }).reason, "INSUFFICIENT_CREDITS");

// Unlimited pass cannot share.
assert.equal(canShare({ creditsTotal: null, creditsRemaining: 999, requested: 1 }).reason, "UNLIMITED_NOT_SHAREABLE");

// Invalid amounts.
assert.equal(canShare({ creditsTotal: 12, creditsRemaining: 12, requested: 0 }).reason, "INVALID_AMOUNT");
assert.equal(canShare({ creditsTotal: 12, creditsRemaining: 12, requested: -1 }).reason, "INVALID_AMOUNT");
assert.equal(canShare({ creditsTotal: 12, creditsRemaining: 12, requested: 1.5 }).reason, "INVALID_AMOUNT");

console.log("sharedCredits tests passed");
