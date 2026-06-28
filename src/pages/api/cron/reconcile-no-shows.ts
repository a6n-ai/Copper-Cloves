/**
 * Periodic no-show reconciliation. Marks past-due unbooked bookings as no_show.
 *
 * Auth: shared secret via header `x-cron-secret` matching env `CRON_SECRET`,
 * OR a logged-in admin session (for manual trigger from the admin UI).
 *
 * Schedule via Amplify cron / external scheduler hitting:
 *   GET /api/cron/reconcile-no-shows  with header  x-cron-secret: <secret>
 */
import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { authorizeCron } from "@/lib/cronAuth";
import { reconcileNoShowsGlobally } from "@/lib/bookingReconcile";
import { advanceCompletedSchedules } from "@/lib/scheduleLifecycle";
import { withCronRun } from "@/lib/cronRun";
import { requestLogger } from "@/lib/logger";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const log = requestLogger(req, res);
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).end();

  if (!(await authorizeCron(req, res))) return;

  const startedAt = Date.now();
  try {
    const lifecycle = await withCronRun("reconcile-no-shows", async () => {
      await reconcileNoShowsGlobally(prisma);
      const lc = await advanceCompletedSchedules(prisma);
      return { schedulesCompleted: lc.completed, schedulesAbandoned: lc.abandoned };
    });
    const durationMs = Date.now() - startedAt;
    log.info({ durationMs, ...lifecycle }, "no-show reconcile complete");
    return res.json({ ok: true, durationMs, ...lifecycle });
  } catch (e) {
    log.error({ err: e, durationMs: Date.now() - startedAt }, "cron reconcile failed");
    return res.status(500).json({ error: "Reconcile failed" });
  }
}
