import { createHmac, timingSafeEqual } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";

const COOKIE_NAME = "instructor_token";
const MAX_AGE = 60 * 60 * 24; // 24h

export interface InstructorSession {
  instructorId: string;
  name: string;
  email: string | null;
}

function getSecret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET not set");
  return s;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createInstructorToken(session: InstructorSession): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const sig = sign(payload, getSecret());
  return `${payload}.${sig}`;
}

export function getInstructorSession(
  req: NextApiRequest,
): InstructorSession | null {
  const raw = req.cookies?.[COOKIE_NAME];
  if (!raw) return null;
  try {
    const [payload, sig] = raw.split(".");
    if (!payload || !sig) return null;
    const expected = sign(payload, getSecret());
    // Constant-time comparison to prevent timing attacks
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data?.instructorId) return null;
    return data as InstructorSession;
  } catch {
    return null;
  }
}

export function setInstructorCookie(res: NextApiResponse, token: string) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax`,
  );
}

export function clearInstructorCookie(res: NextApiResponse) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`,
  );
}
