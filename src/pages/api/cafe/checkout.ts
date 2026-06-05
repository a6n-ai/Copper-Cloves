import type { NextApiRequest, NextApiResponse } from "next";
import { randomUUID } from "node:crypto";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/apiError";
import type { Coupon } from "@/generated/prisma/client";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import {
  incrementCouponAndRecordRedemption,
  validateAndComputeCoupon,
} from "@/lib/couponHelpers";

type ItemIn = { cafe_item_id?: string; quantity?: number };
type OrderLine = { cafe_item_id: string; quantity: number; lineSubtotal: number };
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// Fetch every ordered item in one round trip, then validate from a Map
// (was one findUnique per line — N round trips).
async function buildOrderLines(
  tx: TxClient,
  items: { cafe_item_id: string; quantity: number }[],
): Promise<OrderLine[]> {
  const cafeItems = await tx.cafeItem.findMany({
    where: { id: { in: items.map((r) => r.cafe_item_id) } },
  });
  const cafeItemById = new Map(cafeItems.map((i) => [i.id, i]));

  const lines: OrderLine[] = [];
  for (const row of items) {
    const item = cafeItemById.get(row.cafe_item_id);
    if (!item?.is_available) {
      throw new Error(`UNAVAILABLE:${row.cafe_item_id}`);
    }
    const price = Number(item.price);
    lines.push({ ...row, lineSubtotal: price * row.quantity });
  }
  return lines;
}

async function resolveBookingId(
  tx: TxClient,
  userId: string,
  addToClass: boolean,
  classScheduleId: string | null,
): Promise<string | null> {
  if (!addToClass || !classScheduleId) return null;
  const booking = await tx.booking.findFirst({
    where: { user_id: userId, class_schedule_id: classScheduleId },
    orderBy: { created_at: "desc" },
  });
  return booking?.id ?? null;
}

async function applyCoupon(
  tx: TxClient,
  couponCode: string,
  subtotal: number,
  userId: string,
): Promise<{ coupon: Coupon | null; discountTotal: number }> {
  if (!couponCode.trim()) return { coupon: null, discountTotal: 0 };
  const v = await validateAndComputeCoupon(tx, couponCode, "food", subtotal, {
    userId,
    guestEmail: null,
  });
  if ("error" in v) throw new Error(`COUPON:${v.error}`);
  return { coupon: v.coupon, discountTotal: v.discountInr };
}

async function createOrderRows(
  tx: TxClient,
  lines: OrderLine[],
  discounts: number[],
  ctx: {
    userId: string;
    resolvedBookingId: string | null;
    paymentMethod: string;
    couponId: string | null;
    batchId: string;
  },
): Promise<void> {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    await tx.cafeOrder.create({
      data: {
        user_id: ctx.userId,
        cafe_item_id: line.cafe_item_id,
        booking_id: ctx.resolvedBookingId,
        quantity: line.quantity,
        payment_method: ctx.paymentMethod,
        status: "pending",
        coupon_id: ctx.couponId,
        discount_inr: discounts[i] ?? 0,
        batch_id: ctx.batchId,
      },
    });
  }
}

function checkoutErrorResponse(e: unknown): { status: number; error: string } | null {
  let msg = "";
  if (e instanceof Error) {
    msg = e.message;
  } else if (typeof e === "string") {
    msg = e;
  }
  if (msg.startsWith("UNAVAILABLE:")) {
    return { status: 400, error: "One or more menu items are unavailable" };
  }
  if (msg.startsWith("COUPON:")) {
    return { status: 400, error: msg.replace(/^COUPON:/, "") };
  }
  if (msg === "COUPON_EXHAUSTED") {
    return { status: 409, error: "Coupon is no longer available" };
  }
  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  const userId = (session.user as { id: string }).id;
  const body = req.body ?? {};
  const rawItems = Array.isArray(body.items) ? (body.items as ItemIn[]) : [];
  const couponCode = body.coupon_code ? String(body.coupon_code) : "";
  const addToClass = Boolean(body.add_to_class);
  const classScheduleId = body.class_schedule_id ? String(body.class_schedule_id) : null;

  const items = rawItems
    .map((row) => ({
      cafe_item_id: String(row.cafe_item_id ?? ""),
      quantity: Math.max(1, Math.floor(Number(row.quantity ?? 1))),
    }))
    .filter((r) => r.cafe_item_id.length > 0);

  if (items.length === 0) {
    return res.status(400).json({ error: "items required" });
  }

  const paymentMethod = body.payment_method != null ? String(body.payment_method) : "online";
  if (!paymentMethod.trim()) {
    return res.status(400).json({ error: "payment_method required" });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const lines = await buildOrderLines(tx, items);

      const subtotal = lines.reduce((s, l) => s + l.lineSubtotal, 0);
      const { coupon, discountTotal } = await applyCoupon(tx, couponCode, subtotal, userId);

      const resolvedBookingId = await resolveBookingId(tx, userId, addToClass, classScheduleId);

      const batchId = randomUUID();
      const discounts = splitDiscountAcrossLines(lines.map((l) => l.lineSubtotal), discountTotal);

      await createOrderRows(tx, lines, discounts, {
        userId,
        resolvedBookingId,
        paymentMethod,
        couponId: coupon?.id ?? null,
        batchId,
      });

      if (coupon && discountTotal > 0) {
        await incrementCouponAndRecordRedemption(tx, coupon, discountTotal, "food", {
          userId,
          guestEmail: null,
        });
      }

      return { batchId, subtotal, discountInr: discountTotal, finalInr: subtotal - discountTotal };
    });

    return res.status(201).json(result);
  } catch (e) {
    const mapped = checkoutErrorResponse(e);
    if (mapped) {
      return res.status(mapped.status).json({ error: mapped.error });
    }
    return apiError(res, e, "[cafe/checkout]", 500, "Checkout failed");
  }
}

function splitDiscountAcrossLines(lineSubtotals: number[], discountTotal: number): number[] {
  if (lineSubtotals.length === 0 || discountTotal <= 0) return lineSubtotals.map(() => 0);
  const total = lineSubtotals.reduce((a, b) => a + b, 0);
  if (total <= 0) return lineSubtotals.map(() => 0);
  const cap = Math.min(discountTotal, total);
  const out: number[] = [];
  let assigned = 0;
  for (let i = 0; i < lineSubtotals.length; i++) {
    const line = lineSubtotals[i];
    if (i === lineSubtotals.length - 1) {
      out.push(Math.min(line, Math.round((cap - assigned) * 100) / 100));
    } else {
      const share = (cap * line) / total;
      const part = Math.min(line, Math.round(share * 100) / 100);
      out.push(part);
      assigned += part;
    }
  }
  return out;
}
