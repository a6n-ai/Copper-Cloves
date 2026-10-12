import { BOOKING_STATUS, REVENUE_STATUSES } from "./bookingStatus";
import { istMidnightToUtc, utcToIstParts } from "./istTime";

export type Totals = {
  sessions: number;
  seatsOffered: number;
  /** Seats taken by confirmed bookings, guests included. */
  signups: number;
  /** Confirmed booking rows across all counted sessions. */
  bookedRows: number;
  cancelledRows: number;
  /** Confirmed booking rows on sessions that have ended — the attendance denominator. */
  endedBookedRows: number;
  attended: number;
  noShows: number;
};

export type SessionRow = {
  id: string;
  classId: string;
  className: string;
  category: string;
  status: string;
  startTime: Date;
  endTime: Date;
  capacity: number;
  instructorId: string | null;
  instructorName: string;
  bookings: { status: string; checkedIn: boolean; outcome: string | null; guests: number }[];
};

export type RangeInfo = {
  from: string;
  to: string;
  prevFrom: string;
  prevTo: string;
  bucket: "day" | "week";
};

export type ReportRange = RangeInfo & { fromUtc: Date; toUtcExclusive: Date; prevFromUtc: Date };

export type ClassEntry = {
  classId: string;
  name: string;
  category: string;
  current: Totals;
  previous: Totals;
  /** Utilization per trend bucket; null where the class had no seats on offer. */
  spark: (number | null)[];
};

export type InstructorEntry = { instructorId: string | null; name: string; totals: Totals };

export type SessionEntry = {
  id: string;
  startTime: string;
  instructorName: string;
  ended: boolean;
  capacity: number;
  signups: number;
  attended: number;
  noShows: number;
  cancelled: number;
};

export type ClassReport = {
  range: RangeInfo;
  current: Totals;
  previous: Totals;
  trend: { bucket: string; totals: Totals }[];
  /** cells key = `${istHour}-${dayIdx}`, dayIdx 0 = Monday. */
  heatmap: { hours: number[]; cells: Record<string, Totals> };
  classes: ClassEntry[];
  instructors?: InstructorEntry[];
  sessions?: SessionEntry[];
};

const DAY_MS = 86_400_000;
const DEFAULT_RANGE_DAYS = 30;
export const MAX_RANGE_DAYS = 366;
const DAILY_BUCKET_MAX_DAYS = 31;
const EXCLUDED_SESSION_STATUSES: readonly string[] = ["cancelled", "inactive", "abandoned"];
const CONFIRMED: readonly string[] = REVENUE_STATUSES;

/** Tunable thresholds for the needs-attention list. */
export const ATTENTION = { minSessions: 3, lowUtilization: 50, dropPoints: 15 };

// An IST calendar day is represented as the ms timestamp of that date at UTC midnight
// ("day key"), so day arithmetic is plain addition and never touches the server timezone.
function parseDay(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return fmtDay(t) === s ? t : null; // rejects rollovers like 2026-02-31
}

function fmtDay(dayKey: number): string {
  return new Date(dayKey).toISOString().slice(0, 10);
}

function istDayKey(instant: Date): number {
  const p = utcToIstParts(instant);
  return Date.UTC(p.year, p.month, p.day);
}

