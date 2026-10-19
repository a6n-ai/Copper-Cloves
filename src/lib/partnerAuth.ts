import { createHash, randomBytes } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { hasRole } from "@/lib/auth/roles";
import type { LogActivityActor } from "@/lib/activityLog";

export const PARTNER_KEY_PREFIX = "ccp_";

export function hashPartnerKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function generatePartnerKey(): string {
  return PARTNER_KEY_PREFIX + randomBytes(32).toString("base64url");
}

export interface PartnerAuth {
  partnerId: string;
  actor: LogActivityActor;
}

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 120;
// ponytail: in-memory per-process window; fine for the single cc-web container,
// move to Redis/DB if web is ever scaled out.
const hits = new Map<string, { start: number; count: number }>();

function overLimit(keyId: string, now = Date.now()): boolean {
  const w = hits.get(keyId);
  if (!w || now - w.start >= RATE_WINDOW_MS) {
    hits.set(keyId, { start: now, count: 1 });
    return false;
  }
  w.count += 1;
  return w.count > RATE_MAX;
}

/** Resolves the caller or writes the 401/429 itself and returns null. */
export async function requirePartner(req: NextApiRequest, res: NextApiResponse): Promise<PartnerAuth | null> {
  const auth = await getPartnerAuth(req, res);
  if (auth === "rate_limited") {
    res.setHeader("Retry-After", String(RATE_WINDOW_MS / 1000));
    res.status(429).json({ error: "Rate limit exceeded" });
    return null;
  }
  if (!auth) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return auth;
}

/**
 * Partner identity for /api/partner/* routes: `Authorization: Bearer ccp_...`
 * (server-to-server) or the partner manager's browser session. A bearer header
 * that is present but invalid fails closed — it never falls back to the cookie.
 */
export async function getPartnerAuth(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<PartnerAuth | "rate_limited" | null> {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    const key = header.slice(7).trim();
    if (!key.startsWith(PARTNER_KEY_PREFIX)) return null;
    const row = await prisma.partnerApiKey.findUnique({
      where: { key_hash: hashPartnerKey(key) },
      select: { id: true, name: true, partner_id: true, revoked_at: true, partner: { select: { is_active: true } } },
    });
    if (!row || row.revoked_at || !row.partner.is_active) return null;
    if (overLimit(row.id)) return "rate_limited";
    // Best-effort; a failed timestamp write must not fail the call.
    prisma.partnerApiKey.update({ where: { id: row.id }, data: { last_used_at: new Date() } }).catch(() => {});
    return { partnerId: row.partner_id, actor: { id: null, role: "partner_api", name: `API key: ${row.name}` } };
  }

  const sess = await getStudioServerSession(req, res);
  const user = sess?.user;
  if (!user || !hasRole(user.role, "partner") || !user.partner_id) return null;
  return { partnerId: user.partner_id, actor: { id: user.id, role: user.role, name: user.name } };
}
