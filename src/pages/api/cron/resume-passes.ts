/**
 * Auto-resume passes whose approved pause window has ended.
 * Auth: header `x-cron-secret` matching env `CRON_SECRET`, OR an admin session.
 * Daily is enough — pause windows are day-grained.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { authorizeCron } from "@/lib/cronAuth";
import { resumeExpiredPauses } from "@/lib/resumeExpiredPauses";
import { withCronRun } from "@/lib/cronRun";
import { requestLogger } from "@/lib/logger";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const log = requestLogger(req, res);
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).end();

  if (!(await authorizeCron(req, res))) return;

  const startedAt = Date.now();
  try {
    const result = await withCronRun("resume-passes", () => resumeExpiredPauses());
    return res.json({ ok: true, durationMs: Date.now() - startedAt, ...result });
  } catch (e) {
    log.error({ err: e }, "resume-passes cron failed");
    return res.status(500).json({ error: "Resume failed" });
  }
}