function dayKeyToUtc(dayKey: number): Date {
  const d = new Date(dayKey);
  return istMidnightToUtc(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** 0 = Monday. */
function weekdayIdx(dayKey: number): number {
  return (new Date(dayKey).getUTCDay() + 6) % 7;
}

function bucketOfDay(dayKey: number, bucket: RangeInfo["bucket"]): number {
  return bucket === "day" ? dayKey : dayKey - weekdayIdx(dayKey) * DAY_MS;
}

export function resolveRange(fromRaw: unknown, toRaw: unknown, now: Date): ReportRange | { error: string } {
  const today = istDayKey(now);
  const f = typeof fromRaw === "string" ? parseDay(fromRaw) : null;
  const t = typeof toRaw === "string" ? parseDay(toRaw) : null;
  const valid = f !== null && t !== null;
  const to = valid ? t : today;
  const from = valid ? f : today - (DEFAULT_RANGE_DAYS - 1) * DAY_MS;
  if (from > to) return { error: "from must be on or before to" };
  const days = (to - from) / DAY_MS + 1;
  if (days > MAX_RANGE_DAYS) return { error: `Range cannot exceed ${MAX_RANGE_DAYS} days` };
  const prevFrom = from - days * DAY_MS;
  return {
    from: fmtDay(from),
    to: fmtDay(to),
    prevFrom: fmtDay(prevFrom),
    prevTo: fmtDay(from - DAY_MS),
    bucket: days <= DAILY_BUCKET_MAX_DAYS ? "day" : "week",
    fromUtc: dayKeyToUtc(from),
    toUtcExclusive: dayKeyToUtc(to + DAY_MS),
    prevFromUtc: dayKeyToUtc(prevFrom),
  };
}

export function emptyTotals(): Totals {
  return {
    sessions: 0,
    seatsOffered: 0,
    signups: 0,
    bookedRows: 0,
    cancelledRows: 0,
    endedBookedRows: 0,
    attended: 0,
    noShows: 0,
  };
}

function sessionTotals(s: SessionRow, ended: boolean): Totals {
  const t = emptyTotals();
  t.sessions = 1;
  t.seatsOffered = s.capacity;
  for (const b of s.bookings) {
    if (b.status === BOOKING_STATUS.cancelled) {
      t.cancelledRows++;
      continue;
    }
    if (!CONFIRMED.includes(b.status)) continue;
    t.bookedRows++;
    t.signups += 1 + b.guests;
    if (!ended) continue;
    t.endedBookedRows++;
    if (b.checkedIn) t.attended++;
    if (b.outcome === "no_show") t.noShows++;
  }
  return t;
}

function add(into: Totals, from: Totals): void {
  for (const k of Object.keys(into) as (keyof Totals)[]) into[k] += from[k];
}

function pct(n: number, d: number): number | null {
  return d > 0 ? Math.round((n / d) * 1000) / 10 : null;
}

export function rates(t: Totals) {
  return {
    utilization: pct(t.signups, t.seatsOffered),
    attendance: pct(t.attended, t.endedBookedRows),
    noShowRate: pct(t.noShows, t.endedBookedRows),
    cancellationRate: pct(t.cancelledRows, t.bookedRows + t.cancelledRows),
  };
}

/** Change between two rates, in percentage points. */
export function pointDelta(cur: number | null, prev: number | null): number | null {
  return cur === null || prev === null ? null : Math.round((cur - prev) * 10) / 10;
}

/** Change between two counts, in percent. */
export function percentDelta(cur: number, prev: number): number | null {
  return prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null;
}

export function attentionReason(current: Totals, previous: Totals): string | null {
  if (current.sessions < ATTENTION.minSessions) return null;
  const utilization = rates(current).utilization;
  if (utilization === null) return null;
  if (utilization < ATTENTION.lowUtilization) return `${Math.min(Math.round(utilization), ATTENTION.lowUtilization - 1)}% full`;
  const change = pointDelta(utilization, rates(previous).utilization);
  if (change !== null && change <= -ATTENTION.dropPoints) return `down ${Math.abs(Math.round(change))} pts`;
  return null;
}

export function disciplineLabel(category: string): string {
  return category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ponytail: aggregates in JS over every schedule row in two periods (a few thousand
// rows for a year-long range). Move to SQL GROUP BY if the studio outgrows that.
export function buildClassReport(rows: SessionRow[], range: ReportRange, now: Date, detail = false): ClassReport {
  const fromMs = range.fromUtc.getTime();
  const prevFromMs = range.prevFromUtc.getTime();
  const toMs = range.toUtcExclusive.getTime();
  const nowMs = now.getTime();

  const bucketKeys: number[] = [];
  const step = range.bucket === "day" ? DAY_MS : 7 * DAY_MS;
  const lastDay = parseDay(range.to) as number;
  for (let k = bucketOfDay(parseDay(range.from) as number, range.bucket); k <= lastDay; k += step) bucketKeys.push(k);

  const current = emptyTotals();
  const previous = emptyTotals();
  const trend = new Map<number, Totals>(bucketKeys.map((k) => [k, emptyTotals()]));
  const cells: Record<string, Totals> = {};
  const hours = new Set<number>();
  const classes = new Map<string, Omit<ClassEntry, "spark"> & { buckets: Map<number, Totals> }>();
  const instructors = new Map<string, InstructorEntry>();
  const sessions: SessionEntry[] = [];

  for (const s of rows) {
    if (EXCLUDED_SESSION_STATUSES.includes(s.status)) continue;
    const startMs = s.startTime.getTime();
    if (startMs < prevFromMs || startMs >= toMs) continue;
    const isCurrent = startMs >= fromMs;
    const ended = s.endTime.getTime() < nowMs;
    const one = sessionTotals(s, ended);

    let cls = classes.get(s.classId);
    if (!cls) {
      cls = {
        classId: s.classId,
        name: s.className,
        category: s.category,
        current: emptyTotals(),
        previous: emptyTotals(),
        buckets: new Map(),
      };
      classes.set(s.classId, cls);
    }
    add(isCurrent ? cls.current : cls.previous, one);
    add(isCurrent ? current : previous, one);
    if (!isCurrent) continue;

    const dayKey = istDayKey(s.startTime);
    const bucket = bucketOfDay(dayKey, range.bucket);
    const trendTotals = trend.get(bucket);
    if (trendTotals) add(trendTotals, one);
    let classBucket = cls.buckets.get(bucket);
    if (!classBucket) cls.buckets.set(bucket, (classBucket = emptyTotals()));
    add(classBucket, one);

    const hour = utcToIstParts(s.startTime).hour;
    hours.add(hour);
    add((cells[`${hour}-${weekdayIdx(dayKey)}`] ??= emptyTotals()), one);

    if (!detail) continue;
    const instructorKey = s.instructorId ?? "";
    let inst = instructors.get(instructorKey);
    if (!inst) {
      inst = { instructorId: s.instructorId, name: s.instructorName, totals: emptyTotals() };
      instructors.set(instructorKey, inst);
    }
    add(inst.totals, one);
    sessions.push({
      id: s.id,
      startTime: s.startTime.toISOString(),
      instructorName: s.instructorName,
      ended,
      capacity: s.capacity,
      signups: one.signups,
      attended: one.attended,
      noShows: one.noShows,
      cancelled: one.cancelledRows,
    });
  }

  const report: ClassReport = {
    range: { from: range.from, to: range.to, prevFrom: range.prevFrom, prevTo: range.prevTo, bucket: range.bucket },
    current,
    previous,
    trend: bucketKeys.map((k) => ({ bucket: fmtDay(k), totals: trend.get(k) as Totals })),
    heatmap: { hours: [...hours].sort((a, b) => a - b), cells },
    classes: [...classes.values()]
      .filter((c) => c.current.sessions > 0 || c.previous.sessions > 0)
      .sort((a, b) => b.current.signups - a.current.signups)
      .map(({ buckets, ...c }) => ({
        ...c,
        spark: bucketKeys.map((k) => rates(buckets.get(k) ?? emptyTotals()).utilization),
      })),
  };
  if (detail) {
    report.instructors = [...instructors.values()].sort((a, b) => b.totals.sessions - a.totals.sessions);
    report.sessions = sessions.sort((a, b) => b.startTime.localeCompare(a.startTime));
  }
  return report;
}
