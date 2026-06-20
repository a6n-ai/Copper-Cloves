import type { NextApiRequest, NextApiResponse } from "next";
import { getStudioServerSession } from "@/lib/getStudioServerSession";

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

  if (secret && provided && provided === secret) return true;

  const session = await getStudioServerSession(req, res);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role === "admin") return true;

  res.status(401).json({ error: "Unauthorized" });
  return false;
}
