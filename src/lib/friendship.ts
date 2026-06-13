import type { Prisma, PrismaClient } from "@/generated/prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

/** Normalize an unordered id pair to (a, b) with a < b. Returns null for self/empty. */
export function canonicalPair(id1: string, id2: string): { a: string; b: string } | null {
  if (!id1 || !id2 || id1 === id2) return null;
  return id1 < id2 ? { a: id1, b: id2 } : { a: id2, b: id1 };
}

/**
 * Idempotent friendship writer — the ONLY place friendship rows are created/upgraded.
 *
 * mode "active"  → from a real-world invite (booking/guest). Creates active, or
 *                  upgrades an existing pending row to active. Blocked stays blocked.
 * mode "request" → manual add-friend. Creates pending (requested_by). No-op if a
 *                  row already exists (active/pending/blocked).
 *
 * Best-effort: callers in booking flows wrap in try/catch; this never throws into them.
 */
export async function upsertFriendship(
  db: Db,
  id1: string,
  id2: string,
  source: "invite" | "manual" = "invite",
  mode: "active" | "request" = "active",
  requestedBy?: string,
): Promise<void> {
  const pair = canonicalPair(id1, id2);
  if (!pair) return;

  const existing = await db.friendship.findUnique({
    where: { user_a_id_user_b_id: { user_a_id: pair.a, user_b_id: pair.b } },
    select: { id: true, status: true },
  });

  if (existing) {
    if (existing.status === "blocked") return;
    if (existing.status === "active") return;
    if (mode === "active") {
      await db.friendship.update({ where: { id: existing.id }, data: { status: "active" } });
    }
    return;
  }

  await db.friendship.create({
    data: {
      user_a_id: pair.a,
      user_b_id: pair.b,
      status: mode === "request" ? "pending" : "active",
      requested_by_id: mode === "request" ? (requestedBy ?? id1) : null,
      source,
    },
  });
}
