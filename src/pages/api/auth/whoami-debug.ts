import type { NextApiRequest, NextApiResponse } from "next";
import { getToken } from "next-auth/jwt";
import prisma from "@/lib/prisma";
import { computeFingerprint, SESSION_IDLE_MS } from "@/lib/sessionGuard";

/**
 * Diagnostic for 401s from getStudioServerSession. Returns which gate in
 * isRequestSessionValid failed. Safe to expose: returns booleans + non-secret
 * metadata only. Remove or gate by admin role once the issue is identified.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return res.json({ ok: false, reason: "no_jwt_cookie" });

  const sid = (token as { sid?: string }).sid;
  const profileId = (token as { id?: string }).id;
  const role = (token as { role?: string }).role;
  if (!sid || !profileId) return res.json({ ok: false, reason: "legacy_token_missing_sid_or_id", role });

  const row = await prisma.userSession.findUnique({ where: { profile_id: profileId } });
  if (!row) return res.json({ ok: false, reason: "no_user_session_row", profileId, jwtSid: sid });
  if (row.session_id !== sid) {
    return res.json({
      ok: false,
      reason: "session_superseded",
      jwtSid: sid,
      dbSid: row.session_id,
      dbCreatedAt: row.created_at,
      dbLastSeenAt: row.last_seen_at,
      dbUserAgent: row.user_agent,
      dbIp: row.ip,
    });
  }

  const reqFp = computeFingerprint(req.headers as Record<string, string | string[] | undefined>);
  if (row.fingerprint !== reqFp) {
    return res.json({
      ok: false,
      reason: "fingerprint_mismatch",
      reqUserAgent: req.headers["user-agent"] ?? null,
      dbUserAgent: row.user_agent,
    });
  }

  const idleMs = Date.now() - row.last_seen_at.getTime();
  if (idleMs > SESSION_IDLE_MS) {
    return res.json({ ok: false, reason: "idle_expired", idleMs, limitMs: SESSION_IDLE_MS });
  }

  return res.json({
    ok: true,
    profileId,
    role,
    sid,
    lastSeenAt: row.last_seen_at,
    idleMs,
  });
}
