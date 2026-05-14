import type { NextApiRequest, NextApiResponse } from "next";
import { randomUUID } from "node:crypto";
import prisma from "@/lib/prisma";
import type { Coupon } from "@/generated/prisma/client";
import {
import { getStudioServerSession } from "@/lib/getStudioServerSession";
  incrementCouponAndRecordRedemption,
  validateAndComputeCoupon,
} from "@/lib/couponHelpers";

type ItemIn = { cafe_item_id?: string; quantity?: number };

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
      const lines: {
        cafe_item_id: string;
        quantity: number;
        lineSubtotal: number;
      }[] = [];

      for (const row of items) {
        const item = await tx.cafeItem.findUnique({ where: { id: row.cafe_item_id } });
        if (!item || !item.is_available) {
          throw new Error(`UNAVAILABLE:${row.cafe_item_id}`);
        }
        const price = Number(item.price);
        lines.push({
          ...row,
          lineSubtotal: price * row.quantity,
        });
      }

      const subtotal = lines.reduce((s, l) => s + l.lineSubtotal, 0);
      let coupon: Coupon | null = null;
      let discountTotal = 0;

      if (couponCode.trim()) {
        const v = await validateAndComputeCoupon(tx, couponCode, "food", subtotal, {
          userId,
          guestEmail: null,
        });
        if ("error" in v) throw new Error(`COUPON:${v.error}`);
        coupon = v.coupon;
        discountTotal = v.discountInr;
      }

      let resolvedBookingId: string | null = null;
      if (addToClass && classScheduleId) {
        const booking = await tx.booking.findFirst({
          where: { user_id: userId, class_schedule_id: classScheduleId },
          orderBy: { created_at: "desc" },
        });
        resolvedBookingId = booking?.id ?? null;
      }

      const batchId = randomUUID();
      const discounts = splitDiscountAcrossLines(lines.map((l) => l.lineSubtotal), discountTotal);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        await tx.cafeOrder.create({
          data: {
            user_id: userId,
            cafe_item_id: line.cafe_item_id,
            booking_id: resolvedBookingId,
            quantity: line.quantity,
            payment_method: paymentMethod,
            status: "pending",
            coupon_id: coupon?.id ?? null,
            discount_inr: discounts[i] ?? 0,
            batch_id: batchId,
          },
        });
      }

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
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.startsWith("UNAVAILABLE:")) {
      return res.status(400).json({ error: "One or more menu items are unavailable" });
    }
    if (msg.startsWith("COUPON:")) {
      return res.status(400).json({ error: msg.replace(/^COUPON:/, "") });
    }
    if (msg === "COUPON_EXHAUSTED") {
      return res.status(409).json({ error: "Coupon is no longer available" });
    }
    console.error("[cafe/checkout]", e);
    return res.status(500).json({ error: "Checkout failed" });
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
    const line = lineSubtotals[i]!;
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
