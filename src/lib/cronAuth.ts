import type { NextApiRequest, NextApiResponse } from "next";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { hasRole } from "@/lib/auth/roles";
import { requestLogger } from "@/lib/logger";

/**
 * Attribute every authorized cron call to its caller.
 *
 * `cron_runs` records that a job ran, never who asked. When a second scheduler
 * (or a browser, or a leftover workflow) starts firing the same endpoints, the
 * job table shows twice the expected run count and nothing to explain it — the
 * exact ambiguity that made the Aug 2026 double-run untraceable.
 */
function logCronCaller(req: NextApiRequest, res: NextApiResponse, via: string) {
  const xf = req.headers["x-forwarded-for"];
  const forwarded = typeof xf === "string" ? xf.split(",")[0]?.trim() : undefined;
  requestLogger(req, res).info(
    {
      cronJob: req.url,
      via,
      // Caddy overwrites X-Forwarded-For with the real peer, so this is the
      // public client IP for internet traffic and absent for in-network callers
      // (cc-cron reaches web:3000 directly).
      ip: forwarded ?? req.socket?.remoteAddress ?? null,
      userAgent: req.headers["user-agent"] ?? null,
    },
    "cron authorized",
  );
}

/**
 * Shared auth gate for /api/cron/* endpoints.
 *
 * Authorized when the `x-cron-secret` header matches env `CRON_SECRET`, OR a
 * logged-in admin session is present (for manual trigger from the admin UI).
 *
 * Both sides are trimmed before comparison: a trailing newline pasted into a
 * GitHub Actions / Amplify secret is the single most common cause of every cron
 * silently 401-ing (which in turn stalls Razorpay reconciliation and lets paid
 * orders pile up). Trimming removes that footgun without weakening the secret.
 *
 * Returns true if authorized. If not, writes a 401 and returns false — callers
 * should `if (!(await authorizeCron(req, res))) return;`.
 */
export async function authorizeCron(req: NextApiRequest, res: NextApiResponse): Promise<boolean> {
  const secret = (process.env.CRON_SECRET ?? "").trim();
  const headerRaw = req.headers["x-cron-secret"];
  const provided = (Array.isArray(headerRaw) ? headerRaw[0] : headerRaw ?? "").trim();

  if (secret && provided && provided === secret) {
    logCronCaller(req, res, "secret");
    return true;
  }

  const session = await getStudioServerSession(req, res);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (hasRole(user?.role, "admin")) {
    logCronCaller(req, res, `admin-session:${user?.id ?? "unknown"}`);
    return true;
  }

  res.status(401).json({ error: "Unauthorized" });
  return false;
}
