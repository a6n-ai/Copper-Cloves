/**
 * Pending-booking lifecycle: ~30m recovery email + 60m seat release.
 * Auth: header `x-cron-secret` matching env `CRON_SECRET`, OR an admin session.
 * Schedule every ~15 min so the 30m email and 60m release land on time.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { processPendingBookingLifecycle } from "@/lib/processPendingBookingLifecycle";
import { requestLogger } from "@/lib/logger";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const log = requestLogger(req, res);
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).end();

  const secret = process.env.CRON_SECRET;
  const provided = req.headers["x-cron-secret"];
  const secretMatch = Boolean(secret && provided && provided === secret);
  if (!secretMatch) {
    const session = await getStudioServerSession(req, res);
    if ((session?.user as { role?: string } | undefined)?.role !== "admin") {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  const startedAt = Date.now();
  try {
    const result = await processPendingBookingLifecycle();
    return res.json({ ok: true, durationMs: Date.now() - startedAt, ...result });
  } catch (e) {
    log.error({ err: e }, "lifecycle-bookings cron failed");
    return res.status(500).json({ error: "Lifecycle failed" });
  }
}
