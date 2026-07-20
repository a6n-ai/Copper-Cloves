import assert from "node:assert/strict";
import { validateCreditsToDeduct } from "../src/lib/bookingCredits";

// Default (nothing sent) = booker's own seat only.
assert.deepEqual(validateCreditsToDeduct({ requested: undefined, addedMemberCount: 0 }), { ok: true, credits: 1 });
assert.deepEqual(validateCreditsToDeduct({ requested: null, addedMemberCount: 2 }), { ok: true, credits: 1 });

// Explicit 1 is always legal.
assert.deepEqual(validateCreditsToDeduct({ requested: 1, addedMemberCount: 0 }), { ok: true, credits: 1 });
assert.deepEqual(validateCreditsToDeduct({ requested: 1, addedMemberCount: 3 }), { ok: true, credits: 1 });

// Whole-group cover is legal when it matches the real group size exactly.
assert.deepEqual(validateCreditsToDeduct({ requested: 3, addedMemberCount: 2 }), { ok: true, credits: 3 });

// Anything between, above, or below is rejected — a client can't invent a count.
assert.equal(validateCreditsToDeduct({ requested: 2, addedMemberCount: 2 }).ok, false);
assert.equal(validateCreditsToDeduct({ requested: 4, addedMemberCount: 2 }).ok, false);
assert.equal(validateCreditsToDeduct({ requested: 2, addedMemberCount: 0 }).ok, false);
assert.equal(validateCreditsToDeduct({ requested: 0, addedMemberCount: 0 }).ok, false);
assert.equal(validateCreditsToDeduct({ requested: -1, addedMemberCount: 0 }).ok, false);
assert.equal(validateCreditsToDeduct({ requested: 1.5, addedMemberCount: 1 }).ok, false);
assert.equal(validateCreditsToDeduct({ requested: "3", addedMemberCount: 2 }).ok, false);

// Adversarial inputs — this is a security gate (a spoofed count means a spoofed
// ₹0 class price), so the type guard is pinned explicitly. A future
// "simplification" to Number(requested) would reopen the hole and fail here.
assert.equal(validateCreditsToDeduct({ requested: NaN, addedMemberCount: 2 }).ok, false);
assert.equal(validateCreditsToDeduct({ requested: Infinity, addedMemberCount: 2 }).ok, false);
assert.equal(validateCreditsToDeduct({ requested: true, addedMemberCount: 2 }).ok, false);
assert.equal(validateCreditsToDeduct({ requested: new Number(3), addedMemberCount: 2 }).ok, false);
assert.equal(validateCreditsToDeduct({ requested: { valueOf: () => 3 }, addedMemberCount: 2 }).ok, false);
assert.equal(validateCreditsToDeduct({ requested: -0, addedMemberCount: 0 }).ok, false);
// A negative group size must never widen the legal set.
assert.deepEqual(validateCreditsToDeduct({ requested: 1, addedMemberCount: -5 }), { ok: true, credits: 1 });
assert.equal(validateCreditsToDeduct({ requested: 2, addedMemberCount: -5 }).ok, false);

console.log("bookingCredits tests passed");
