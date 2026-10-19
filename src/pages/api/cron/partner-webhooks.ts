/**
 * Deliver due partner webhook events (outbox written by the class_bookings trigger).
 * Auth: header `x-cron-secret` matching env `CRON_SECRET`, OR an admin session.
 * Every minute. Idle ticks skip the cron_runs row so the table isn't 1,440 rows/day of nothing.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { authorizeCron } from "@/lib/cronAuth";
import { withCronRun } from "@/lib/cronRun";
import { requestLogger } from "@/lib/logger";
import { countDueWebhookEvents, processDueWebhookEvents } from "@/lib/partnerWebhooks";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const log = requestLogger(req, res);
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).end();

  if (!(await authorizeCron(req, res))) return;

  const startedAt = Date.now();
  try {
    if ((await countDueWebhookEvents()) === 0) return res.json({ ok: true, claimed: 0 });
    const result = await withCronRun("partner-webhooks", () => processDueWebhookEvents());
    return res.json({ ok: true, durationMs: Date.now() - startedAt, ...result });
  } catch (e) {
    log.error({ err: e }, "partner-webhooks cron failed");
    return res.status(500).json({ error: "Webhook delivery failed" });
  }
}
