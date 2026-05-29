import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";

function num(v: unknown) {
  if (v == null) return 0;
  const n = Number(v as number | string);
  return Number.isFinite(n) ? n : 0;
}

type OrderItem = { productId: string; productName: string; quantity: number; price: number };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  const role = (session.user as { role?: string }).role;
  if (role !== "admin") return res.status(403).json({ error: "Forbidden" });

  if (req.method === "GET") {
    const orders = await prisma.retailOrder.findMany({
      orderBy: { order_date: "desc" },
      take: 500,
    });
    return res.json(orders.map(serializeOrder));
  }

  if (req.method === "POST") {
    const body = req.body ?? {};
    const items = Array.isArray(body.items) ? (body.items as OrderItem[]) : [];
    const safeItems = items.map((i) => ({
      productId: String(i.productId ?? ""),
      productName: String(i.productName ?? "Item"),
      quantity: Math.max(1, Math.floor(num(i.quantity))),
      price: num(i.price),
    }));
    const total =
      typeof body.total === "number"
        ? body.total
        : safeItems.reduce((s, i) => s + i.price * i.quantity, 0);

    try {
      const order = await prisma.$transaction(async (tx) => {
        // One round trip for stock validation (was one findUnique per line).
        const products = await tx.retailProduct.findMany({
          where: { id: { in: safeItems.map((r) => r.productId) } },
        });
        const productById = new Map(products.map((p) => [p.id, p]));
        for (const row of safeItems) {
          const prod = productById.get(row.productId);
          if (!prod) throw new Error(`PRODUCT_NOT_FOUND:${row.productId}`);
          if (prod.stock < row.quantity) throw new Error(`INSUFFICIENT_STOCK:${prod.name}`);
        }

        const created = await tx.retailOrder.create({
          data: {
            user_id: body.user_id ? String(body.user_id) : null,
            customer_name: String(body.customer_name ?? "Guest").trim() || "Guest",
            customer_email: String(body.customer_email ?? "").trim() || "unknown@local",
            items: safeItems,
            total,
            status: body.status ? String(body.status) : "pending",
            payment_method: body.payment_method ? String(body.payment_method) : "studio",
            shipping_address: body.shipping_address ? String(body.shipping_address) : null,
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

        return created;
      });

      return res.status(201).json(serializeOrder(order));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.startsWith("PRODUCT_NOT_FOUND:")) {
        return res.status(400).json({ error: "Unknown product in order" });
      }
      if (msg.startsWith("INSUFFICIENT_STOCK:")) {
        return res.status(400).json({ error: `Insufficient stock (${msg.split(":")[1] ?? "item"})` });
      }
      throw e;
    }
  }

  if (req.method === "PATCH") {
    const { id, status } = req.body ?? {};
    if (!id || !status) return res.status(400).json({ error: "id and status required" });
    const order = await prisma.retailOrder.update({
      where: { id: String(id) },
      data: { status: String(status) },
    });
    return res.json(serializeOrder(order));
  }

  res.status(405).end();
}

function serializeOrder(o: {
  id: string;
  user_id: string | null;
  customer_name: string;
  customer_email: string;
  items: unknown;
  total: unknown;
  status: string;
  payment_method: string;
  shipping_address: string | null;
  order_date: Date;
}) {
  return {
    id: o.id,
    customerName: o.customer_name,
    customerEmail: o.customer_email,
    items: o.items as OrderItem[],
    total: num(o.total),
    status: o.status as "pending" | "processing" | "shipped" | "delivered" | "cancelled",
    paymentMethod: (o.payment_method === "online" ? "online" : "studio") as "online" | "studio",
    orderDate: o.order_date.toISOString().slice(0, 10),
    shippingAddress: o.shipping_address ?? "",
  };
}
