import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  const userId = (session.user as { id: string }).id;

  if (req.method === "GET") {
    const sub = await prisma.mealSubscription.findFirst({
      where: { user_id: userId, status: "active" },
      orderBy: { created_at: "desc" },
    });
    return res.json(sub ?? null);
  }

  if (req.method === "POST") {
    const { meal_count, price_per_month, start_date, next_billing_date } = req.body;
    const sub = await prisma.mealSubscription.create({
      data: {
        user_id: userId,
        meal_count,
        meals_remaining: meal_count,
        price_per_month,
        start_date: new Date(start_date),
        next_billing_date: new Date(next_billing_date),
        status: "active",
      },
    });
    return res.status(201).json(sub);
  }

  if (req.method === "PATCH") {
    const { id, meals_remaining, status } = req.body;
    const sub = await prisma.mealSubscription.update({
      where: { id, user_id: userId },
      data: { meals_remaining, status },
    });
    return res.json(sub);
  }

  res.status(405).end();
}
