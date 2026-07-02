import assert from "node:assert/strict";
import { pickUniqueOrphanMatch, isCaptureUsable } from "../src/lib/orphanPayments";

assert.equal(pickUniqueOrphanMatch([]), null);
assert.equal(pickUniqueOrphanMatch([{ id: "a" }, { id: "b" }]), null);
assert.deepEqual(pickUniqueOrphanMatch([{ id: "a" }]), { id: "a" });

assert.equal(isCaptureUsable({ status: "captured", amount_refunded: 0, refund_status: null }), true);
assert.equal(isCaptureUsable({ status: "captured", amount_refunded: 500, refund_status: null }), false);
assert.equal(isCaptureUsable({ status: "captured", amount_refunded: 0, refund_status: "full" }), false);
assert.equal(isCaptureUsable({ status: "authorized", amount_refunded: 0, refund_status: null }), false);
assert.equal(isCaptureUsable({ status: "failed", amount_refunded: 0, refund_status: null }), false);

console.log("orphanPayments tests passed");
process.exit(0);
