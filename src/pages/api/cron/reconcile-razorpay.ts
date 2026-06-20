/**
 * Periodic Razorpay fulfillment backstop.
 *
 * Polls Razorpay for the authoritative state of website orders that are still
 * unfulfilled and captures + fulfils any paid-but-unfulfilled order. Covers the
 * mobile failure mode where the member closes the tab before the browser verify
 * call AND the webhook never lands (delivery/signature/config).
 *
 * Auth: shared secret via header `x-cron-secret` matching env `CRON_SECRET`,
 * OR a logged-in admin session (for manual trigger from the admin UI).
 *
 * Schedule via Amplify cron / external scheduler hitting:
 *   GET /api/cron/reconcile-razorpay  with header  x-cron-secret: <secret>
 *
 * Optional query params: ?hours=72 (lookback window) &limit=200 (max orders/run).
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { authorizeCron } from "@/lib/cronAuth";
import { reconcileStuckRazorpayOrders } from "@/lib/razorpayPersistence";
import { requestLogger } from "@/lib/logger";

function clampInt(raw: unknown, def: number, min: number, max: number): number {
  const n = typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const log = requestLogger(req, res);
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).end();

  if (!(await authorizeCron(req, res))) return;

  const lookbackHours = clampInt(req.query.hours, 72, 1, 720);
  const limit = clampInt(req.query.limit, 200, 1, 1000);

  const startedAt = Date.now();
  try {
    const result = await reconcileStuckRazorpayOrders({ lookbackHours, limit });
    const durationMs = Date.now() - startedAt;
    log.info({ durationMs, ...result, details: undefined }, "razorpay reconcile complete");
    // Greppable one-line heal summary per run.
    log.info(
      `[razorpay-reconcile] scanned=${result.scanned} fulfilled=${result.fulfilled} healedPaid=${result.healedPaid} persistedOnly=${result.persistedOnly} stillUnpaid=${result.stillUnpaid} errors=${result.errors} (${durationMs}ms)`,
    );
    return res.json({ ok: true, durationMs, lookbackHours, limit, ...result });
  } catch (e) {
    log.error({ err: e, durationMs: Date.now() - startedAt }, "razorpay reconcile cron failed");
    return res.status(500).json({ error: "Razorpay reconcile failed" });
  }
}
