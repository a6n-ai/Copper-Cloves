import { createHmac, timingSafeEqual } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";

const COOKIE_NAME = "p57_token";
const MAX_AGE = 60 * 60 * 12; // 12h

// Shared Physique 57 instructor portal credentials.
export const P57_USERNAME = "57admin";
export const P57_PASSWORD = "physique57";

export interface P57Session {
  role: "p57";
  user: string;
}

function getSecret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET not set");
  return s;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function checkP57Credentials(username: unknown, password: unknown): boolean {
  if (typeof username !== "string" || typeof password !== "string") return false;
  return safeEqual(username.trim(), P57_USERNAME) && safeEqual(password, P57_PASSWORD);
}

export function createP57Token(): string {
  const session: P57Session = { role: "p57", user: P57_USERNAME };
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const sig = sign(payload, getSecret());
  return `${payload}.${sig}`;
}

export function getP57Session(req: NextApiRequest): P57Session | null {
  const raw = req.cookies?.[COOKIE_NAME];
  if (!raw) return null;
  try {
    const [payload, sig] = raw.split(".");
    if (!payload || !sig) return null;
    const expected = sign(payload, getSecret());
    if (!safeEqual(sig, expected)) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (data?.role !== "p57") return null;
    return data as P57Session;
  } catch {
    return null;
  }
}

export function setP57Cookie(res: NextApiResponse, token: string) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax`,
  );
}

export function clearP57Cookie(res: NextApiResponse) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`,
  );
}
