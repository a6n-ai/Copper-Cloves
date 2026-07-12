import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/apiError";
import type { Coupon } from "@/generated/prisma/client";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import {
  combineCafeDiscount,
  getActivePassCafePercent,
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

  const items = rawItems
    .map((r) => ({
      cafe_item_id: String(r.cafe_item_id ?? ""),
      quantity: Math.max(1, Math.floor(Number(r.quantity ?? 1))),
    }))
    .filter((r) => r.cafe_item_id.length > 0);

  if (items.length === 0) return res.status(400).json({ error: "items required" });

  try {
    const cafeItems = await prisma.cafeItem.findMany({
      where: { id: { in: items.map((r) => r.cafe_item_id) } },
      select: { id: true, price: true, is_available: true },
    });
    const byId = new Map(cafeItems.map((i) => [i.id, i]));
    let subtotal = 0;
    for (const row of items) {
      const item = byId.get(row.cafe_item_id);
      if (!item?.is_available) continue; // preview is lenient; checkout enforces availability
      subtotal += Number(item.price) * row.quantity;
    }

    const now = new Date();
    const passPercent = await getActivePassCafePercent(prisma, userId, now);

    let coupon: Coupon | null = null;
    let couponError: string | undefined;
    if (couponCode.trim()) {
      const v = await validateAndComputeCoupon(prisma, couponCode, "food", subtotal, {
        userId,
        guestEmail: null,
      });
      if ("error" in v) couponError = v.error;
      else coupon = v.coupon;
    }

    const combined = combineCafeDiscount(
      subtotal,
      passPercent,
      coupon
        ? {
            discount_type: coupon.discount_type,
            discount_value: coupon.discount_value.toString(),
            max_discount_inr: coupon.max_discount_inr?.toString() ?? null,
            stackable: coupon.stackable,
          }
        : null,
    );
    return res.status(200).json({
      subtotal,
      passDiscount: combined.passDiscount,
      couponDiscount: combined.couponApplies ? combined.couponDiscount : 0,
      finalInr: subtotal - combined.total,
      ...(couponError ? { couponError } : {}),
    });
  } catch (e) {
    return apiError(res, e, "[cafe/quote]", 500, "Quote failed");
  }
}
