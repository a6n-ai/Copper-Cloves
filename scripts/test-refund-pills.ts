/**
 * Assert-based check for the booking payment/refund pill axes (src/lib/pillMaps.ts).
 * Run: npm run test:refund-pills
 *
 * Guards the case that started this: a drop-in (no pass) member cancels before the
 * cutoff, gets no class credit, and the money sits on a `needs_refund` reconcile
 * row — the UI must say "Refund pending", never fall through to blank.
 */
import assert from "node:assert";
import { bookingPaymentPill, bookingRefundPill, moneyRefundPill } from "../src/lib/pillMaps";

// Payment axis — confirmed seats distinguish money / pass / neither.
assert.equal(bookingPaymentPill("confirmed", { paid: true }).label, "Paid");
assert.equal(bookingPaymentPill("confirmed", { viaPass: true }).label, "Paid by pass");
assert.equal(bookingPaymentPill("confirmed", { paid: false, viaPass: false }).label, "No payment on record");
// No opts = legacy callers (partner roster) keep their old output.
assert.equal(bookingPaymentPill("confirmed").label, "Paid");
assert.equal(bookingPaymentPill("payment_pending").label, "Awaiting payment");
assert.equal(bookingPaymentPill("expired").label, "Unpaid");

// Credit-refund axis.
assert.equal(bookingRefundPill("auto_pass")?.label, "Refunded · 1 Class Pass");
assert.equal(bookingRefundPill("approved_amount", 94500)?.label, "Refunded ₹945");
assert.equal(bookingRefundPill("requested")?.label, "Refund requested");
assert.equal(bookingRefundPill("denied")?.tone, "danger");
// "none" yields null so the caller falls through to the money axis.
assert.equal(bookingRefundPill("none"), null);
assert.equal(bookingRefundPill(null), null);

// Money-refund axis (PaymentReconcile.status).
assert.equal(moneyRefundPill("needs_refund")?.label, "Refund pending");
assert.equal(moneyRefundPill("in_progress")?.label, "Refund in progress");
assert.equal(moneyRefundPill("done")?.label, "Refunded");
assert.equal(moneyRefundPill("dropped")?.label, "No refund due");
assert.equal(moneyRefundPill(null), null);

// The Simran case end to end: cancelled drop-in, no credit, money flagged.
const simran = bookingRefundPill("none", null) ?? moneyRefundPill("needs_refund");
assert.equal(simran?.label, "Refund pending");
assert.equal(simran?.tone, "warning");

console.log("refund pill checks passed");
