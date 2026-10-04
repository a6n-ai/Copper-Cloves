import { randomInt } from "crypto";
import prisma from "@/lib/prisma";

// Must satisfy the better-auth username plugin defaults: /^[a-zA-Z0-9_.]+$/, 3–30 chars.
const MAX_BASE = 24;

const RESERVED = /^(admin|administrator|studio|copper|cloves|coppercloves|thestudio|support|help|staff|instructor|partner|owner|official|team|root|system|null|undefined|member)([._]|$)/;

/** Plugin validator: default charset plus a reserved-name block (no posing as staff/studio). */
export function isAllowedUsername(username: string): boolean {
  return /^[a-zA-Z0-9_.]+$/.test(username) && !RESERVED.test(username.toLowerCase());
}

/**
 * "Priya  Sharma" -> "priya.sharma". Falls back to "member" (made unique with
 * digits). Never derived from email or phone — the handle is public and would
 * otherwise leak the address's local part.
 */
export function baseUsername(name: string | null | undefined): string {
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
  if (fromName.length >= 3 && !(name ?? "").includes("@") && isAllowedUsername(fromName)) return fromName;
  return "member";
}

/** First free handle: base, then base + 4 random digits. */
export async function generateUniqueUsername(name: string | null | undefined): Promise<string> {
  const base = baseUsername(name);
  // ponytail: check-then-insert race; the @unique column is the real guard and a P2002 surfaces as a 500 on a vanishingly rare collision.
  for (let i = 0; i < 10; i++) {
    // "member" is reserved on its own, so the fallback always carries digits.
    const candidate = i === 0 && base !== "member" ? base : `${base}${randomInt(1000, 10000)}`;
    const taken = await prisma.user.findUnique({ where: { username: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  return `${base}${Date.now().toString(36)}`;
}

