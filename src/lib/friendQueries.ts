import prisma from "@/lib/prisma";

export type FriendDto = { id: string; name: string; email: string; avatar_url: string | null };

/** All profile ids the given user has an ACTIVE friendship with. */
export async function activeFriendIds(userId: string): Promise<string[]> {
  const rows = await prisma.friendship.findMany({
    where: { status: "active", OR: [{ user_a_id: userId }, { user_b_id: userId }] },
    select: { user_a_id: true, user_b_id: true },
  });
  return rows.map((r) => (r.user_a_id === userId ? r.user_b_id : r.user_a_id));
}

/** Profile ids the user has any non-active relationship with (pending or blocked), incl. self. */
export async function excludedIds(userId: string): Promise<Set<string>> {
  const rows = await prisma.friendship.findMany({
    where: { status: { in: ["pending", "blocked"] }, OR: [{ user_a_id: userId }, { user_b_id: userId }] },
    select: { user_a_id: true, user_b_id: true },
  });
  const set = new Set<string>([userId]);
  for (const r of rows) set.add(r.user_a_id === userId ? r.user_b_id : r.user_a_id);
  return set;
}

export async function profilesToDtos(ids: string[]): Promise<Map<string, FriendDto>> {
  if (ids.length === 0) return new Map();
  const profiles = await prisma.profile.findMany({
    where: { id: { in: ids }, role: "user" },
    select: { id: true, full_name: true, email: true, avatar_url: true },
  });
  return new Map(
    profiles.map((p) => [p.id, { id: p.id, name: p.full_name ?? p.email, email: p.email, avatar_url: p.avatar_url ?? null }]),
  );
}
