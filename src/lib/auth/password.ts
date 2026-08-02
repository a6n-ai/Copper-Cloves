import bcrypt from "bcryptjs";
import { hashPassword as scryptHash, verifyPassword as scryptVerify } from "better-auth/crypto";
import logger from "@/lib/logger";

const BCRYPT = /^\$2[aby]\$/;
/** better-auth scrypt output: "<salt-hex>:<hash-hex>". */
const SCRYPT = /^[0-9a-f]+:[0-9a-f]+$/;

/**
 * Merged-identity marker. When two Profile rows for one person carried
 * DIFFERENT passwords, the identity merge would otherwise silently invalidate
 * one of them. Both are kept and either signs in. Neither "$2…" (bcrypt) nor
 * "<hex>:<hex>" (scrypt) can start with this, and "|" is outside bcrypt's
 * "./A-Za-z0-9" alphabet, so the encoding is unambiguous.
 */
const MULTI = "multi:";
const MULTI_SEP = "|";

/**
 * Encode one-or-more hashes for a single account. A single hash is returned
 * bare, so only genuinely merged accounts pay the wrapper. Duplicates collapse.
 */
export function packMultiHash(hashes: string[]): string {
  const unique = [...new Set(hashes.filter(Boolean))];
  if (unique.length === 0) throw new Error("packMultiHash: no hashes supplied");
  if (unique.length === 1) return unique[0];
  if (unique.some((h) => h.includes(MULTI_SEP) || h.startsWith(MULTI))) {
    throw new Error("packMultiHash: refusing to nest an already-packed hash");
  }
  return MULTI + unique.join(MULTI_SEP);
}

/** Inverse of packMultiHash. Bare hash -> single-element array; "" -> []. */
export function unpack(hash: string): string[] {
  if (!hash) return [];
  return hash.startsWith(MULTI) ? hash.slice(MULTI.length).split(MULTI_SEP).filter(Boolean) : [hash];
}

/** What a stored hash looks like, for logging. NEVER returns any part of the hash. */
export function describeHash(hash: string): string {
  if (!hash) return "empty";
  if (hash.startsWith(MULTI)) return `multi(${unpack(hash).length})`;
  if (BCRYPT.test(hash)) return "bcrypt";
  if (SCRYPT.test(hash)) return "scrypt";
  return "unrecognised";
}

/** Verify against exactly one stored hash. Never throws. */
async function verifyOne(hash: string, password: string): Promise<boolean> {
  try {
    if (BCRYPT.test(hash)) return await bcrypt.compare(password, hash);
    if (SCRYPT.test(hash)) return await scryptVerify({ hash, password });
    return false;
  } catch {
    return false;
  }
}

/**
 * Password adapter for better-auth. New passwords are scrypt; the 602 bcrypt
 * hashes migrated from NextAuth verify in place, so no member ever resets.
 *
 * Fails CLOSED on an unreadable hash, but logs the FORMAT — otherwise "this
 * hash cannot be read" and "you typed the wrong password" are the same 401 and
 * a login path can stay broken behind an account row that looks healthy.
 */
export const studioPassword = {
  // A password CHANGE always collapses a merged account back to one scrypt hash.
  hash: (plain: string): Promise<string> => scryptHash(plain),

  async verify({ hash, password }: { hash: string; password: string }): Promise<boolean> {
    const candidates = unpack(hash);

    if (candidates.length === 0 || candidates.every((c) => !BCRYPT.test(c) && !SCRYPT.test(c))) {
      logger.error(
        { hashFormat: describeHash(hash) },
        "[auth] stored password hash has no readable bcrypt or scrypt entry — login will always fail for this account until the password is reset",
      );
      return false;
    }

    // Check EVERY candidate, no early return on the first match, so verification
    // time does not depend on which password was supplied.
    let matched = false;
    for (const candidate of candidates) {
      if (await verifyOne(candidate, password)) matched = true;
    }
    return matched;
  },
};
