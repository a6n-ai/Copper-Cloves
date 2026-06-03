import { createHash, randomUUID } from "crypto";
import type { NextApiRequest } from "next";
import type { IncomingMessage } from "http";
import { getToken } from "next-auth/jwt";
import prisma from "./prisma";

type Headers = Record<string, string | string[] | undefined>;
type ReqLike = NextApiRequest | IncomingMessage | { headers: Headers };

// Absolute lifetime — also wired into NextAuth session/jwt maxAge in auth.ts.
export const SESSION_MAX_AGE_SECONDS = 2 * 24 * 60 * 60; // 2 days
// Idle window: a session unused for this long is killed on the next request.
// Matched to the 2-day absolute lifetime so inactivity doesn't sign users out early.
export const SESSION_IDLE_MS = 2 * 24 * 60 * 60 * 1000; // 2 days
// Don't write last_seen_at on every request — at most this often.
const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000;

function headerVal(h: Headers, k: string): string {
  const v = h?.[k];
  return Array.isArray(v) ? v[0] ?? "" : v ?? "";
}

// Stable per-device hash. User-Agent ONLY — including client IP would log mobile
// users out on every WiFi<->cellular switch. Salted with the auth secret so the
// hash can't be forged offline from a known UA string alone.
export function computeFingerprint(headers: Headers): string {
  const ua = headerVal(headers, "user-agent").toLowerCase();
  const secret = process.env.NEXTAUTH_SECRET ?? "";
  return createHash("sha256").update(`${ua}|${secret}`).digest("hex");
}

function clientIp(headers: Headers): string | null {
  const xff = headerVal(headers, "x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return headerVal(headers, "x-real-ip") || null;
}

/**
 * Called from authorize() after a credential check succeeds. Creates a new
 * session row for this device — does NOT remove other devices' sessions.
 * Returns the sid to embed in the JWT.
 */
export async function startSession(profileId: string, headers: Headers): Promise<{ sid: string }> {
  const sid = randomUUID();
  const fp = computeFingerprint(headers);
  const ua = headerVal(headers, "user-agent").slice(0, 512) || null;
  const ip = clientIp(headers);
  const now = new Date();
  await prisma.userSession.create({
    data: { profile_id: profileId, session_id: sid, fingerprint: fp, user_agent: ua, ip, created_at: now, last_seen_at: now },
  });
  return { sid };
}

/** Remove the active session for a given sid (logout). Best-effort. */
export async function endSession(sid: string | undefined | null): Promise<void> {
  if (!sid) return;
  await prisma.userSession.deleteMany({ where: { session_id: sid } }).catch(() => {});
}

/**
 * Central validation. True only if: the JWT carries a `sid`, that sid matches
 * a session row in DB, the request fingerprint matches the one stored at login,
 * and the session isn't idle-expired. Each device has its own row so multiple
 * concurrent sessions are supported. Slides last_seen_at on success (throttled).
 */
export async function isRequestSessionValid(req: ReqLike): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const token = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return false;

  const sid = (token as { sid?: string }).sid;
  const profileId = (token as { id?: string }).id;
  if (!sid || !profileId) return false; // legacy token w/o session id -> force re-login

  const headers = (req as { headers?: Headers }).headers ?? {};
  const fp = computeFingerprint(headers);
  const ua = headerVal(headers, "user-agent").slice(0, 512) || null;
  const ip = clientIp(headers);

  const row = await prisma.userSession.findUnique({ where: { session_id: sid } });

  // Self-heal: JWT is signed by us and carries sid+profileId, but the row was
  // wiped (DB reset, fresh env, manual cleanup). Re-bind rather than locking out.
  if (!row) {
    const now = new Date();
    await prisma.userSession.create({
      data: { profile_id: profileId, session_id: sid, fingerprint: fp, user_agent: ua, ip, created_at: now, last_seen_at: now },
    }).catch(() => {});
    return true;
  }

  // Ensure the sid belongs to the correct profile (prevents sid guessing across accounts).
  if (row.profile_id !== profileId) return false;

  // Self-heal: UA varies behind some proxies / browser updates. JWT + sid + DB
  // row all agree, so accept once and rebind the fingerprint to the new UA.
  if (row.fingerprint !== fp) {
    await prisma.userSession.update({
      where: { id: row.id },
      data: { fingerprint: fp, user_agent: ua, ip, last_seen_at: new Date() },
    }).catch(() => {});
    return true;
  }

  const idleMs = Date.now() - row.last_seen_at.getTime();
  if (idleMs > SESSION_IDLE_MS) {
    await prisma.userSession.deleteMany({ where: { id: row.id } }).catch(() => {});
    return false;
  }

  if (idleMs > LAST_SEEN_THROTTLE_MS) {
    await prisma.userSession.update({ where: { id: row.id }, data: { last_seen_at: new Date() } }).catch(() => {});
  }
  return true;
}
