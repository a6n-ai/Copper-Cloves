import assert from "node:assert/strict";
import { cancellationRecipientIds, refundLabel } from "../src/lib/classCancellation";

// Booker (invited_by === null) cancels the whole group → booker + every group member, deduped.
assert.deepEqual(
  cancellationRecipientIds("booker", null, ["m1", "m2"]).sort(),
  ["booker", "m1", "m2"],
);

// Booker with no group → just the booker.
assert.deepEqual(cancellationRecipientIds("booker", null, []), ["booker"]);

// Group member cancels their own row → that member + the booker (invited_by), NOT the other members.
assert.deepEqual(
  cancellationRecipientIds("m1", "booker", []).sort(),
  ["booker", "m1"],
);

// Dedupe: a group member id that equals the canceller must not appear twice.
assert.deepEqual(cancellationRecipientIds("booker", null, ["booker", "m1"]).sort(), ["booker", "m1"]);

// Dedupe: invitee cancel where booker == invitedBy already present.
assert.deepEqual(cancellationRecipientIds("m1", "m1", []), ["m1"]);

// refundLabel — drives the email "who got what" roster.
assert.equal(refundLabel({ refund_status: "auto_pass" }), "1 Class Pass");
assert.equal(refundLabel({ refund_status: "approved_pass" }), "1 Class Pass");
assert.equal(refundLabel({ refund_status: "approved_amount", refund_amount_paise: 94500 }), "₹945");
assert.equal(refundLabel({ refund_status: "requested" }), "refund requested");
assert.equal(refundLabel({ refund_status: "denied" }), "no refund");
// No explicit status → derive from eligibility (consumed a pass, not checked in → eligible).
assert.equal(refundLabel({ user_package_id: "up1", checked_in: false, is_unlimited: false }), "1 Class Pass");
assert.equal(refundLabel({ user_package_id: "up1", checked_in: false, is_unlimited: true }), "no refund (unlimited)");
assert.equal(refundLabel({ user_package_id: null, checked_in: false }), "no refund");

console.log("cancellation-recipients: all assertions passed");
