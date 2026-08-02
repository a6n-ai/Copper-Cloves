import type { NextApiRequest, NextApiResponse } from "next";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { getTransactions } from "@/lib/adminDashboardSections";
import { isFinanceDemoEnabled } from "@/lib/adminFinanceDemoTransactions";
import logger from "@/lib/logger";
import { hasRole } from "@/lib/auth/roles";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  if (!hasRole((session.user as { role?: string }).role, "admin")) return res.status(403).json({ error: "Forbidden" });
  if (req.method !== "GET") return res.status(405).end();
  const includeFinanceDemo = isFinanceDemoEnabled() && req.query.finance_demo !== "0";
  try {
    return res.json({ transactions: await getTransactions(undefined, { includeFinanceDemo }) });
  } catch (e) {
    logger.error({ err: e }, "[dashboard/transactions]");
    return res.status(200).json({ transactions: [], _partial: true });
  }
}
