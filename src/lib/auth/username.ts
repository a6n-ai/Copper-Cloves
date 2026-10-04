import { randomInt } from "crypto";
import prisma from "@/lib/prisma";

// Must satisfy the better-auth username plugin defaults: /^[a-zA-Z0-9_.]+$/, 3–30 chars.
const MAX_BASE = 24;

/**
 * "Priya  Sharma" -> "priya.sharma". Falls back to the email local part, then
 * "member". Never derived from the phone number.
 */
export function baseUsername(name: string | null | undefined, email: string): string {
  const clean = (s: string) =>
    s
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.+|\.+$/g, "")
      .slice(0, MAX_BASE)
      .replace(/\.+$/, "");
  const fromName = clean(name ?? "");
  // A name that IS the email (invite fallback) must not leak the address.
  if (fromName.length >= 3 && !(name ?? "").includes("@")) return fromName;
  const fromEmail = clean(email.split("@")[0] ?? "");
  return fromEmail.length >= 3 ? fromEmail : "member";
}

/** First free handle: base, then base + 4 random digits. */
export async function generateUniqueUsername(name: string | null | undefined, email: string): Promise<string> {
  const base = baseUsername(name, email);
  // ponytail: check-then-insert race; the @unique column is the real guard and a P2002 surfaces as a 500 on a vanishingly rare collision.
  for (let i = 0; i < 10; i++) {
    const candidate = i === 0 ? base : `${base}${randomInt(1000, 10000)}`;
    const taken = await prisma.user.findUnique({ where: { username: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  return `${base}${Date.now().toString(36)}`;
}

