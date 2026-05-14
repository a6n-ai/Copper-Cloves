import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  const userId = (session.user as { id: string }).id;
  const userRole = (session.user as { role?: string }).role;

  if (req.method === "GET") {
    const where = userRole === "admin" ? {} : { user_id: userId };
    const orders = await prisma.cafeOrder.findMany({
      where,
      include: {
        cafe_item: true,
        profile: { select: { id: true, full_name: true, email: true } },
        booking: {
          include: {
            class_schedule: { include: { class_model: true, instructor: true } },
          },
        },
      },
      orderBy: { order_date: "desc" },
    });
    return res.json(orders);
  }

  if (req.method === "POST") {
    const { cafe_item_id, booking_id, class_schedule_id, quantity, payment_method } = req.body;
    if (!cafe_item_id || typeof cafe_item_id !== "string") {
      return res.status(400).json({ error: "cafe_item_id is required" });
    }
    if (payment_method == null || String(payment_method).trim() === "") {
      return res.status(400).json({ error: "payment_method is required" });
    }

    let resolvedBookingId: string | null = booking_id ?? null;
    if (!resolvedBookingId && class_schedule_id) {
      const booking = await prisma.booking.findFirst({
        where: { user_id: userId, class_schedule_id: String(class_schedule_id) },
        orderBy: { created_at: "desc" },
      });
      resolvedBookingId = booking?.id ?? null;
    }

    try {
      const order = await prisma.cafeOrder.create({
        data: {
          user_id: userId,
          cafe_item_id,
          booking_id: resolvedBookingId,
          quantity: quantity ?? 1,
          payment_method: String(payment_method),
          status: "pending",
        },
        include: { cafe_item: true },
      });
      return res.status(201).json(order);
    } catch (e) {
      console.error("cafeOrder.create", e);
      return res.status(400).json({ error: "Could not create order. Check item id and try again." });
    }
  }

  if (req.method === "PATCH") {
    if (userRole !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
    const { id, status } = req.body;
    if (!id || !status) {
      return res.status(400).json({ error: "id and status are required" });
    }
    try {
      const order = await prisma.cafeOrder.update({
        where: { id },
        data: { status },
        include: { cafe_item: true },
      });
      return res.json(order);
    } catch (e) {
      console.error("cafeOrder.update", e);
      return res.status(400).json({ error: "Could not update order" });
    }
  }

  res.status(405).end();
}
