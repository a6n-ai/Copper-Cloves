/**
 * Flip `user_packages.is_active` off once `expiration_date` has passed.
 * Auth: header `x-cron-secret` matching env `CRON_SECRET`, OR an admin session.
 * Daily is enough — expiry is date-grained, not latency-sensitive.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { authorizeCron } from "@/lib/cronAuth";
import { expireDuePasses } from "@/lib/expireUserPackages";
import { withCronRun } from "@/lib/cronRun";
import { requestLogger } from "@/lib/logger";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const log = requestLogger(req, res);
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).end();

  if (!(await authorizeCron(req, res))) return;

  const startedAt = Date.now();
  try {
    const result = await withCronRun("expire-passes", () => expireDuePasses());
    return res.json({ ok: true, durationMs: Date.now() - startedAt, ...result });
  } catch (e) {
    log.error({ err: e }, "expire-passes cron failed");
    return res.status(500).json({ error: "Expire failed" });
  }
}
