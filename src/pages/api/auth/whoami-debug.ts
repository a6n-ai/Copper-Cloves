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

  // Mirror isRequestSessionValid (sessionGuard.ts): look the session up by its
  // unique session_id (the JWT sid), not by profile_id. A missing row means the
  // session was superseded (a newer login deleted/replaced it) or never created.
  const row = await prisma.userSession.findUnique({ where: { session_id: sid } });
  if (!row) {
    return res.json({ ok: false, reason: "session_superseded_or_missing", profileId, jwtSid: sid });
  }
  if (row.profile_id !== profileId) {
    return res.json({
      ok: false,
      reason: "session_profile_mismatch",
      jwtSid: sid,
      dbProfileId: row.profile_id,
      dbCreatedAt: row.created_at,
      dbLastSeenAt: row.last_seen_at,
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
