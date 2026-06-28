/**
 * Self-check for the pure logic in src/components/admin/managePass.tsx.
 * Run: npx tsx scripts/test-manage-pass.ts
 *
 * Covers the framework-free helpers: price math (discount % / flat / free),
 * validation, and the pass summary. The React hook + API helpers need a
 * DOM/network and are out of scope here.
 */
import assert from "node:assert";
import {
  validateConfig,
  validatePayment,
  passConfigSelected,
  passSummary,
  priceBreakdown,
  type PackageRow,
  type PassPaymentState,
} from "../src/components/admin/managePass";

const PKG_CLASS: PackageRow = { id: "p1", name: "12 Class Pass", type: "class_pass", price: 12000, class_count: 12, duration_months: null, is_unlimited: false };
const PKG_STUDIO: PackageRow = { id: "p2", name: "3 Month Unlimited", type: "studio_pass", price: 30000, class_count: null, duration_months: 3, is_unlimited: true };

// Minimal stub of the state shape the pure helpers read.
function stub(over: Partial<PassPaymentState>): PassPaymentState {
  return {
    packages: [PKG_CLASS, PKG_STUDIO],
    packagesLoading: false,
    selectedPackageId: null,
    discountValue: "",
    discountUnit: "pct",
    expiry: "2026-07-01",
    grantNote: "",
    startDate: "",
    method: "",
    reference: "",
    proofUrl: "",
    proofUploading: false,
    defaultValidityDays: 30,
    studioBlocksClass: false,
    setSelectedPackageId() {}, setDiscountValue() {}, setDiscountUnit() {},
    setExpiry() {}, setGrantNote() {}, setStartDate() {}, setMethod() {},
    setReference() {}, setProofUrl() {},
    reset() {}, loadDefaults() {}, async uploadProof() {},
    ...over,
  } as PassPaymentState;
}

// passConfigSelected
assert.equal(passConfigSelected(stub({ selectedPackageId: null })), false, "needs a package");
assert.equal(passConfigSelected(stub({ selectedPackageId: "p1" })), true);

// priceBreakdown — no discount
let b = priceBreakdown(stub({ selectedPackageId: "p1" }));
assert.equal(b.originalPaise, 1200000);
assert.equal(b.discountPaise, 0);
assert.equal(b.finalPaise, 1200000);
assert.equal(b.isFree, false);

// priceBreakdown — 10% off
b = priceBreakdown(stub({ selectedPackageId: "p1", discountValue: "10", discountUnit: "pct" }));
assert.equal(b.discountPaise, 120000, "10% of 12000 = 1200");
assert.equal(b.finalPaise, 1080000);

// priceBreakdown — flat ₹2000 off
b = priceBreakdown(stub({ selectedPackageId: "p1", discountValue: "2000", discountUnit: "flat" }));
assert.equal(b.discountPaise, 200000);
assert.equal(b.finalPaise, 1000000);

// priceBreakdown — 100% off ⇒ free
b = priceBreakdown(stub({ selectedPackageId: "p1", discountValue: "100", discountUnit: "pct" }));
assert.equal(b.finalPaise, 0);
assert.equal(b.isFree, true);

// priceBreakdown — flat discount can't push below zero
b = priceBreakdown(stub({ selectedPackageId: "p1", discountValue: "99999", discountUnit: "flat" }));
assert.equal(b.finalPaise, 0);
assert.equal(b.isFree, true);

// validateConfig
assert.match(validateConfig(stub({ selectedPackageId: null }))!, /package/i);
assert.match(validateConfig(stub({ selectedPackageId: "p1", expiry: "" }))!, /expiry/i);
assert.equal(validateConfig(stub({ selectedPackageId: "p1" })), null);

// validatePayment — paid needs method + proof
assert.match(validatePayment(stub({ selectedPackageId: "p1", method: "" }))!, /method/i);
assert.match(validatePayment(stub({ selectedPackageId: "p1", method: "cash", proofUrl: "" }))!, /proof/i);
assert.equal(validatePayment(stub({ selectedPackageId: "p1", method: "cash", proofUrl: "https://x/y.png" })), null);

// validatePayment — free (100% off) needs neither
assert.equal(validatePayment(stub({ selectedPackageId: "p1", discountValue: "100", discountUnit: "pct", method: "", proofUrl: "" })), null);

// passSummary
assert.equal(passSummary(stub({ selectedPackageId: "p1" })), "12 Class Pass · 12 classes");
assert.equal(passSummary(stub({ selectedPackageId: "p2" })), "3 Month Unlimited · unlimited");

console.log("✓ managePass pure-logic checks passed");
