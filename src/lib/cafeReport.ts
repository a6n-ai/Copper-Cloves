import { istMidnightToUtc, utcToIstParts } from "./istTime";
import type { ReportRange } from "./classReport";

/** All money here is integer paise; the UI divides by 100 for display. */

export type CafeLine = {
  id: string;
  batchId: string | null;
  orderDate: Date;
  itemName: string;
  quantity: number;
  /** Price stored on the order; null on legacy rows. */
  unitPriceInr: number | null;
  /** Current menu price, the fallback for legacy rows. */
  menuPriceInr: number | null;
  discountInr: number;
  paymentMethod: string;
  status: string;
  creditAppliedPaise: number;
  refundStatus: string | null;
  refundAmountPaise: number;
};

export type AttachBooking = { cafeOrderStatuses: string[] };

export type PaymentChannel = "online" | "credit" | "counter";

export type CafeTotals = {
  collectedPaise: number;
  counterPaise: number;
  orders: number;
  items: number;
  creditUsedPaise: number;
  /** Net value of all non-cancelled lines (collected + counter). */
  netPaise: number;
};

export type MonthRow = { month: string; online: number; credit: number; counter: number };
export type ItemRow = { name: string; quantity: number; netPaise: number };

export type Cancellations = {
  lines: number;
  valuePaise: number;
  refunded: { lines: number; paise: number };
  credited: { lines: number; paise: number };
  pending: number;
  failed: number;
  none: number;
};

export type CafeReport = {
  range: Pick<ReportRange, "from" | "to" | "prevFrom" | "prevTo">;
  current: CafeTotals;
  previous: CafeTotals;
  monthly: MonthRow[];
  topItems: ItemRow[];
  methods: Record<PaymentChannel, number>;
  attach: { bookings: number; withCafe: number; rate: number | null };
  cancellations: Cancellations;
};

const COUNTER_ALIASES = new Set(["counter", "online", "pay_at_studio"]);
const COLLECTED = new Set(["razorpay", "food_credit"]);
export const MONTHS_SHOWN = 12;

const toPaise = (inr: number) => Math.round(inr * 100);

export function grossPaise(l: CafeLine): number {
  return toPaise(l.unitPriceInr ?? l.menuPriceInr ?? 0) * l.quantity;
}

export function netPaise(l: CafeLine): number {
  return grossPaise(l) - toPaise(l.discountInr);
}

export const isCounter = (method: string) => COUNTER_ALIASES.has(method);
const isCancelled = (l: CafeLine) => l.status === "cancelled";

/** Splits a line's net into the channel that paid it. Credit never exceeds the net. */
export function channelSplit(l: CafeLine): Record<PaymentChannel, number> {
  const net = netPaise(l);
  if (isCounter(l.paymentMethod)) return { online: 0, credit: 0, counter: net };
  if (!COLLECTED.has(l.paymentMethod)) return { online: 0, credit: 0, counter: 0 };
  const credit = l.paymentMethod === "food_credit" ? net : Math.min(Math.max(l.creditAppliedPaise, 0), net);
  return { online: net - credit, credit, counter: 0 };
}

export function istMonthKey(instant: Date): string {
  const p = utcToIstParts(instant);
  return `${p.year}-${String(p.month + 1).padStart(2, "0")}`;
}

