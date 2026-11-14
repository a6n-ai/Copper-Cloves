/**
 * Food credit wallet + café order money on cancel.
 *
 * - Wallet: `food_credit_transactions` ledger, balance = SUM(amount_paise). Never expires.
 * - Spend: create-order sets `finance_snapshot.foodCreditInr` (server-computed); the
 *   confirm path calls `createBookingCafeOrdersTx`, which writes the orders with their
 *   price/discount/credit split and debits the wallet once per booking.
 * - Cancel: `cancelPendingCafeOrdersTx` (inside the cancel tx) cancels PENDING orders only,
 *   re-credits any credit part, and marks Razorpay-paid cash `refund_pending`.
 *   `issuePendingCafeRefunds` (after commit) sends those to Razorpay; if the booking has
 *   no Razorpay payment to refund against, the amount goes to the wallet instead.
 */
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getRazorpay, razorpayConfigured } from "@/lib/razorpayServer";
import { parseFinanceSnapshot, type FinanceSnapshotV1 } from "@/lib/financeBookingCheckout";
import {
  cancelOutcomeFor,
  foodPayableInr,
  lineCashPaise,
  splitPaise,
  toPaise,
} from "@/lib/foodCreditMath";

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type Db = TxClient | typeof prisma;

const log = logger.child({ module: "foodCredit" });

export async function foodCreditBalancePaise(db: Db, userId: string): Promise<number> {
  const r = await db.foodCreditTransaction.aggregate({
    where: { user_id: userId },
    _sum: { amount_paise: true },
  });
  return r._sum.amount_paise ?? 0;
}

