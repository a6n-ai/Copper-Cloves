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
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { sendDueClassReminders, sendDueInstructorRosters } from "@/lib/notifications/scheduledClassEmails";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).end();

  const secret = process.env.CRON_SECRET;
  const providedSecret = req.headers["x-cron-secret"];
  const secretMatch = Boolean(secret && providedSecret && providedSecret === secret);

  if (!secretMatch) {
    const session = await getStudioServerSession(req, res);
    const role = (session?.user as { role?: string } | undefined)?.role;
    if (role !== "admin") return res.status(401).json({ error: "Unauthorized" });
  }

  const startedAt = Date.now();
  try {
    const [reminders, rosters] = await Promise.all([
      sendDueClassReminders(),
      sendDueInstructorRosters(),
    ]);
    return res.json({ ok: true, reminders, rosters, durationMs: Date.now() - startedAt });
  } catch (e) {
    console.error("[cron/class-emails] failed", e);
    return res.status(500).json({ error: "Class emails dispatch failed" });
  }
}
