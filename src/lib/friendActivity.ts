export type FriendActivity = {
  friendId: string;
  friendName: string;
  friendAvatarUrl: string | null;
  scheduleId: string;
  className: string;
  startTime: string;
};

export type ActivityRow = {
  user_id: string;
  profile: { id: string; name: string | null; avatar_url: string | null } | null;
  class_schedule: { id: string; start_time: Date; class_model: { name: string } | null } | null;
};

export function mapFriendActivity(rows: ActivityRow[]): FriendActivity[] {
  const out: FriendActivity[] = [];
  for (const r of rows) {
    const sched = r.class_schedule;
    if (!sched || !sched.class_model) continue;
    out.push({
      friendId: r.user_id,
      friendName: r.profile?.name ?? "",
      friendAvatarUrl: r.profile?.avatar_url ?? null,
      scheduleId: sched.id,
      className: sched.class_model.name,
      startTime: sched.start_time.toISOString(),
    });
  }
  return out;
}
