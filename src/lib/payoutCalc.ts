/**
 * Single source of truth for instructor payout math.
 *
 * Rules:
 *   - Class rate ₹945, minus 5% GST → ₹897.75 net per payable unit.
 *   - Payable unit = every booking row EXCEPT timely cancels (>=6h before start).
 *     Counted: checked-in, no-show, late-cancel (<6h). Refunded timely cancels: not paid.
 *     Cancelled with no cancellation_date → treated as timely (no pay).
 *   - Guests are already separate booking rows (see lib/guestOnboarding.ts), so
 *     we count rows directly — do NOT add extra_guest_count.
 *   - Floor: if a schedule has 0 payable rows but the instructor checked in on_time,
 *     payable for that schedule = 1.
 *   - Attribution: actual_instructor_id (substitute) takes precedence over instructor_id.
 *   - instructorPct = 100 − studio_payout_cut_percent (default cut 40 → instructor 60).
 */

export const CLASS_RATE_INR = 945;
export const GST_PERCENT = 5;
export const NET_PER_UNIT = CLASS_RATE_INR * (1 - GST_PERCENT / 100); // 897.75
export const DEFAULT_STUDIO_CUT_PERCENT = 40;
export const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export type PayoutWindow = "week" | "month" | "quarter" | "all";

export interface BookingRow {
  status: string;
  checked_in: boolean;
  cancellation_date: Date | null;
}

export function isPayable(b: BookingRow, startTime: Date): boolean {
  if (b.status === "cancelled") {
    if (!b.cancellation_date) return false;
    const lead = startTime.getTime() - b.cancellation_date.getTime();
    return lead < SIX_HOURS_MS;
  }
  return true;
}

/** Per-schedule payable count, applying floor rule. */
export function payableForSchedule(
  bookings: BookingRow[],
  startTime: Date,
  instructorCheckInOutcome: string | null | undefined,
): number {
  const base = bookings.filter((b) => isPayable(b, startTime)).length;
  if (base === 0 && instructorCheckInOutcome === "on_time") return 1;
  return base;
}

export function instructorPctFrom(studioCutPct: number | null | undefined): number {
  const raw = studioCutPct != null && Number.isFinite(Number(studioCutPct))
    ? Number(studioCutPct)
    : DEFAULT_STUDIO_CUT_PERCENT;
  return Math.max(0, Math.min(100, 100 - raw));
}

export function payoutForUnits(payableUnits: number, instructorPct: number): number {
  return payableUnits * NET_PER_UNIT * (instructorPct / 100);
}

/** Bucket key for adjustment table. `month` → "YYYY-MM", `week` → "YYYY-Www" (ISO), else "all". */
export function periodKeyFor(window: PayoutWindow, ref: Date = new Date()): string {
  if (window === "month") {
    return `${ref.getUTCFullYear()}-${String(ref.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  if (window === "week") {
    const w = isoWeek(ref);
    return `${w.year}-W${String(w.week).padStart(2, "0")}`;
  }
  if (window === "quarter") {
    const q = Math.floor(ref.getUTCMonth() / 3) + 1;
    return `${ref.getUTCFullYear()}-Q${q}`;
  }
  return "all";
}

export function periodBoundsFor(window: PayoutWindow, ref: Date = new Date()): {
  start: Date | null;
  end: Date | null;
} {
  if (window === "all") return { start: null, end: null };
  if (window === "month") {
    const start = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
    const end = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 1));
    return { start, end };
  }
  if (window === "quarter") {
    const qStartMonth = Math.floor(ref.getUTCMonth() / 3) * 3;
    const start = new Date(Date.UTC(ref.getUTCFullYear(), qStartMonth, 1));
    const end = new Date(Date.UTC(ref.getUTCFullYear(), qStartMonth + 3, 1));
    return { start, end };
  }
  // week: ISO week Mon-Sun in UTC
  const d = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate()));
  const day = d.getUTCDay() || 7; // Sun=0 → 7
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - (day - 1));
  const nextMonday = new Date(monday);
  nextMonday.setUTCDate(monday.getUTCDate() + 7);
  return { start: monday, end: nextMonday };
}

function isoWeek(date: Date): { year: number; week: number } {
  // Copy date so don't modify original.
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // Set to nearest Thursday: current date + 4 - current day number (ISO: Mon=1, Sun=7)
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week: weekNo };
}
