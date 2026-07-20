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

console.log("bookingCredits tests passed");