/** Serialises wallet writes per member for the rest of the transaction. */
export async function lockFoodCreditWallet(tx: TxClient, userId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`food_credit:${userId}`}))`;
}

/** Insert a ledger row once per idempotency key; returns false if it already existed. */
async function addLedgerRowOnce(
  tx: TxClient,
  row: {
    userId: string;
    amountPaise: number;
    reason: "cancellation_refund" | "checkout_spend" | "admin_adjust";
    key: string;
    bookingId?: string | null;
    cafeOrderId?: string | null;
    note?: string;
  },
): Promise<boolean> {
  if (row.amountPaise === 0) return false;
  const exists = await tx.foodCreditTransaction.findUnique({ where: { idempotency_key: row.key } });
  if (exists) return false;
  await tx.foodCreditTransaction.create({
    data: {
      user_id: row.userId,
      amount_paise: row.amountPaise,
      reason: row.reason,
      idempotency_key: row.key,
      booking_id: row.bookingId ?? null,
      cafe_order_id: row.cafeOrderId ?? null,
      note: row.note ?? null,
    },
  });
  return true;
}

/** Pending checkout as create-order wrote it to the Razorpay order notes (server-trusted). */
async function serverCheckoutForBooking(
  tx: TxClient,
  bookingId: string,
): Promise<{ snap: FinanceSnapshotV1 | null; items: { id: string; quantity: number }[] }> {
  const ord = await tx.razorpayOrder.findUnique({ where: { booking_id: bookingId }, select: { notes: true } });
  const notes = (ord?.notes ?? null) as { pending_checkout?: { finance_snapshot?: unknown; cafe_items?: unknown } } | null;
  const rawItems = Array.isArray(notes?.pending_checkout?.cafe_items) ? notes.pending_checkout.cafe_items : [];
  const items = rawItems
    .map((r) => r as { id?: unknown; quantity?: unknown })
    .map((r) => ({ id: String(r.id ?? ""), quantity: Math.floor(Number(r.quantity) || 0) }))
    .filter((r) => r.id && r.quantity > 0);
  return { snap: parseFinanceSnapshot(notes?.pending_checkout?.finance_snapshot), items };
}

const spendKey = (bookingId: string) => `spend:${bookingId}`;
const releaseKey = (bookingId: string) => `spend-release:${bookingId}`;

/**
 * Hold (debit) food credit for a payment_pending booking at create-order, under the
 * wallet lock, so two open checkouts can't both spend the same balance.
 * Throws INSUFFICIENT_FOOD_CREDIT. Released by `releaseUnusedFoodCreditHoldsTx`
 * if the hold expires or is cancelled before confirm.
 */
export async function holdFoodCreditTx(
  tx: TxClient,
  args: { userId: string; bookingId: string; amountPaise: number },
): Promise<void> {
  if (args.amountPaise <= 0) return;
  await lockFoodCreditWallet(tx, args.userId);
  if ((await foodCreditBalancePaise(tx, args.userId)) < args.amountPaise) {
    throw new Error("INSUFFICIENT_FOOD_CREDIT");
  }
  await addLedgerRowOnce(tx, {
    userId: args.userId,
    amountPaise: -args.amountPaise,
    reason: "checkout_spend",
    key: spendKey(args.bookingId),
    bookingId: args.bookingId,
    note: "Food credit used at class booking checkout",
  });
}

/** Return the hold for bookings that never got their café orders (expired / cancelled unpaid). */
export async function releaseUnusedFoodCreditHoldsTx(tx: TxClient, bookingIds: string[]): Promise<void> {
  for (const bookingId of bookingIds) {
    const hold = await tx.foodCreditTransaction.findUnique({ where: { idempotency_key: spendKey(bookingId) } });
    if (!hold) continue;
    if (await tx.cafeOrder.count({ where: { booking_id: bookingId, payment_method: "razorpay" } })) continue;
    await lockFoodCreditWallet(tx, hold.user_id);
    await addLedgerRowOnce(tx, {
      userId: hold.user_id,
      amountPaise: -hold.amount_paise,
      reason: "cancellation_refund",
      key: releaseKey(bookingId),
      bookingId,
      note: "Food credit returned — booking not completed",
    });
  }
}

/**
 * Create the paid café orders for a confirmed booking (Razorpay path) and make sure
 * the food credit is debited exactly once. Items, split and credit all come from the
 * server-written order notes (create-order) — never a client pending checkout, which
 * could add unpaid items, dodge the debit or inflate the cash part of a later refund.
 * Idempotent per booking (webhook + redirect + reconcile retries are safe).
 */
export async function createBookingCafeOrdersTx(
  tx: TxClient,
  args: { userId: string; bookingId: string },
): Promise<void> {
  const { snap, items } = await serverCheckoutForBooking(tx, args.bookingId);
  if (items.length === 0) return;
  const creditPaise = toPaise(snap?.foodCreditInr ?? 0);

  const already = await tx.cafeOrder.count({ where: { booking_id: args.bookingId, payment_method: "razorpay" } });
  if (already === 0) {
    const menu = await tx.cafeItem.findMany({ where: { id: { in: items.map((i) => i.id) } } });
    const priceById = new Map(menu.map((m) => [m.id, Number(m.price)]));
    const grossPaise = items.map((i) => toPaise((priceById.get(i.id) ?? 0) * i.quantity));
    const totalGrossPaise = grossPaise.reduce((a, b) => a + b, 0);

    // Pass discount + coupon food share, from the same snapshot the gateway charged.
    const foodOwedPaise = snap ? toPaise(foodPayableInr(snap)) : totalGrossPaise;
    const discountPaise = Math.min(totalGrossPaise, Math.max(0, totalGrossPaise - foodOwedPaise));
    const discounts = splitPaise(grossPaise, discountPaise);
    const credits = splitPaise(grossPaise, Math.min(creditPaise, totalGrossPaise - discountPaise));
    const batchId = crypto.randomUUID();

    await tx.cafeOrder.createMany({
      data: items.map((item, i) => ({
        user_id: args.userId,
        cafe_item_id: item.id,
        booking_id: args.bookingId,
        quantity: item.quantity,
        payment_method: "razorpay",
        status: "pending",
        unit_price_inr: priceById.get(item.id) ?? null,
        discount_inr: discounts[i] / 100,
        credit_applied_paise: credits[i],
        batch_id: batchId,
        order_date: new Date(),
      })),
    });
  }

  if (creditPaise > 0) {
    await lockFoodCreditWallet(tx, args.userId);
    const released = await tx.foodCreditTransaction.findUnique({ where: { idempotency_key: releaseKey(args.bookingId) } });
    // Normal path: create-order already held it under spend:<id> (no-op here).
    // Expired-then-healed: the hold was released, so debit again, but only what is
    // left: the member already paid the reduced price, and the wallet never goes
    // negative. A shortfall (credit spent while the hold was released) is logged.
    let debitPaise = creditPaise;
    if (released) {
      const balance = await foodCreditBalancePaise(tx, args.userId);
      debitPaise = Math.min(creditPaise, Math.max(0, balance));
      if (debitPaise < creditPaise) {
        log.warn({ bookingId: args.bookingId, creditPaise, debitPaise }, "re-healed booking: food credit short, studio absorbs gap");
      }
    }
    await addLedgerRowOnce(tx, {
      userId: args.userId,
      amountPaise: -debitPaise,
      reason: "checkout_spend",
      key: released ? `spend-reheal:${args.bookingId}` : spendKey(args.bookingId),
      bookingId: args.bookingId,
      note: "Food credit used at class booking checkout",
    });
  }
}

/** Browser vs server per-line rounding of the pass discount; a shortfall this small is absorbed. */
const FREE_PATH_ROUNDING_PAISE = 100;

/**
 * Debit food credit for one counter-less order paid fully by credit (free booking
 * path: class covered by a pass, food covered by credit). Returns the paise actually
 * debited (at most the balance). Throws INSUFFICIENT_FOOD_CREDIT beyond rounding drift.
 */
export async function spendFoodCreditForOrderTx(
  tx: TxClient,
  args: { userId: string; cafeOrderId: string; bookingId: string | null; amountPaise: number },
): Promise<number> {
  if (args.amountPaise <= 0) return 0;
  await lockFoodCreditWallet(tx, args.userId);
  const balance = await foodCreditBalancePaise(tx, args.userId);
  if (balance < args.amountPaise - FREE_PATH_ROUNDING_PAISE) throw new Error("INSUFFICIENT_FOOD_CREDIT");
  const applied = Math.min(args.amountPaise, Math.max(0, balance));
  await addLedgerRowOnce(tx, {
    userId: args.userId,
    amountPaise: -applied,
    reason: "checkout_spend",
    key: `spend-order:${args.cafeOrderId}`,
    bookingId: args.bookingId,
    cafeOrderId: args.cafeOrderId,
    note: "Food credit used for café order",
  });
  return applied;
}

/**
 * Inside the booking-cancel transaction: cancel every still-PENDING café order on these
 * bookings. Orders the kitchen already started (preparing/ready/completed) are untouched.
 * Also returns any unused food-credit hold (booking cancelled before it was confirmed).
 * Returns true when some Razorpay cash is now `refund_pending` (caller then runs
 * `issuePendingCafeRefunds` after commit).
 */
export async function cancelPendingCafeOrdersTx(tx: TxClient, bookingIds: string[]): Promise<boolean> {
  const ids = bookingIds.filter(Boolean);
  if (ids.length === 0) return false;
  await releaseUnusedFoodCreditHoldsTx(tx, ids);
  const orders = await tx.cafeOrder.findMany({
    where: { booking_id: { in: ids }, status: "pending" },
    include: { cafe_item: { select: { price: true } } },
  });
  let anyRefund = false;
  for (const o of orders) {
    const unit = Number(o.unit_price_inr ?? o.cafe_item?.price ?? 0);
    const cashPaise = lineCashPaise({
      grossInr: unit * o.quantity,
      discountInr: Number(o.discount_inr),
      creditPaise: o.credit_applied_paise,
    });
    // food_credit orders store their full net in credit_applied_paise, so cash is 0.
    const { outcome, refundPaise, recreditPaise } = cancelOutcomeFor({
      paymentMethod: o.payment_method,
      cashPaise,
      creditPaise: o.credit_applied_paise,
    });

    // Conditional: if the kitchen moved it to `preparing` since the read, leave it alone.
    const flipped = await tx.cafeOrder.updateMany({
      where: { id: o.id, status: "pending" },
      data: {
        status: "cancelled",
        refund_status: outcome,
        refund_amount_paise: outcome === "refund_pending" ? refundPaise : recreditPaise,
      },
    });
    if (flipped.count === 0) continue;

    if (recreditPaise > 0) {
      await lockFoodCreditWallet(tx, o.user_id);
      // Never give back more than this booking actually took from the wallet
      // (a re-healed booking may have been debited short).
      const net = await tx.foodCreditTransaction.aggregate({
        where: { user_id: o.user_id, booking_id: o.booking_id },
        _sum: { amount_paise: true },
      });
      const backPaise = Math.min(recreditPaise, Math.max(0, -(net._sum.amount_paise ?? 0)));
      await addLedgerRowOnce(tx, {
        userId: o.user_id,
        amountPaise: backPaise,
        reason: "cancellation_refund",
        key: `cancel-credit:${o.id}`,
        bookingId: o.booking_id,
        cafeOrderId: o.id,
        note: "Café order cancelled with class",
      });
    }
    if (outcome === "refund_pending") anyRefund = true;
  }
  return anyRefund;
}

/** Captured Razorpay payment behind a booking, if any. */
async function razorpayPaymentForBooking(bookingId: string): Promise<string | null> {
  const ord = await prisma.razorpayOrder.findUnique({
    where: { booking_id: bookingId },
    select: { razorpay_order_id: true },
  });
  if (!ord) return null;
  const pay = await prisma.razorpayPayment.findFirst({
    where: { razorpay_order_id: ord.razorpay_order_id, status: "captured" },
    select: { razorpay_payment_id: true },
  });
  return pay?.razorpay_payment_id ?? null;
}

/** A café refund Razorpay already accepted for this booking (crash after refund, before DB write). */
async function existingCafeRefundId(paymentId: string, bookingId: string): Promise<string | null> {
  const list = (await getRazorpay().payments.fetchMultipleRefund(paymentId, { count: 100 })) as {
    items?: { id: string; status?: string; notes?: Record<string, unknown> | unknown[] }[];
  };
  const hit = (list.items ?? []).find((r) => {
    const n = (Array.isArray(r.notes) ? {} : r.notes ?? {}) as Record<string, unknown>;
    return n.purpose === "cafe_cancel" && n.booking_id === bookingId && r.status !== "failed";
  });
  return hit?.id ?? null;
}

/**
 * After the cancel commits: refund `refund_pending` café cash to Razorpay, one refund per
 * booking. No Razorpay payment to refund against → credit the wallet instead. Razorpay
 * error → `refund_failed` (retried by `retryFailedCafeRefunds`). Never throws.
 */
export async function issuePendingCafeRefunds(bookingIds?: string[]): Promise<{ refunded: number; credited: number; failed: number }> {
  const stats = { refunded: 0, credited: 0, failed: 0 };
  const candidates = await prisma.cafeOrder.findMany({
    where: { refund_status: "refund_pending", ...(bookingIds ? { booking_id: { in: bookingIds } } : {}) },
    select: { booking_id: true },
    distinct: ["booking_id"],
  });

  for (const { booking_id: bookingId } of candidates) {
    if (!bookingId) continue;
    // Claim with a run token: only rows THIS run flipped are processed, so a parallel
    // run (cancel + cron) never refunds — or un-claims — someone else's rows.
    const token = `claim:${crypto.randomUUID()}`;
    await prisma.cafeOrder.updateMany({
      where: { booking_id: bookingId, refund_status: "refund_pending" },
      data: { refund_status: "refund_processing", razorpay_refund_id: token },
    });
    const orders = await prisma.cafeOrder.findMany({
      where: { razorpay_refund_id: token },
      select: { id: true, user_id: true, refund_amount_paise: true },
    });
    if (orders.length === 0) continue;
    const mine = { razorpay_refund_id: token };

    const wanted = orders.reduce((s, o) => s + o.refund_amount_paise, 0);
    const paymentId = razorpayConfigured() ? await razorpayPaymentForBooking(bookingId) : null;

    if (!paymentId) {
      await prisma.$transaction(async (tx) => {
        for (const o of orders) {
          await lockFoodCreditWallet(tx, o.user_id);
          await addLedgerRowOnce(tx, {
            userId: o.user_id,
            amountPaise: o.refund_amount_paise,
            reason: "cancellation_refund",
            key: `cancel-cash-credit:${o.id}`,
            bookingId,
            cafeOrderId: o.id,
            note: "Café order cancelled — no online payment to refund, credited instead",
          });
        }
        await tx.cafeOrder.updateMany({ where: mine, data: { refund_status: "credited", razorpay_refund_id: null } });
      });
      stats.credited += orders.length;
      continue;
    }

    try {
      const rzp = getRazorpay();
      let refundId = await existingCafeRefundId(paymentId, bookingId);
      if (!refundId) {
        const live = (await rzp.payments.fetch(paymentId)) as { amount?: number; amount_refunded?: number | null };
        const refundable = Math.max(0, (live.amount ?? 0) - (live.amount_refunded ?? 0));
        const amount = Math.min(wanted, refundable);
        if (amount <= 0) throw new Error(`nothing refundable on ${paymentId}`);
        if (amount < wanted) log.warn({ bookingId, wanted, amount }, "café refund capped at refundable amount");
        const refund = await rzp.payments.refund(paymentId, {
          amount,
          speed: "normal",
          notes: { purpose: "cafe_cancel", booking_id: bookingId },
        });
        refundId = refund.id;
      }
      await prisma.cafeOrder.updateMany({ where: mine, data: { refund_status: "refunded", razorpay_refund_id: refundId } });
      stats.refunded += orders.length;
    } catch (err) {
      log.error({ err, bookingId, paymentId }, "café Razorpay refund failed");
      await prisma.cafeOrder.updateMany({ where: mine, data: { refund_status: "refund_failed", razorpay_refund_id: null } });
      stats.failed += orders.length;
    }
  }
  return stats;
}

/**
 * Cron backstop: retry failed café refunds and rows stuck mid-refund (crash between
 * claim and result). A retry first looks for a `cafe_cancel` refund Razorpay already
 * accepted for the booking, so a crash after the refund call never refunds twice.
 */
export async function retryFailedCafeRefunds(): Promise<{ refunded: number; credited: number; failed: number }> {
  const stale = new Date(Date.now() - 60 * 60 * 1000);
  await prisma.cafeOrder.updateMany({
    where: {
      OR: [
        { refund_status: "refund_failed" },
        { refund_status: "refund_processing", updated_at: { lt: stale } },
      ],
    },
    data: { refund_status: "refund_pending", razorpay_refund_id: null },
  });
  return issuePendingCafeRefunds();
}
