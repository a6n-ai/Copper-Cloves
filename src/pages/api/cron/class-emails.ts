/**
 * Time-based class emails: ~1h member reminders + ~6h instructor rosters.
 *
 * Auth: header `x-cron-secret` matching env `CRON_SECRET`, OR a logged-in admin
 * session (manual trigger). Idempotent — safe to call as often as you like.
 *
 * Schedule via the bundled scheduler (PM2) or an external trigger hitting:
 *   GET /api/cron/class-emails  with header  x-cron-secret: <secret>
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { authorizeCron } from "@/lib/cronAuth";
import { sendDueClassReminders, sendDueInstructorRosters } from "@/lib/notifications/scheduledClassEmails";
import { withCronRun } from "@/lib/cronRun";
import { requestLogger } from "@/lib/logger";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const log = requestLogger(req, res);
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).end();

  if (!(await authorizeCron(req, res))) return;

  const startedAt = Date.now();
  try {
    const { reminders, rosters } = await withCronRun("class-emails", async () => {
      const [rem, ros] = await Promise.all([
        sendDueClassReminders(),
        sendDueInstructorRosters(),
      ]);
      return { reminders: rem, rosters: ros };
    });
    const durationMs = Date.now() - startedAt;
    log.info({ reminders, rosters, durationMs }, "class-emails cron complete");
    return res.json({ ok: true, reminders, rosters, durationMs });
  } catch (e) {
    log.error({ err: e }, "cron class-emails failed");
    return res.status(500).json({ error: "Class emails dispatch failed" });
  }
}
