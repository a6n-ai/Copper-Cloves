// Integration check of the food-credit ledger against the LOCAL docker DB only.
import assert from "node:assert/strict";
import prisma from "@/lib/prisma";
import {
  cancelPendingCafeOrdersTx,
  createBookingCafeOrdersTx,
  foodCreditBalancePaise,
  holdFoodCreditTx,
  issuePendingCafeRefunds,
  releaseUnusedFoodCreditHoldsTx,
  spendFoodCreditForOrderTx,
} from "@/lib/foodCredit";

const url = process.env.STUDIO_DATABASE_URL || process.env.DATABASE_URL || "";
if (!/127\.0\.0\.1:5433|localhost:5433/.test(url)) throw new Error("refusing: not the local docker DB");

const bal = (u: string) => foodCreditBalancePaise(prisma, u);

async function main() {
  const tag = `fc-test-${Date.now()}`;
  const user = await prisma.profile.create({ data: { email: `${tag}@example.test`, role: "user" } });
  const item = await prisma.cafeItem.create({ data: { name: `${tag} bowl`, category: "bowls", price: 300, is_available: true } });
  const cls = await prisma.classModel.create({ data: { name: tag, category: "yoga", duration: 60 } });
  const start = new Date(Date.now() + 86400000);
  const sched = await prisma.classSchedule.create({
    data: { class_id: cls.id, start_time: start, end_time: new Date(start.getTime() + 3600000), available_spots: 10 },
  });
  const mkBooking = () =>
    prisma.booking.create({ data: { user_id: user.id, class_schedule_id: sched.id, status: "payment_pending" } });
  const b1 = await mkBooking();
  const b2 = await mkBooking();

  await prisma.foodCreditTransaction.create({ data: { user_id: user.id, amount_paise: 50000, reason: "admin_adjust" } });

  // 1. Hold, then a second checkout can't spend the same balance.
  await prisma.$transaction((tx) => holdFoodCreditTx(tx, { userId: user.id, bookingId: b1.id, amountPaise: 30000 }));
  assert.equal(await bal(user.id), 20000, "hold debits");
  await assert.rejects(
    prisma.$transaction((tx) => holdFoodCreditTx(tx, { userId: user.id, bookingId: b2.id, amountPaise: 30000 })),
    /INSUFFICIENT_FOOD_CREDIT/,
  );

  // 2. Expiry returns the hold (idempotent).
  await prisma.$transaction((tx) => releaseUnusedFoodCreditHoldsTx(tx, [b1.id]));
  await prisma.$transaction((tx) => releaseUnusedFoodCreditHoldsTx(tx, [b1.id]));
  assert.equal(await bal(user.id), 50000, "release once");

  // 3. Credit spent elsewhere while released; free-path rounding drift absorbed.
  const other = await prisma.cafeOrder.create({
    data: { user_id: user.id, cafe_item_id: item.id, quantity: 1, payment_method: "food_credit", status: "completed" },
  });
  const applied = await prisma.$transaction((tx) =>
    spendFoodCreditForOrderTx(tx, { userId: user.id, cafeOrderId: other.id, bookingId: null, amountPaise: 40000 }),
  );
  assert.equal(applied, 40000);
  assert.equal(await bal(user.id), 10000);
  const drift = await prisma.cafeOrder.create({
    data: { user_id: user.id, cafe_item_id: item.id, quantity: 1, payment_method: "food_credit", status: "completed" },
  });
  await assert.rejects(
    prisma.$transaction((tx) =>
      spendFoodCreditForOrderTx(tx, { userId: user.id, cafeOrderId: drift.id, bookingId: null, amountPaise: 20000 }),
    ),
    /INSUFFICIENT_FOOD_CREDIT/,
    "beyond ₹1 drift refused",
  );

  // 4. Payment lands late (re-heal): orders written from server notes, debit capped at balance.
  await prisma.razorpayOrder.create({
    data: {
      user_id: user.id,
      razorpay_order_id: `order_${tag}`,
      amount_paise: 0,
      booking_id: b1.id,
      notes: {
        pending_checkout: {
          cafe_items: [{ id: item.id, quantity: 1 }],
          finance_snapshot: {
            version: 1,
            dayPassEquivalentCount: 0,
            noActivePackageCheckout: false,
            paymentMethod: "online",
            classFeeInr: 0,
            foodFeeInr: 300,
            foodDiscountInr: 0,
            couponDiscountInr: 0,
            foodCreditInr: 300,
            taxInr: 0,
            totalInr: 0,
          },
        },
      },
    },
  });
  await prisma.$transaction((tx) => createBookingCafeOrdersTx(tx, { userId: user.id, bookingId: b1.id }));
  await prisma.$transaction((tx) => createBookingCafeOrdersTx(tx, { userId: user.id, bookingId: b1.id }));
  assert.equal(await bal(user.id), 0, "re-heal debits only what is left, never negative");
  const orders = await prisma.cafeOrder.findMany({ where: { booking_id: b1.id } });
  assert.equal(orders.length, 1, "orders idempotent");
  assert.equal(orders[0].credit_applied_paise, 30000);

  // 5. Cancel: re-credit capped at what the booking took (10000, not 30000); no cash → no refund.
  const anyRefund = await prisma.$transaction((tx) => cancelPendingCafeOrdersTx(tx, [b1.id]));
  assert.equal(anyRefund, false);
  await issuePendingCafeRefunds([b1.id]);
  assert.equal(await bal(user.id), 10000, "cancel gives back only what was taken");
  const after = await prisma.cafeOrder.findUniqueOrThrow({ where: { id: orders[0].id } });
  assert.equal(after.status, "cancelled");

  // 6. Razorpay cash, no captured payment → credited to wallet instead.
  const b3 = await mkBooking();
  const cash = await prisma.cafeOrder.create({
    data: {
      user_id: user.id, cafe_item_id: item.id, booking_id: b3.id, quantity: 1,
      payment_method: "razorpay", status: "pending", unit_price_inr: 300, discount_inr: 0,
    },
  });
  assert.equal(await prisma.$transaction((tx) => cancelPendingCafeOrdersTx(tx, [b3.id])), true);
  const stats = await issuePendingCafeRefunds([b3.id]);
  assert.equal(stats.credited, 1);
  assert.equal((await prisma.cafeOrder.findUniqueOrThrow({ where: { id: cash.id } })).refund_status, "credited");
  assert.equal(await bal(user.id), 40000);

  // 7. Started order is untouched by cancel.
  const b4 = await mkBooking();
  const cooking = await prisma.cafeOrder.create({
    data: { user_id: user.id, cafe_item_id: item.id, booking_id: b4.id, quantity: 1, payment_method: "razorpay", status: "preparing", unit_price_inr: 300 },
  });
  await prisma.$transaction((tx) => cancelPendingCafeOrdersTx(tx, [b4.id]));
  assert.equal((await prisma.cafeOrder.findUniqueOrThrow({ where: { id: cooking.id } })).status, "preparing");

  // 8. History paging: same order_date rows are not skipped across pages.
  const sameTime = new Date();
  await prisma.cafeOrder.createMany({
    data: Array.from({ length: 5 }, () => ({
      user_id: user.id, cafe_item_id: item.id, quantity: 1, payment_method: "counter", status: "completed", order_date: sameTime,
    })),
  });
  const page = (before?: string) =>
    prisma.cafeOrder.findMany({
      where: { user_id: user.id, status: { in: ["completed", "cancelled"] } },
      orderBy: [{ order_date: "desc" }, { id: "desc" }],
      take: 2,
      ...(before ? { cursor: { id: before }, skip: 1 } : {}),
    });
  const seen: string[] = [];
  let p = await page();
  while (p.length) {
    seen.push(...p.map((o) => o.id));
    p = await page(p[p.length - 1].id);
  }
  const total = await prisma.cafeOrder.count({ where: { user_id: user.id, status: { in: ["completed", "cancelled"] } } });
  assert.equal(new Set(seen).size, total, "paging returns every closed order once");

  console.log("food credit DB integration: all assertions passed");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
