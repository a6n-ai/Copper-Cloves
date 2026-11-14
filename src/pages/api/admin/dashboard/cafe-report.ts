import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { hasRole } from "@/lib/auth/roles";
import { BOOKING_STATUS } from "@/lib/bookingStatus";
import { resolveRange } from "@/lib/classReport";
import { buildCafeReport, monthChartStartUtc } from "@/lib/cafeReport";
import logger from "@/lib/logger";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  if (!hasRole((session.user as { role?: string }).role, "admin")) return res.status(403).json({ error: "Forbidden" });
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const range = resolveRange(req.query.from, req.query.to, new Date());
  if ("error" in range) return res.status(400).json({ error: range.error });

  const chartStart = monthChartStartUtc(range.to);
  const linesFrom = chartStart < range.prevFromUtc ? chartStart : range.prevFromUtc;

  try {
    const [orders, bookings] = await Promise.all([
      prisma.cafeOrder.findMany({
        where: { order_date: { gte: linesFrom, lt: range.toUtcExclusive } },
        select: {
          id: true,
          batch_id: true,
          order_date: true,
          quantity: true,
          unit_price_inr: true,
          discount_inr: true,
          payment_method: true,
          status: true,
          credit_applied_paise: true,
          refund_status: true,
          refund_amount_paise: true,
          cafe_item: { select: { name: true, price: true } },
        },
      }),
      prisma.booking.findMany({
        where: {
          status: BOOKING_STATUS.confirmed,
          class_schedule: { start_time: { gte: range.fromUtc, lt: range.toUtcExclusive } },
        },
        select: { cafe_orders: { select: { status: true } } },
      }),
    ]);

    return res.json(
      buildCafeReport(
        orders.map((o) => ({
          id: o.id,
          batchId: o.batch_id,
          orderDate: o.order_date,
          itemName: o.cafe_item?.name ?? "Removed item",
          quantity: o.quantity,
          unitPriceInr: o.unit_price_inr === null ? null : Number(o.unit_price_inr),
          menuPriceInr: o.cafe_item ? Number(o.cafe_item.price) : null,
          discountInr: Number(o.discount_inr),
          paymentMethod: o.payment_method,
          status: o.status,
          creditAppliedPaise: o.credit_applied_paise,
          refundStatus: o.refund_status,
          refundAmountPaise: o.refund_amount_paise,
        })),
        bookings.map((b) => ({ cafeOrderStatuses: b.cafe_orders.map((c) => c.status) })),
        range,
      ),
    );
  } catch (e) {
    logger.error({ err: e }, "[dashboard/cafe-report]");
    return res.status(500).json({ error: "Could not load the cafe report" });
  }
}
