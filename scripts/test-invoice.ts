import assert from "node:assert";
import { reconcileLines, InvoiceNotPayableError } from "@/lib/invoice/buildInvoiceData";

// 1. Snapshot present and consistent → split into class/food + tax.
{
  const { lines, subtotalPaise, taxPaise } = reconcileLines(
    { classFeeInr: 500, foodFeeInr: 100, taxInr: 30 },
    63000, // total paise = (500+100+30)*100
  );
  assert.strictEqual(lines.length, 2, "class + food lines");
  assert.strictEqual(subtotalPaise, 60000);
  assert.strictEqual(taxPaise, 3000);
  assert.strictEqual(subtotalPaise + taxPaise, 63000, "reconciles to total");
}

// 2. Snapshot missing → single fallback line, no tax, reconciles.
{
  const { lines, subtotalPaise, taxPaise } = reconcileLines(null, 94500);
  assert.strictEqual(lines.length, 1);
  assert.strictEqual(lines[0].label, "Class booking");
  assert.strictEqual(subtotalPaise, 94500);
  assert.strictEqual(taxPaise, 0);
}

// 3. Snapshot present but total mismatches payment → fall back to single line = payment total.
{
  const { lines, subtotalPaise, taxPaise } = reconcileLines(
    { classFeeInr: 500, foodFeeInr: 0, taxInr: 25 },
    99900, // != 52500
  );
  assert.strictEqual(lines.length, 1, "mismatch → single reconciled line");
  assert.strictEqual(subtotalPaise + taxPaise, 99900);
}

// 4. Error type is throwable/catchable.
{
  let caught = false;
  try {
    throw new InvoiceNotPayableError("nope");
  } catch (e) {
    caught = e instanceof InvoiceNotPayableError;
  }
  assert.ok(caught, "InvoiceNotPayableError instanceof");
}

// 5. Tax-inclusive snapshot with pass discount, coupon and food credit → reduction lines.
{
  const r = reconcileLines(
    { classFeeInr: 500, foodFeeInr: 200, taxInr: 20, foodDiscountInr: 20, couponDiscountInr: 50, foodCreditInr: 100 },
    53000, // 500 + 200 - 20 - 50 - 100
  );
  assert.strictEqual(r.lines.length, 5, "class, café, discount, coupon, credit");
  assert.strictEqual(r.lines.reduce((a, l) => a + l.amountPaise, 0), 53000);
  assert.strictEqual(r.subtotalPaise + r.taxPaise, 53000);
  assert.strictEqual(r.taxIncludedPaise, 2000);
}

console.log("test-invoice: all assertions passed");
