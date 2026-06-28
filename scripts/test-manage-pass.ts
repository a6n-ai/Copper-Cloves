/**
 * Self-check for the pure logic in src/components/admin/managePass.tsx.
 * Run: npx tsx scripts/test-manage-pass.ts
 *
 * Only the framework-free helpers (validation + summary) are covered — the
 * React hook and API helpers need a DOM/network and are out of scope here.
 */
import assert from "node:assert";
import { validateConfig, validatePayment, passConfigSelected, passSummary, type PassPaymentState } from "../src/components/admin/managePass";

// Minimal stub of the state shape the pure helpers read.
function stub(over: Partial<PassPaymentState>): PassPaymentState {
  return {
    passType: "class_pass",
    credits: null,
    days: null,
    expiry: "2026-07-01",
    isComp: false,
    grantNote: "",
    startDate: "",
    method: "",
    amount: "",
    reference: "",
    proofUrl: "",
    proofUploading: false,
    defaultValidityDays: 30,
    studioBlocksClass: false,
    // setters / fns are unused by the pure helpers — stub as no-ops
    setPassType() {}, setCredits() {}, setDays() {}, setExpiry() {},
    setIsComp() {}, setGrantNote() {}, setStartDate() {}, setMethod() {},
    setAmount() {}, setReference() {}, setProofUrl() {},
    reset() {}, loadDefaults() {}, async uploadProof() {},
    ...over,
  } as PassPaymentState;
}

// passConfigSelected
assert.equal(passConfigSelected(stub({ passType: "class_pass", credits: null })), false, "class_pass needs credits");
assert.equal(passConfigSelected(stub({ passType: "class_pass", credits: 8 })), true);
assert.equal(passConfigSelected(stub({ passType: "studio_pass", days: null })), false, "studio_pass needs days");
assert.equal(passConfigSelected(stub({ passType: "studio_pass", days: 90 })), true);

// validateConfig
assert.match(validateConfig(stub({ passType: "class_pass", credits: null }))!, /classes/);
assert.match(validateConfig(stub({ passType: "studio_pass", days: null }))!, /days/);
assert.equal(validateConfig(stub({ passType: "class_pass", credits: 4 })), null);
assert.match(validateConfig(stub({ passType: "class_pass", credits: 4, isComp: true, grantNote: "" }))!, /grant note/i);
assert.equal(validateConfig(stub({ passType: "class_pass", credits: 4, isComp: true, grantNote: "VIP" })), null);

// validatePayment
assert.match(validatePayment(stub({ method: "" }))!, /method/);
assert.match(validatePayment(stub({ method: "cash", amount: "0" }))!, /amount/i);
assert.match(validatePayment(stub({ method: "cash", amount: "abc" }))!, /amount/i);
assert.match(validatePayment(stub({ method: "cash", amount: "500", proofUrl: "" }))!, /proof/i);
assert.equal(validatePayment(stub({ method: "cash", amount: "500", proofUrl: "https://x/y.png" })), null);

// passSummary
assert.equal(passSummary(stub({ passType: "class_pass", credits: 12 })), "Class pass · 12 classes");
assert.equal(passSummary(stub({ passType: "studio_pass", days: 365 })), "Studio pass · 365 days");

console.log("✓ managePass pure-logic checks passed");
