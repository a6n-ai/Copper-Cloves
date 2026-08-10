/**
 * Assert-based unit test for combineCafeDiscount (café pass + coupon math).
 * Run: tsx scripts/test-cafeDiscount.ts  (or npm run test:cafe-discount)
 * No DB — pure function.
 */
import { combineCafeDiscount } from "../src/lib/couponHelpers";
import { bestCafeDiscount, cafeDiscountPercentOf } from "../src/lib/cafeDiscount";

let failures = 0;
function eq(label: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) {
    console.error(`FAIL ${label}: got ${g}, want ${w}`);
    failures++;
  } else {
    console.log(`ok   ${label}`);
  }
}

const pct10 = null; // no coupon
// 1. Pass only, no coupon: 10% of 200 = 20
eq("pass only", combineCafeDiscount(200, 10, pct10),
  { passDiscount: 20, couponDiscount: 0, total: 20, couponApplies: false });

// 2. No pass, coupon only (percent 25%): 25% of 200 = 50
eq("coupon only", combineCafeDiscount(200, 0, { discount_type: "percent", discount_value: 25, max_discount_inr: null, stackable: false }),
  { passDiscount: 0, couponDiscount: 50, total: 50, couponApplies: true });

// 3. Stackable: pass 10% then coupon 25% on remainder (200-20=180 -> 45). total 65.
eq("stackable stacks", combineCafeDiscount(200, 10, { discount_type: "percent", discount_value: 25, max_discount_inr: null, stackable: true }),
  { passDiscount: 20, couponDiscount: 45, total: 65, couponApplies: true });

// 4. Non-stackable, coupon wins: pass 10% (20) vs coupon 25% of 200 (50) -> coupon 50.
eq("non-stackable coupon wins", combineCafeDiscount(200, 10, { discount_type: "percent", discount_value: 25, max_discount_inr: null, stackable: false }),
  { passDiscount: 0, couponDiscount: 50, total: 50, couponApplies: true });

// 5. Non-stackable, pass wins: pass 30% (60) vs coupon fixed 40 -> pass 60.
eq("non-stackable pass wins", combineCafeDiscount(200, 30, { discount_type: "fixed", discount_value: 40, max_discount_inr: null, stackable: false }),
  { passDiscount: 60, couponDiscount: 0, total: 60, couponApplies: false });

// 6. Clamp: pass 200% never exceeds subtotal.
eq("clamp to subtotal", combineCafeDiscount(100, 200, null),
  { passDiscount: 100, couponDiscount: 0, total: 100, couponApplies: false });

// 7. Coupon cap honored (stackable): pass 10% (20), coupon 50% of base 180 = 90 but capped at 30.
eq("coupon cap honored", combineCafeDiscount(200, 10, { discount_type: "percent", discount_value: 50, max_discount_inr: 30, stackable: true }),
  { passDiscount: 20, couponDiscount: 30, total: 50, couponApplies: true });

// --- rate now comes from package config, never a hardcoded name map -----------
// 8. NULL cafe_discount_percent means 0 — the kitchen used to quote these 5%
//    (flat class-pass rate in the old map) while the till charged nothing.
eq("null percent is 0", cafeDiscountPercentOf({ cafe_discount_percent: null }), 0);
eq("no package type is 0", cafeDiscountPercentOf(null), 0);

// 9. Prisma hands back a Decimal, not a number.
eq("decimal-like percent", cafeDiscountPercentOf({ cafe_discount_percent: "15" }), 15);

// 10. Best across passes, not most-recently-purchased — a member holding a 12%
//     and a 15% pass is charged 15% at the till, so every screen must say 15.
eq("best of several passes", bestCafeDiscount([
  { package_type: { cafe_discount_percent: 12 } },
  { package_type: { cafe_discount_percent: 15 } },
  { package_type: { cafe_discount_percent: null } },
]).percent, 15);

// 11. No discount anywhere: still names a pass so the UI can label it.
eq("all zero still returns a pass", bestCafeDiscount([{ package_type: { cafe_discount_percent: null } }]).percent, 0);
eq("empty list", bestCafeDiscount([]), { percent: 0, pass: null });

if (failures) { console.error(`\n${failures} failing`); process.exit(1); }
console.log("\nall passing");
process.exit(0);
