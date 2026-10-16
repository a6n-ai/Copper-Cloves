import { BOOKING_STATUS, REVENUE_STATUSES } from "./bookingStatus";
import { bucketOf, bucketsIn, type RangeInfo, type ReportRange } from "./classReport";
import { REPORT_EXCLUDED_SCHEDULE_STATUSES } from "./scheduleStatus";

/** One booking row on a class session. Unnamed guest seats have no row of their own, so they are not members here. */
export type MemberVisit = {
  userId: string;
  name: string;
  sessionStatus: string;
  startTime: Date;
  endTime: Date;
  status: string;
  checkedIn: boolean;
  outcome: string | null;
};

export type MemberTotals = {
  /** Members who attended at least one class in the period. */
  active: number;
  newMembers: number;
  /** Confirmed bookings on counted sessions. */
  bookings: number;
  /** Confirmed bookings on sessions that have ended — the attendance denominator. */
  endedBookings: number;
  attended: number;
  noShows: number;
  cancelled: number;
};

export type MemberRow = {
  userId: string;
  name: string;
  bookings: number;
  endedBookings: number;
  attended: number;
  noShows: number;
  cancelled: number;
  /** Start of the last class attended in the range, ISO. */
  lastVisit: string | null;
};

export type AtRiskMember = { userId: string; name: string; reasons: string[] };

export type MemberReport = {
  range: RangeInfo;
  current: MemberTotals;
  previous: MemberTotals;
  /** Of the members active in the previous period, how many were active again in this one. */
  retention: { base: number; returned: number };
  trend: { bucket: string; active: number; newMembers: number }[];
  members: MemberRow[];
  atRisk: AtRiskMember[];
};

const DAY_MS = 86_400_000;
const CONFIRMED: readonly string[] = REVENUE_STATUSES;
/** A pass ending within this many days puts its holder on the at-risk list. */
export const EXPIRY_WARNING_DAYS = 14;

function emptyMemberTotals(): MemberTotals {
  return { active: 0, newMembers: 0, bookings: 0, endedBookings: 0, attended: 0, noShows: 0, cancelled: 0 };
}

function pct(n: number, d: number): number | null {
  return d > 0 ? Math.round((n / d) * 1000) / 10 : null;
}

export function memberRates(t: Pick<MemberTotals, "active" | "attended" | "endedBookings" | "noShows">) {
  return {
    attendance: pct(t.attended, t.endedBookings),
    noShowRate: pct(t.noShows, t.endedBookings),
    visitsPerActive: t.active > 0 ? Math.round((t.attended / t.active) * 10) / 10 : null,
  };
}

