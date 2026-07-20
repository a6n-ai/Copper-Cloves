export type Friend = { id: string; name: string; email: string; phone: string | null; avatar_url: string | null };
export type Suggestion = Friend & { mutualCount: number };
export type FriendRequests = { incoming: Friend[]; outgoing: Friend[] };

export async function getFriends(): Promise<Friend[]> {
  const r = await fetch("/api/friends");
  return r.ok ? r.json() : [];
}

export async function getFriendRequests(): Promise<FriendRequests> {
  const r = await fetch("/api/friends/requests");
  return r.ok ? r.json() : { incoming: [], outgoing: [] };
}

export async function getSuggestions(): Promise<Suggestion[]> {
  const r = await fetch("/api/friends/suggestions");
  return r.ok ? r.json() : [];
}

export async function sendFriendRequest(friendId: string): Promise<boolean> {
  const r = await fetch("/api/friends", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ friendId }),
  });
  return r.ok;
}

export async function respondToRequest(friendId: string, action: "accept" | "decline"): Promise<boolean> {
  const r = await fetch("/api/friends/respond", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ friendId, action }),
  });
  return r.ok;
}

export async function removeFriend(friendId: string): Promise<boolean> {
  const r = await fetch(`/api/friends?friendId=${encodeURIComponent(friendId)}`, { method: "DELETE" });
  return r.ok;
}

export async function cancelRequest(friendId: string): Promise<boolean> {
  const r = await fetch(`/api/friends?friendId=${encodeURIComponent(friendId)}`, { method: "DELETE" });
  return r.ok;
}

export async function blockFriend(friendId: string): Promise<boolean> {
  const r = await fetch("/api/friends/block", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ friendId }),
  });
  return r.ok;
}

export type FriendActivity = {
  friendId: string;
  friendName: string;
  friendAvatarUrl: string | null;
  scheduleId: string;
  className: string;
  startTime: string;
};

export async function getFriendActivity(): Promise<FriendActivity[]> {
  const r = await fetch("/api/friends/activity");
  return r.ok ? r.json() : [];
}

export async function inviteFriend(
  input: { name: string; email: string; phone: string },
): Promise<{ ok: boolean; error?: string; isNew?: boolean }> {
  const r = await fetch("/api/friends/invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await r.json().catch(() => ({}));
  return r.ok ? { ok: true, isNew: data.isNew } : { ok: false, error: data.error };
}
