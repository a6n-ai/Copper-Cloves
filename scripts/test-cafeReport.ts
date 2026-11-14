import assert from "node:assert/strict";
import { resolveRange, type ReportRange } from "../src/lib/classReport";
import { buildCafeReport, channelSplit, monthsEndingAt, netPaise, type CafeLine } from "../src/lib/cafeReport";

const NOW = new Date("2026-10-12T12:00:00Z");
const range = resolveRange("2026-10-01", "2026-10-12", NOW) as ReportRange;
const ist = (day: string, hhmm = "10:00") => new Date(`${day}T${hhmm}:00+05:30`);

let n = 0;
function line(day: string, over: Partial<CafeLine> = {}): CafeLine {
  return {
    id: `l${n++}`,
    batchId: null,
    orderDate: ist(day),
    itemName: "Latte",
    quantity: 1,
    unitPriceInr: 200,
    menuPriceInr: 999,
    discountInr: 0,
    paymentMethod: "razorpay",
    status: "confirmed",
    creditAppliedPaise: 0,
    refundStatus: null,
    refundAmountPaise: 0,
    ...over,
  };
}

// price fallback + discount
assert.equal(netPaise(line("2026-10-02", { quantity: 2, discountInr: 50 })), 35000);
assert.equal(netPaise(line("2026-10-02", { unitPriceInr: null, menuPriceInr: 150 })), 15000);

// channel split: partial credit, full credit, counter aliases, over-credit clamp
assert.deepEqual(channelSplit(line("2026-10-02", { creditAppliedPaise: 5000 })), { online: 15000, credit: 5000, counter: 0 });
assert.deepEqual(channelSplit(line("2026-10-02", { paymentMethod: "food_credit" })), { online: 0, credit: 20000, counter: 0 });
for (const m of ["counter", "online", "pay_at_studio"]) {
  assert.deepEqual(channelSplit(line("2026-10-02", { paymentMethod: m })), { online: 0, credit: 0, counter: 20000 });
}
assert.equal(channelSplit(line("2026-10-02", { creditAppliedPaise: 99999 })).online, 0);

// months: 12 ending at `to`, crossing a year
assert.deepEqual(monthsEndingAt("2026-02-10", 3), ["2025-12", "2026-01", "2026-02"]);

const lines: CafeLine[] = [
  // current: two lines of one batch + one counter + one credit
  line("2026-10-03", { batchId: "b1", quantity: 2, itemName: "Latte" }), // 400
  line("2026-10-03", { batchId: "b1", itemName: "Toast", unitPriceInr: 100, creditAppliedPaise: 3000 }), // 100 (30 credit)
  line("2026-10-05", { paymentMethod: "counter", itemName: "Toast", unitPriceInr: 100 }), // counter 100
  line("2026-10-06", { paymentMethod: "food_credit", unitPriceInr: 50 }), // credit 50
  // cancelled: excluded from income, reported by refund status
  line("2026-10-07", { status: "cancelled", refundStatus: "refunded", refundAmountPaise: 20000 }),
  line("2026-10-07", { status: "cancelled", refundStatus: "credited", refundAmountPaise: 20000 }),
  line("2026-10-07", { status: "cancelled", refundStatus: "refund_pending" }),
  line("2026-10-07", { status: "cancelled", refundStatus: "refund_failed" }),
  line("2026-10-07", { status: "cancelled" }),
  // previous period (19-30 Sep)
  line("2026-09-25", { unitPriceInr: 100 }),
  // earlier month, inside the chart; IST boundary: 31 Aug 23:00 IST is still August
  line("2026-08-31", { orderDate: ist("2026-08-31", "23:00") }),
  // before the chart window, and after `to`
  line("2025-09-15"),
  line("2026-10-13"),
];

const bookings = [
  { cafeOrderStatuses: ["confirmed"] },
  { cafeOrderStatuses: ["cancelled"] },
  { cafeOrderStatuses: [] },
  { cafeOrderStatuses: ["confirmed", "cancelled"] },
];

const r = buildCafeReport(lines, bookings, range);

assert.equal(r.current.collectedPaise, 40000 + 10000 + 5000);
assert.equal(r.current.counterPaise, 10000);
assert.equal(r.current.netPaise, 65000);
assert.equal(r.current.orders, 3); // b1, counter line, credit line
assert.equal(r.current.items, 5);
assert.equal(r.current.creditUsedPaise, 3000);
assert.equal(r.previous.collectedPaise, 10000);

assert.equal(r.monthly.length, 12);
assert.equal(r.monthly[11].month, "2026-10");
assert.deepEqual(r.monthly[11], { month: "2026-10", online: 47000, credit: 8000, counter: 10000 });
assert.equal(r.monthly[10].month, "2026-09");
assert.equal(r.monthly[10].online, 10000);
assert.equal(r.monthly[9].online, 20000); // Aug 31 23:00 IST
assert.equal(r.monthly[0].month, "2025-11"); // Sep 2025 line is outside the 12 months
assert.equal(r.monthly.reduce((s, m) => s + m.online + m.credit + m.counter, 0), 47000 + 8000 + 10000 + 10000 + 20000);

assert.deepEqual(r.methods, { online: 47000, credit: 8000, counter: 10000 });
assert.equal(r.topItems[0].name, "Latte");
assert.equal(r.topItems[0].netPaise, 40000 + 5000);
assert.equal(r.topItems[1].quantity, 2); // Toast: batch line + counter line

assert.deepEqual(r.attach, { bookings: 4, withCafe: 2, rate: 50 });
assert.equal(buildCafeReport([], [], range).attach.rate, null);

const c = r.cancellations;
assert.equal(c.lines, 5);
assert.equal(c.valuePaise, 100000);
assert.deepEqual([c.refunded, c.credited], [{ lines: 1, paise: 20000 }, { lines: 1, paise: 20000 }]);
assert.deepEqual([c.pending, c.failed, c.none], [1, 1, 1]);

console.log("cafeReport: all assertions passed");
