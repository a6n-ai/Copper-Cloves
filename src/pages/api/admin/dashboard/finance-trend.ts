import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import logger from "@/lib/logger";

const MONTHS_BACK = 6;

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Last N months of revenue (from Payment) vs expenses (from instructor payouts).
 * Returns one row per month, oldest → newest, ready to feed a recharts BarChart.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  if ((session.user as { role?: string }).role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (req.method !== "GET") return res.status(405).end();

  try {
    const now = new Date();
    const rangeStart = new Date(now.getFullYear(), now.getMonth() - (MONTHS_BACK - 1), 1, 0, 0, 0, 0);

    const [payments, expenses] = await Promise.all([
      prisma.payment.findMany({
        where: { direction: "credit", status: "succeeded", created_at: { gte: rangeStart } },
        select: { amount_paise: true, created_at: true },
      }),
      // Expenses are Payment debit rows; bucket by incurred_at.
      prisma.payment.findMany({
        where: { direction: "debit", incurred_at: { gte: rangeStart } },
        select: { amount_paise: true, incurred_at: true },
      }),
    ]);

    // Bucket revenue by month (yyyy-mm)
    const revBuckets = new Map<string, number>();
    for (const p of payments) {
      const key = `${p.created_at.getFullYear()}-${String(p.created_at.getMonth() + 1).padStart(2, "0")}`;
      revBuckets.set(key, (revBuckets.get(key) ?? 0) + p.amount_paise / 100);
    }

    // Bucket recorded expenses by month (incurred_at)
    const expBuckets = new Map<string, number>();
    for (const e of expenses) {
      const key = `${e.incurred_at.getFullYear()}-${String(e.incurred_at.getMonth() + 1).padStart(2, "0")}`;
      expBuckets.set(key, (expBuckets.get(key) ?? 0) + e.amount_paise / 100);
    }

    // Build the last N months in order
    const series: Array<{ month: string; monthIso: string; revenue: number; expenses: number; profit: number }> = [];
    for (let i = MONTHS_BACK - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const revenue = Math.round(revBuckets.get(key) ?? 0);
      const expenses = Math.round(expBuckets.get(key) ?? 0);
      series.push({
        month: MONTH_LABELS[d.getMonth()],
        monthIso: key,
        revenue,
        expenses,
        profit: revenue - expenses,
      });
    }

    return res.json({ trend: series });
  } catch (e) {
    logger.error({ err: e }, "[dashboard/finance-trend]");
    return res.status(200).json({ trend: [], _partial: true });
  }
}
