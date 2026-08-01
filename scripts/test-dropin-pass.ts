/**
 * Assert-based check for drop-in pass credit sizing (src/lib/provisionDropInPass.ts).
 * Run: npm run test:dropin-pass
 *
 * A drop-in checkout provisions one credit per seat the member was CHARGED for.
 * Getting this wrong either shorts the member (under-provision → the debit fails
 * and the booking confirms with no credit) or hands out free classes.
 */
import assert from "node:assert";
import { dropInPassCredits } from "../src/lib/provisionDropInPass";

// Solo drop-in — the common case (simran kumar, Mat 57, ₹945).
assert.equal(dropInPassCredits({ dayPassEquivalentCount: 1 }, 1), 1);

// Group: booker + 2 added members, all charged at the class rate.
assert.equal(dropInPassCredits({ dayPassEquivalentCount: 3 }, 1), 3);

// The snapshot is authoritative — it's server-validated, credits_to_deduct is not.
assert.equal(dropInPassCredits({ dayPassEquivalentCount: 3 }, 1), 3);

// Missing / malformed snapshot falls back to the declared debit.
assert.equal(dropInPassCredits(null, 2), 2);
assert.equal(dropInPassCredits(undefined, 2), 2);
assert.equal(dropInPassCredits({}, 2), 2);
assert.equal(dropInPassCredits({ dayPassEquivalentCount: "x" }, 2), 2);

// Floor at 1: a confirmed booking consumed a seat whatever the inputs claim.
assert.equal(dropInPassCredits({ dayPassEquivalentCount: 0 }, 0), 1);
assert.equal(dropInPassCredits({ dayPassEquivalentCount: -3 }, null), 1);
assert.equal(dropInPassCredits(null, null), 1);
// A free-seat group (every seat covered by shared credits) still floors at 1.
assert.equal(dropInPassCredits({ dayPassEquivalentCount: 0 }, undefined), 1);

console.log("drop-in pass credit checks passed");