// ponytail: one pass in JS over every booking in two periods. Move to SQL GROUP BY user_id
// if a year-long range gets slow.
export function buildMemberReport(
  visits: MemberVisit[],
  signups: Date[],
  passes: { userId: string; name: string; expiresAt: Date }[],
  range: ReportRange,
  now: Date,
): MemberReport {
  const fromMs = range.fromUtc.getTime();
  const prevFromMs = range.prevFromUtc.getTime();
  const toMs = range.toUtcExclusive.getTime();
  const nowMs = now.getTime();

  const current = emptyMemberTotals();
  const previous = emptyMemberTotals();
  const buckets = bucketsIn(range);
  const activeByBucket = new Map<string, Set<string>>(buckets.map((b) => [b, new Set()]));
  const newByBucket = new Map<string, number>(buckets.map((b) => [b, 0]));
  const rows = new Map<string, MemberRow & { lastMs: number }>();
  // Per member: classes attended last period, and whether anything is still booked ahead.
  const before = new Map<string, { name: string; attended: number }>();
  const bookedAhead = new Set<string>();

  for (const v of visits) {
    if (REPORT_EXCLUDED_SCHEDULE_STATUSES.includes(v.sessionStatus)) continue;
    const startMs = v.startTime.getTime();
    if (startMs < prevFromMs || startMs >= toMs) continue;
    const isCurrent = startMs >= fromMs;
    const totals = isCurrent ? current : previous;

    if (v.status === BOOKING_STATUS.cancelled) {
      totals.cancelled++;
      if (isCurrent) row(rows, v).cancelled++;
      continue;
    }
    if (!CONFIRMED.includes(v.status)) continue;
    totals.bookings++;
    const ended = v.endTime.getTime() < nowMs;
    const attended = ended && v.checkedIn;
    const noShow = ended && v.outcome === "no_show";
    if (ended) totals.endedBookings++;
    if (attended) totals.attended++;
    if (noShow) totals.noShows++;

    if (!isCurrent) {
      if (attended) {
        const b = before.get(v.userId) ?? { name: v.name, attended: 0 };
        b.attended++;
        before.set(v.userId, b);
      }
      continue;
    }
    if (!ended) bookedAhead.add(v.userId);
    const r = row(rows, v);
    r.bookings++;
    if (ended) r.endedBookings++;
    if (noShow) r.noShows++;
    if (attended) {
      r.attended++;
      if (startMs > r.lastMs) r.lastMs = startMs;
      activeByBucket.get(bucketOf(v.startTime, range.bucket))?.add(v.userId);
    }
  }

  const activeNow = new Set<string>();
  for (const r of rows.values()) if (r.attended > 0) activeNow.add(r.userId);
  current.active = activeNow.size;
  previous.active = before.size;

  for (const d of signups) {
    const ms = d.getTime();
    if (ms < prevFromMs || ms >= toMs) continue;
    if (ms < fromMs) {
      previous.newMembers++;
      continue;
    }
    current.newMembers++;
    const b = bucketOf(d, range.bucket);
    newByBucket.set(b, (newByBucket.get(b) ?? 0) + 1);
  }

  const risk = new Map<string, AtRiskMember>();
  const flag = (userId: string, name: string, reason: string) => {
    const r = risk.get(userId) ?? { userId, name, reasons: [] };
    r.reasons.push(reason);
    risk.set(userId, r);
  };
  // Most classes last period first: the regulars who stopped are the ones to call.
  for (const [userId, b] of [...before].sort((x, y) => y[1].attended - x[1].attended)) {
    if (activeNow.has(userId) || bookedAhead.has(userId)) continue;
    flag(userId, b.name, `${b.attended} ${b.attended === 1 ? "class" : "classes"} last period, none since`);
  }
  // A member holding a later pass as well is not about to lapse, so judge each by their latest expiry.
  const latest = new Map<string, { name: string; expiresMs: number }>();
  for (const p of passes) {
    const ms = p.expiresAt.getTime();
    if (ms < nowMs) continue;
    const have = latest.get(p.userId);
    if (!have || ms > have.expiresMs) latest.set(p.userId, { name: p.name, expiresMs: ms });
  }
  for (const [userId, p] of [...latest].sort((x, y) => x[1].expiresMs - y[1].expiresMs)) {
    const days = Math.floor((p.expiresMs - nowMs) / DAY_MS);
    if (days >= EXPIRY_WARNING_DAYS) continue;
    flag(userId, p.name, days === 0 ? "Pass ends today" : `Pass ends in ${days} ${days === 1 ? "day" : "days"}`);
  }

  let returned = 0;
  for (const userId of before.keys()) if (activeNow.has(userId)) returned++;

  return {
    range: { from: range.from, to: range.to, prevFrom: range.prevFrom, prevTo: range.prevTo, bucket: range.bucket },
    current,
    previous,
    retention: { base: before.size, returned },
    trend: buckets.map((b) => ({ bucket: b, active: activeByBucket.get(b)?.size ?? 0, newMembers: newByBucket.get(b) ?? 0 })),
    members: [...rows.values()]
      .sort((a, b) => b.attended - a.attended || b.bookings - a.bookings)
      .map(({ lastMs, ...r }) => ({ ...r, lastVisit: lastMs > 0 ? new Date(lastMs).toISOString() : null })),
    atRisk: [...risk.values()],
  };
}

function row(rows: Map<string, MemberRow & { lastMs: number }>, v: MemberVisit) {
  let r = rows.get(v.userId);
  if (!r) {
    r = { userId: v.userId, name: v.name, bookings: 0, endedBookings: 0, attended: 0, noShows: 0, cancelled: 0, lastVisit: null, lastMs: 0 };
    rows.set(v.userId, r);
  }
  return r;
}
