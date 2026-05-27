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
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { reconcileNoShowsGlobally } from "@/lib/bookingReconcile";
import { advanceCompletedSchedules } from "@/lib/scheduleLifecycle";
import { requestLogger } from "@/lib/logger";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const log = requestLogger(req, res);
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
    await reconcileNoShowsGlobally(prisma);
    const lifecycle = await advanceCompletedSchedules(prisma);
    const durationMs = Date.now() - startedAt;
    log.info(
      {
        durationMs,
        schedulesCompleted: lifecycle.completed,
        schedulesAbandoned: lifecycle.abandoned,
      },
      "no-show reconcile complete"
    );
    return res.json({
      ok: true,
      durationMs,
      schedulesCompleted: lifecycle.completed,
      schedulesAbandoned: lifecycle.abandoned,
    });
  } catch (e) {
    log.error({ err: e, durationMs: Date.now() - startedAt }, "cron reconcile failed");
    return res.status(500).json({ error: "Reconcile failed" });
  }
}
