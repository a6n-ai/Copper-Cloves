import assert from "node:assert/strict";
import { pickUniqueOrphanMatch } from "../src/lib/orphanPayments";

assert.equal(pickUniqueOrphanMatch([]), null);
assert.equal(pickUniqueOrphanMatch([{ id: "a" }, { id: "b" }]), null);
assert.deepEqual(pickUniqueOrphanMatch([{ id: "a" }]), { id: "a" });

console.log("orphanPayments tests passed");
process.exit(0);
