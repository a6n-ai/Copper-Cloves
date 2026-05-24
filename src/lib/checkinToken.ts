import crypto from "node:crypto";

export type CheckinKind = "instructor" | "member";

export interface CheckinTokenPayload {
  scheduleId: string;
  kind: CheckinKind;
  exp: number; // epoch ms
}

function secret(): string {
  const s = process.env.CHECKIN_QR_SECRET?.trim();
  if (!s) throw new Error("CHECKIN_QR_SECRET is not set");
  return s;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Build a signed, URL-safe token. `exp` is epoch ms. */
export function mintCheckinToken(scheduleId: string, kind: CheckinKind, exp: number): string {
  const payload = `${scheduleId}.${kind}.${exp}`;
  return Buffer.from(`${payload}.${sign(payload)}`, "utf8").toString("base64url");
}

/** Returns the payload if signature valid AND not expired, else null. */
export function verifyCheckinToken(token: string): CheckinTokenPayload | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const lastDot = decoded.lastIndexOf(".");
    if (lastDot < 0) return null;
    const payload = decoded.slice(0, lastDot);
    const sig = decoded.slice(lastDot + 1);
    const expected = sign(payload);
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;

    const [scheduleId, kind, expStr] = payload.split(".");
    if (!scheduleId || (kind !== "instructor" && kind !== "member")) return null;
    const exp = Number(expStr);
    if (!Number.isFinite(exp) || Date.now() > exp) return null;
    return { scheduleId, kind: kind as CheckinKind, exp };
  } catch {
    return null;
  }
}
