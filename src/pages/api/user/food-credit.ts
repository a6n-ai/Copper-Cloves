import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { foodCreditBalancePaise } from "@/lib/foodCredit";

/** GET — signed-in member's food credit balance (paise) + last 20 ledger rows. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  const userId = (session.user as { id: string }).id;

  const [balance_paise, transactions] = await Promise.all([
    foodCreditBalancePaise(prisma, userId),
    prisma.foodCreditTransaction.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      take: 20,
      select: { id: true, amount_paise: true, reason: true, note: true, booking_id: true, created_at: true },
    }),
  ]);
  res.setHeader("Cache-Control", "private, no-store");
  return res.json({ balance_paise, transactions });
}
