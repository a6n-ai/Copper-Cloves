import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import type { Coupon } from "@/generated/prisma/client";
import {
  incrementCouponAndRecordRedemption,
  validateAndComputeCoupon,
} from "@/lib/couponHelpers";

const DELIVERY_FEE_INR = 50;

type ItemIn = { productId?: string; quantity?: number };

function num(v: unknown) {
  if (v == null) return 0;
  const n = Number(v as number | string);
  return Number.isFinite(n) ? n : 0;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user ? (session.user as { id: string }).id : null;

  const body = req.body ?? {};
  const rawItems = Array.isArray(body.items) ? (body.items as ItemIn[]) : [];
  const customerName = String(body.customer_name ?? "").trim() || "Guest";
  const customerEmail = String(body.customer_email ?? "").trim().toLowerCase();
  if (!customerEmail || !customerEmail.includes("@")) {
    return res.status(400).json({ error: "Valid customer_email is required" });
  }
  const shippingAddress = body.shipping_address != null ? String(body.shipping_address).trim() : "";
  const paymentMethod = body.payment_method === "online" ? "online" : "studio";
  const couponCode = body.coupon_code ? String(body.coupon_code) : "";

  const items = rawItems
    .map((row) => ({
      productId: String(row.productId ?? ""),
      quantity: Math.max(1, Math.floor(num(row.quantity))),
    }))
    .filter((r) => r.productId.length > 0);

  if (items.length === 0) return res.status(400).json({ error: "items required" });

  try {
    const out = await prisma.$transaction(async (tx) => {
      type SafeItem = { productId: string; productName: string; quantity: number; price: number };
      const safeItems: SafeItem[] = [];
      let subtotal = 0;

      for (const row of items) {
        const prod = await tx.retailProduct.findUnique({ where: { id: row.productId } });
        if (!prod || !prod.is_active) throw new Error(`PRODUCT:${row.productId}`);
        if (prod.stock < row.quantity) throw new Error(`STOCK:${prod.name}`);
        const price = num(prod.price);
        subtotal += price * row.quantity;
        safeItems.push({
          productId: row.productId,
          productName: prod.name,
          quantity: row.quantity,
          price,
        });
      }

      let coupon: Coupon | null = null;
      let discountInr = 0;
      if (couponCode.trim()) {
        const v = await validateAndComputeCoupon(tx, couponCode, "ecommerce", subtotal, {
          userId,
          guestEmail: customerEmail,
        });
        if ("error" in v) throw new Error(`COUPON:${v.error}`);
        coupon = v.coupon;
        discountInr = v.discountInr;
      }

      const total = Math.round((subtotal - discountInr + DELIVERY_FEE_INR) * 100) / 100;

      const order = await tx.retailOrder.create({
        data: {
          user_id: userId,
          customer_name: customerName,
          customer_email: customerEmail,
          items: safeItems,
          total,
          status: "pending",
          payment_method: paymentMethod,
          shipping_address: shippingAddress || null,
          coupon_id: coupon?.id ?? null,
          discount_inr: discountInr,
        },
      });

      for (const row of safeItems) {
        await tx.retailProduct.update({
          where: { id: row.productId },
          data: {
            sales_count: { increment: row.quantity },
            stock: { decrement: row.quantity },
          },
        });
      }

      if (coupon && discountInr > 0) {
        await incrementCouponAndRecordRedemption(tx, coupon, discountInr, "ecommerce", {
          userId,
          guestEmail: customerEmail,
        });
      }

      return {
        id: order.id,
        total,
        subtotal,
        discountInr,
        deliveryInr: DELIVERY_FEE_INR,
      };
    });

    return res.status(201).json(out);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.startsWith("PRODUCT:")) {
      return res.status(400).json({ error: "Unknown or inactive product in cart" });
    }
    if (msg.startsWith("STOCK:")) {
      return res.status(400).json({ error: `Insufficient stock (${msg.split(":")[1] ?? "item"})` });
    }
    if (msg.startsWith("COUPON:")) {
      return res.status(400).json({ error: msg.replace(/^COUPON:/, "") });
    }
    if (msg === "COUPON_EXHAUSTED") {
      return res.status(409).json({ error: "Coupon is no longer available" });
    }
    console.error("[retail/checkout]", e);
    return res.status(500).json({ error: "Checkout failed" });
  }
}
