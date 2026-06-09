import type { NextApiRequest, NextApiResponse } from "next";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { getFinanceLedger } from "@/lib/financeLedger";
import logger from "@/lib/logger";

function parseDate(v: unknown): Date | undefined {
  if (typeof v !== "string" || !v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  if ((session.user as { role?: string }).role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end();
  }

  const from = parseDate(req.query.from);
  const to = parseDate(req.query.to);
  const limitRaw = Number(req.query.limit);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 1000) : 250;

  try {
    const result = await getFinanceLedger({ from, to, limit });
    return res.json(result);
  } catch (e) {
    logger.error({ err: e }, "[finance/ledger]");
    return res.status(200).json({
      entries: [],
      totals: { creditPaise: 0, debitPaise: 0, netPaise: 0 },
      truncated: false,
      _partial: true,
    });
  }
}
