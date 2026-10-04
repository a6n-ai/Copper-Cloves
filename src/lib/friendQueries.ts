import prisma from "@/lib/prisma";

/**
 * What one member may see about another. Email and phone are deliberately
 * absent — `has_phone` is all the booking flow needs to decide whether to ask
 * for a number (resolve-invites backfills it server-side by profile_id).
 */
export type FriendDto = { id: string; name: string; username: string | null; has_phone: boolean; avatar_url: string | null };

export const FRIEND_DTO_SELECT = {
  id: true,
  full_name: true,
  phone: true,
  avatar_url: true,
  identity: { select: { username: true } },
} as const;

type FriendDtoRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  identity: { username: string | null } | null;
};

export function toFriendDto(p: FriendDtoRow): FriendDto {
  // `username` only — it is unique and validated. displayUsername is neither
  // (any member can set it via /update-user), so showing it would let anyone
  // render as someone else's @handle.
  const username = p.identity?.username ?? null;
  return {
    id: p.id,
    name: p.full_name?.trim() || (username ? `@${username}` : "Member"),
    username,
    has_phone: !!p.phone?.trim(),
    avatar_url: p.avatar_url ?? null,
  };
}

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
    select: FRIEND_DTO_SELECT,
  });
  return new Map(profiles.map((p) => [p.id, toFriendDto(p)]));
}
