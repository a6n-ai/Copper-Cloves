import assert from "node:assert";
import { effectivePackagePrice, offerState, pickPackageCharge } from "../src/lib/packageOffer";

const NOW = new Date("2026-07-01T00:00:00Z");
const base = { price: 36000, offer_label: "Festive", offer_starts_at: null, offer_ends_at: null };

// effectivePackagePrice
assert.deepStrictEqual(
  effectivePackagePrice({ ...base, offer_price: null }, NOW),
  { payableInr: 36000, originalInr: 36000, isOffer: false, label: null },
  "no offer_price => not an offer",
);
assert.deepStrictEqual(
  effectivePackagePrice({ ...base, offer_price: 28000 }, NOW),
  { payableInr: 28000, originalInr: 36000, isOffer: true, label: "Festive" },
  "active open-ended offer",
);
assert.strictEqual(
  effectivePackagePrice({ ...base, offer_price: 40000 }, NOW).isOffer,
  false,
  "offer_price > price is not an offer",
);
assert.strictEqual(
  effectivePackagePrice({ ...base, offer_price: 36000 }, NOW).isOffer,
  false,
  "offer_price === price is not an offer (>= boundary)",
);
assert.strictEqual(
  effectivePackagePrice({ ...base, offer_price: 28000, offer_starts_at: new Date("2026-07-02T00:00:00Z") }, NOW).isOffer,
  false,
  "before start => inactive",
);
assert.strictEqual(
  effectivePackagePrice({ ...base, offer_price: 28000, offer_ends_at: new Date("2026-06-30T00:00:00Z") }, NOW).isOffer,
  false,
  "after end => inactive",
);
assert.strictEqual(
  effectivePackagePrice({ ...base, offer_price: 28000, offer_starts_at: new Date("2026-06-30T00:00:00Z"), offer_ends_at: new Date("2026-07-02T00:00:00Z") }, NOW).isOffer,
  true,
  "inside window => active",
);

// offerState
assert.strictEqual(offerState({ ...base, offer_price: null }, NOW), "none");
assert.strictEqual(offerState({ ...base, offer_price: 28000 }, NOW), "active");
assert.strictEqual(offerState({ ...base, offer_price: 28000, offer_starts_at: new Date("2026-07-02T00:00:00Z") }, NOW), "scheduled");
assert.strictEqual(offerState({ ...base, offer_price: 28000, offer_ends_at: new Date("2026-06-30T00:00:00Z") }, NOW), "expired");
assert.strictEqual(offerState({ ...base, offer_price: 36000 }, NOW), "none", "offerState: offer == price => none");
assert.strictEqual(offerState({ ...base, price: null as unknown as number, offer_price: 28000 }, NOW), "none", "offerState: NaN price => none (finite guard)");

// pickPackageCharge
assert.deepStrictEqual(
  pickPackageCharge({ originalInr: 36000, offerPayableInr: null, coupon: null }),
  { chargeInr: 36000, offerApplied: false, couponApplied: false },
  "no offer, no coupon",
);
assert.deepStrictEqual(
  pickPackageCharge({ originalInr: 36000, offerPayableInr: 28000, coupon: null }),
  { chargeInr: 28000, offerApplied: true, couponApplied: false },
  "offer only",
);
assert.deepStrictEqual(
  pickPackageCharge({ originalInr: 36000, offerPayableInr: null, coupon: { stackable: false, discountOnOriginalInr: 3600, discountOnOfferInr: 0 } }),
  { chargeInr: 32400, offerApplied: false, couponApplied: true },
  "coupon only, no offer",
);
assert.deepStrictEqual(
  pickPackageCharge({ originalInr: 36000, offerPayableInr: 28000, coupon: { stackable: true, discountOnOriginalInr: 3600, discountOnOfferInr: 2800 } }),
  { chargeInr: 25200, offerApplied: true, couponApplied: true },
  "stackable: coupon on offer price",
);
assert.deepStrictEqual(
  pickPackageCharge({ originalInr: 36000, offerPayableInr: 28000, coupon: { stackable: false, discountOnOriginalInr: 3600, discountOnOfferInr: 0 } }),
  { chargeInr: 28000, offerApplied: true, couponApplied: false },
  "best-of: offer (28000) beats coupon-on-original (32400)",
);
assert.deepStrictEqual(
  pickPackageCharge({ originalInr: 36000, offerPayableInr: 28000, coupon: { stackable: false, discountOnOriginalInr: 12000, discountOnOfferInr: 0 } }),
  { chargeInr: 24000, offerApplied: false, couponApplied: true },
  "best-of: big coupon-on-original (24000) beats offer (28000)",
);
assert.deepStrictEqual(
  pickPackageCharge({ originalInr: 36000, offerPayableInr: 28000, coupon: { stackable: false, discountOnOriginalInr: 8000, discountOnOfferInr: 0 } }),
  { chargeInr: 28000, offerApplied: true, couponApplied: false },
  "best-of tie (both 28000): offer wins, coupon unapplied",
);

console.log("packageOffer: all assertions passed");
process.exit(0);
