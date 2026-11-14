import assert from "node:assert/strict";
import {
  bookingCreditPaise,
  cancelOutcomeFor,
  creditToApplyPaise,
  foodPayableInr,
  lineCashPaise,
  splitPaise,
} from "../src/lib/foodCreditMath";

// food payable: no coupon → food net
assert.equal(foodPayableInr({ classFeeInr: 945, foodFeeInr: 400, foodDiscountInr: 40, couponDiscountInr: 0 }), 360);
// coupon split proportionally: sub=1000 (600 class + 400 food), coupon 100 → food share 40
assert.equal(foodPayableInr({ classFeeInr: 600, foodFeeInr: 400, foodDiscountInr: 0, couponDiscountInr: 100 }), 360);
// food-only booking: coupon all on food
assert.equal(foodPayableInr({ classFeeInr: 0, foodFeeInr: 300, foodDiscountInr: 0, couponDiscountInr: 50 }), 250);
assert.equal(foodPayableInr({ classFeeInr: 945, foodFeeInr: 0, foodDiscountInr: 0, couponDiscountInr: 0 }), 0);

// credit capped by balance and by food owed
assert.equal(creditToApplyPaise(10_000, 360), 10_000);
assert.equal(creditToApplyPaise(50_000, 360), 36_000);
assert.equal(creditToApplyPaise(-500, 360), 0);

// split sums exactly, zero weights get nothing
const parts = splitPaise([100, 0, 200], 10_001);
assert.equal(parts.reduce((a, b) => a + b, 0), 10_001);
assert.equal(parts[1], 0);
assert.deepEqual(splitPaise([0, 0], 500), [0, 0]);
assert.deepEqual(splitPaise([1, 1], 0), [0, 0]);

// cash portion
assert.equal(lineCashPaise({ grossInr: 300, discountInr: 30, creditPaise: 10_000 }), 17_000);
assert.equal(lineCashPaise({ grossInr: 300, discountInr: 0, creditPaise: 99_999 }), 0);

// cancel outcomes
assert.deepEqual(cancelOutcomeFor({ paymentMethod: "razorpay", cashPaise: 17_000, creditPaise: 10_000 }), {
  outcome: "refund_pending",
  refundPaise: 17_000,
  recreditPaise: 10_000,
});
assert.deepEqual(cancelOutcomeFor({ paymentMethod: "razorpay", cashPaise: 0, creditPaise: 30_000 }), {
  outcome: "credited",
  refundPaise: 0,
  recreditPaise: 30_000,
});
assert.deepEqual(cancelOutcomeFor({ paymentMethod: "food_credit", cashPaise: 0, creditPaise: 25_000 }), {
  outcome: "credited",
  refundPaise: 0,
  recreditPaise: 25_000,
});
assert.deepEqual(cancelOutcomeFor({ paymentMethod: "counter", cashPaise: 30_000, creditPaise: 0 }), {
  outcome: "none",
  refundPaise: 0,
  recreditPaise: 0,
});

// bookingCreditPaise: no coupon → full food owed; coupon → ≥ ₹1 left for the gateway.
{
  const noCoupon = { classFeeInr: 0, foodFeeInr: 300, foodDiscountInr: 0, couponDiscountInr: 0 };
  assert.equal(bookingCreditPaise(100000, noCoupon), 30000, "pass-covered class, credit covers all food");
  const coupon = { classFeeInr: 0, foodFeeInr: 300, foodDiscountInr: 0, couponDiscountInr: 50 };
  assert.equal(bookingCreditPaise(100000, coupon), 24900, "coupon: leave ₹1 to charge online");
  assert.equal(bookingCreditPaise(5000, coupon), 5000, "small balance unaffected by cap");
  const couponCoversAll = { classFeeInr: 0, foodFeeInr: 300, foodDiscountInr: 0, couponDiscountInr: 300 };
  assert.equal(bookingCreditPaise(100000, couponCoversAll), 0, "coupon alone makes it free → no credit");
}

console.log("food credit math: all assertions passed");
