import prisma from "@/lib/prisma";

export interface DynamicStats {
  total_classes_attended: number;
  current_streak: number;
  longest_streak: number;
  last_class_date: Date | null;
}

const EMPTY: DynamicStats = {
  total_classes_attended: 0,
  current_streak: 0,
  longest_streak: 0,
  last_class_date: null,
};

function dayStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// ponytail: a current streak decays to 0 after a 1-day gap, so a 90-day lookback
// holds every live streak — bounding the batch/leaderboard scans here keeps them
// off the full bookings table. Ceiling: longest_streak computed off a windowed
// scan truncates at 90 consecutive days (no consumer reads it from those paths).
// Raise STREAK_LOOKBACK_DAYS if a member ever sustains a 90+ day streak.
const STREAK_LOOKBACK_DAYS = 90;
function streakWindowStart(): Date {
  const d = dayStart(new Date());
  d.setDate(d.getDate() - STREAK_LOOKBACK_DAYS);
  return d;
}

// Total = every checked-in booking. Streaks = consecutive calendar days with a
// check-in, computed from check_in_time (rows without it count toward the total
// but not the streak — mirrors the previous backfill behaviour). The current
// streak decays to 0 if the last attended day is more than one day ago.
function computeStats(rows: { check_in_time: Date | null }[]): DynamicStats {
  const total = rows.length;
  const days = rows
    .map((r) => r.check_in_time)
    .filter((d): d is Date => d != null)
    .sort((a, b) => a.getTime() - b.getTime());

  if (days.length === 0) {
    return { ...EMPTY, total_classes_attended: total };
  }

  let current = 0;
  let longest = 0;
  let prevDay: Date | null = null;

  for (const date of days) {
    const day = dayStart(date);
    if (!prevDay) {
      current = 1;
    } else {
      const diff = Math.round((day.getTime() - prevDay.getTime()) / 86_400_000);
      if (diff === 0) {
        // same calendar day — no change
      } else if (diff === 1) {
        current++;
      } else {
        current = 1;
      }
    }
    longest = Math.max(longest, current);
    if (!prevDay || day.getTime() !== prevDay.getTime()) prevDay = day;
  }

  if (prevDay) {
    const today = dayStart(new Date());
    const daysSince = Math.round((today.getTime() - prevDay.getTime()) / 86_400_000);
    if (daysSince > 1) current = 0;
  }

  return {
    total_classes_attended: total,
    current_streak: current,
    longest_streak: longest,
    last_class_date: days[days.length - 1],
  };
}

export async function getDynamicStats(userId: string): Promise<DynamicStats> {
  const rows = await prisma.booking.findMany({
    where: { user_id: userId, checked_in: true },
    select: { check_in_time: true },
  });
  return computeStats(rows);
}

export async function getDynamicStatsForUsers(
  userIds: string[],
): Promise<Map<string, DynamicStats>> {
  const result = new Map<string, DynamicStats>();
  if (userIds.length === 0) return result;

  // Total + last-visit come from a DB aggregate (all-time, correct, no row load);
  // streaks need the per-day sequence but only the recent window can hold a live
  // one — so the heavy scan is bounded while totals stay exact.
  const [totals, recent] = await Promise.all([
    prisma.booking.groupBy({
      by: ["user_id"],
      where: { user_id: { in: userIds }, checked_in: true },
      _count: { _all: true },
      _max: { check_in_time: true },
    }),
    prisma.booking.findMany({
      where: {
        user_id: { in: userIds },
        checked_in: true,
        check_in_time: { gte: streakWindowStart() },
      },
      select: { user_id: true, check_in_time: true },
    }),
  ]);

  const aggByUser = new Map(
    totals.map((t) => [t.user_id, { total: t._count._all, last: t._max.check_in_time }]),
  );
  const recentByUser = new Map<string, { check_in_time: Date | null }[]>();
  for (const r of recent) {
    const arr = recentByUser.get(r.user_id) ?? [];
    arr.push({ check_in_time: r.check_in_time });
    recentByUser.set(r.user_id, arr);
  }

  for (const id of userIds) {
    const streaks = computeStats(recentByUser.get(id) ?? []);
    const agg = aggByUser.get(id);
    result.set(id, {
      ...streaks,
      total_classes_attended: agg?.total ?? 0,
      last_class_date: agg?.last ?? null,
    });
  }
  return result;
}

// Streaks for the top-N users by attendance, computed dynamically. Returns rows
// already sorted by current_streak desc. Used by admin leaderboards until a DB
// view replaces it.
export async function getTopStreaks(
  limit: number,
): Promise<{ user_id: string; stats: DynamicStats }[]> {
  const all = await computeAllUserStats();
  all.sort((a, b) => b.stats.current_streak - a.stats.current_streak);
  return all.slice(0, limit);
}

// Streak-only consumers (leaderboard, distribution) — bounded to the live-streak
// window so this never loads the entire bookings table. total_classes_attended /
// last_class_date on the returned stats are window-scoped here; do NOT read them
// off this path (use getDynamicStats/getDynamicStatsForUsers for accurate totals).
async function computeAllUserStats(): Promise<{ user_id: string; stats: DynamicStats }[]> {
  const rows = await prisma.booking.findMany({
    where: { checked_in: true, check_in_time: { gte: streakWindowStart() } },
    select: { user_id: true, check_in_time: true },
  });

  const byUser = new Map<string, { check_in_time: Date | null }[]>();
  for (const r of rows) {
    const arr = byUser.get(r.user_id) ?? [];
    arr.push({ check_in_time: r.check_in_time });
    byUser.set(r.user_id, arr);
  }

  return Array.from(byUser.entries()).map(([user_id, list]) => ({
    user_id,
    stats: computeStats(list),
  }));
}

const STREAK_BUCKETS = [
  { range: "1-2", min: 1, max: 2 },
  { range: "3-5", min: 3, max: 5 },
  { range: "6-10", min: 6, max: 10 },
  { range: "11-20", min: 11, max: 20 },
  { range: "21+", min: 21, max: Infinity },
] as const;

function bucketStreaks(all: { stats: DynamicStats }[]): { range: string; count: number }[] {
  return STREAK_BUCKETS.map((b) => ({
    range: b.range,
    count: all.filter(({ stats }) => stats.current_streak >= b.min && stats.current_streak <= b.max).length,
  }));
}

// Histogram of members by current-streak length (days). Only counts members
// with an active streak (>0). Buckets/labels are returned ready for charting.
export async function getStreakDistribution(): Promise<{ range: string; count: number }[]> {
  return bucketStreaks(await computeAllUserStats());
}

/**
 * Leaderboard + distribution from a SINGLE pass over all check-ins. The dashboard
 * needs both; computing them separately scanned the entire bookings table twice.
 */
export async function getStreakLeaderboardAndDistribution(limit: number): Promise<{
  top: { user_id: string; stats: DynamicStats }[];
  distribution: { range: string; count: number }[];
}> {
  const all = await computeAllUserStats();
  const top = [...all].sort((a, b) => b.stats.current_streak - a.stats.current_streak).slice(0, limit);
  return { top, distribution: bucketStreaks(all) };
}