/** The last `count` IST months ending with the month of `to` ("YYYY-MM-DD"), oldest first. */
export function monthsEndingAt(to: string, count = MONTHS_SHOWN): string[] {
  const y = Number(to.slice(0, 4));
  const m = Number(to.slice(5, 7)) - 1;
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - (count - 1 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

/** UTC instant the earliest chart month starts at; the API uses it to bound its query. */
export function monthChartStartUtc(to: string, count = MONTHS_SHOWN): Date {
  const first = monthsEndingAt(to, count)[0];
  return istMidnightToUtc(Number(first.slice(0, 4)), Number(first.slice(5, 7)) - 1, 1);
}

function totals(lines: CafeLine[]): CafeTotals {
  const t: CafeTotals = { collectedPaise: 0, counterPaise: 0, orders: 0, items: 0, creditUsedPaise: 0, netPaise: 0 };
  const orders = new Set<string>();
  for (const l of lines) {
    if (isCancelled(l)) continue;
    const s = channelSplit(l);
    t.collectedPaise += s.online + s.credit;
    t.counterPaise += s.counter;
    t.netPaise += netPaise(l);
    t.items += l.quantity;
    t.creditUsedPaise += l.creditAppliedPaise;
    orders.add(l.batchId ?? l.id);
  }
  t.orders = orders.size;
  return t;
}

function cancellations(lines: CafeLine[]): Cancellations {
  const c: Cancellations = {
    lines: 0,
    valuePaise: 0,
    refunded: { lines: 0, paise: 0 },
    credited: { lines: 0, paise: 0 },
    pending: 0,
    failed: 0,
    none: 0,
  };
  for (const l of lines) {
    if (!isCancelled(l)) continue;
    c.lines += 1;
    c.valuePaise += netPaise(l);
    if (l.refundStatus === "refunded") {
      c.refunded.lines += 1;
      c.refunded.paise += l.refundAmountPaise;
    } else if (l.refundStatus === "credited") {
      c.credited.lines += 1;
      c.credited.paise += l.refundAmountPaise;
    } else if (l.refundStatus === "refund_pending") c.pending += 1;
    else if (l.refundStatus === "refund_failed") c.failed += 1;
    else c.none += 1;
  }
  return c;
}

const inWindow = (l: CafeLine, from: Date, toExclusive: Date) => l.orderDate >= from && l.orderDate < toExclusive;

/**
 * `lines` may span more than the range (previous period, 12 chart months); each section
 * filters to its own window. Order dates are bucketed in IST.
 */
export function buildCafeReport(lines: CafeLine[], bookings: AttachBooking[], range: ReportRange): CafeReport {
  const cur = lines.filter((l) => inWindow(l, range.fromUtc, range.toUtcExclusive));
  const prev = lines.filter((l) => inWindow(l, range.prevFromUtc, range.fromUtc));

  const monthKeys = monthsEndingAt(range.to);
  const monthly = new Map<string, MonthRow>(monthKeys.map((m) => [m, { month: m, online: 0, credit: 0, counter: 0 }]));
  const methods: Record<PaymentChannel, number> = { online: 0, credit: 0, counter: 0 };
  const items = new Map<string, ItemRow>();

  for (const l of lines) {
    if (isCancelled(l)) continue;
    const s = channelSplit(l);
    const row = monthly.get(istMonthKey(l.orderDate));
    if (row && l.orderDate < range.toUtcExclusive) {
      row.online += s.online;
      row.credit += s.credit;
      row.counter += s.counter;
    }
    if (!inWindow(l, range.fromUtc, range.toUtcExclusive)) continue;
    methods.online += s.online;
    methods.credit += s.credit;
    methods.counter += s.counter;
    const it = items.get(l.itemName) ?? { name: l.itemName, quantity: 0, netPaise: 0 };
    it.quantity += l.quantity;
    it.netPaise += netPaise(l);
    items.set(l.itemName, it);
  }

  const withCafe = bookings.filter((b) => b.cafeOrderStatuses.some((s) => s !== "cancelled")).length;

  return {
    range: { from: range.from, to: range.to, prevFrom: range.prevFrom, prevTo: range.prevTo },
    current: totals(cur),
    previous: totals(prev),
    monthly: monthKeys.map((m) => monthly.get(m) as MonthRow),
    topItems: [...items.values()].sort((a, b) => b.netPaise - a.netPaise || b.quantity - a.quantity),
    methods,
    attach: { bookings: bookings.length, withCafe, rate: bookings.length ? (withCafe / bookings.length) * 100 : null },
    cancellations: cancellations(cur),
  };
}
