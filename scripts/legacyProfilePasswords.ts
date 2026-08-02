import prisma from "@/lib/prisma";

/**
 * Reads `profiles.hashedPassword` — the pre-better-auth password column.
 *
 * Task 13 Phase A drops the field from the Prisma schema, but the COLUMN is only
 * dropped by Phase B's `db push`, which runs AFTER the backfill and its verifier.
 * The typed client can no longer select it, so these two scripts read it raw.
 * Both are one-shot migration tools; nothing on a request path uses this.
 *
 * Returns profileId -> hash, omitting profiles with no password. Never logged.
 */
export async function legacyHashedPasswords(): Promise<Map<string, string>> {
  const rows = await prisma.$queryRaw<Array<{ id: string; hashedPassword: string | null }>>`
    SELECT id, "hashedPassword" FROM profiles WHERE "hashedPassword" IS NOT NULL
  `;
  return new Map(rows.filter((r) => r.hashedPassword).map((r) => [r.id, r.hashedPassword!]));
}
