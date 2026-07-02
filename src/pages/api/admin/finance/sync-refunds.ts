import type { NextApiRequest, NextApiResponse } from "next";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { ensureAdmin } from "@/lib/requireAdmin";
import { sweepRefundStatus } from "@/lib/razorpayRefundSync";
import { logger } from "@/lib/logger";

/** Manual trigger (admin bookings browser button) — pulls Razorpay for full refunds and flips Payment status. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!ensureAdmin(session, res)) return;
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }

  try {
    const result = await sweepRefundStatus({ limit: 300 });
    return res.json({ ok: true, ...result });
  } catch (e) {
    logger.error({ err: e }, "[admin/finance/sync-refunds]");
    return res.status(500).json({ error: "Failed to sync refunds from Razorpay." });
  }
}
