/**
 * Single source of truth for instructor payout math (settings-driven, tiered).
 *
 * Per-class net rate for a tier:
 *   net = (package_rate_paise / num_classes) / (1 + gst%/100) × (instructorPct/100)
 * Blended rate = simple average of the four tier net rates (auto), overridable per period.
 * Payout = payable_units × blended_rate. All monetary values in PAISE.
 *
 * Payable unit = every booking row EXCEPT timely cancels (>=6h before start).
 *   Counted: checked-in, no-show, late-cancel (<6h). Refunded timely cancels: not paid.
 *   Cancelled with no cancellation_date → treated as timely (no pay).
 * Guests are already separate booking rows — count rows directly, no extra_guest_count.
 * Floor: schedule with 0 payable rows but instructor checked in on_time → payable = 1.
 * Attribution: actual_instructor_id (substitute) takes precedence over instructor_id.
 * instructorPct = 100 − studio_payout_cut_percent (default cut 40 → instructor 60).
 */

export const DEFAULT_STUDIO_CUT_PERCENT = 40;
export const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export type PayoutWindow = "week" | "month" | "quarter" | "all";

export type PayableBasis = "all_booked" | "checked_in" | "per_class";
export const PAYABLE_BASES: PayableBasis[] = ["all_booked", "checked_in", "per_class"];
export const PAYOUT_ELIGIBLE_STATUSES = ["started", "completed"] as const;

export interface RateCard {
  rate12: number; // paise
  rate8: number;
  rate4: number;
  rate1: number;
}

/** Nullable per-instructor override columns (null → inherit global). */
export interface InstructorRateOverride {
  rate_12_paise: number | null;
  rate_8_paise: number | null;
  rate_4_paise: number | null;
  rate_1_paise: number | null;
}

export interface BookingRow {
  status: string;
  checked_in: boolean;
  cancellation_date: Date | null;
  check_in_outcome?: string | null;
}

export function isPayable(b: BookingRow, startTime: Date): boolean {
  if (b.status === "cancelled") {
    if (!b.cancellation_date) return false;
    const lead = startTime.getTime() - b.cancellation_date.getTime();
    return lead < SIX_HOURS_MS;
  }
  return true;
}

/** Per-schedule payable count for the configured basis. */
export function payableForSchedule(
  bookings: BookingRow[],
  startTime: Date,
  instructorCheckInOutcome: string | null | undefined,
  basis: PayableBasis = "all_booked",
): number {
  if (basis === "per_class") return 1;
  if (basis === "checked_in") {
    return bookings.filter(
      (b) => b.check_in_outcome === "on_time" || b.check_in_outcome === "late",
    ).length;
  }
  // all_booked (default)
  const base = bookings.filter((b) => isPayable(b, startTime)).length;
  if (base === 0 && instructorCheckInOutcome === "on_time") return 1;
  return base;
}

export function instructorPctFrom(studioCutPct: number | null | undefined): number {
  const raw =
    studioCutPct != null && Number.isFinite(Number(studioCutPct))
      ? Number(studioCutPct)
      : DEFAULT_STUDIO_CUT_PERCENT;
  return Math.max(0, Math.min(100, 100 - raw));
}

/** Resolve a rate card from instructor overrides + global defaults (per field). */
export function resolveRateCard(
  override: InstructorRateOverride | null | undefined,
  global: RateCard,
): RateCard {
  return {
    rate12: override?.rate_12_paise ?? global.rate12,
    rate8: override?.rate_8_paise ?? global.rate8,
    rate4: override?.rate_4_paise ?? global.rate4,
    rate1: override?.rate_1_paise ?? global.rate1,
  };
}

/** Per-class net rate (paise) for one tier. */
export function netPerClass(
  packageRatePaise: number,
  numClasses: number,
  gstPct: number,
  instructorPct: number,
): number {
  if (numClasses <= 0) return 0;
  const grossPerClass = packageRatePaise / numClasses;
  const exGst = grossPerClass / (1 + gstPct / 100);
  return Math.round(exGst * (instructorPct / 100));
}

/** Simple average of the four tier net rates (paise). */
export function autoBlendedRate(card: RateCard, gstPct: number, instructorPct: number): number {
  const n12 = netPerClass(card.rate12, 12, gstPct, instructorPct);
  const n8 = netPerClass(card.rate8, 8, gstPct, instructorPct);
  const n4 = netPerClass(card.rate4, 4, gstPct, instructorPct);
  const n1 = netPerClass(card.rate1, 1, gstPct, instructorPct);
  return Math.round((n12 + n8 + n4 + n1) / 4);
}

/** Per-tier net breakdown (paise) — for UI display. */
export function netRateBreakdown(card: RateCard, gstPct: number, instructorPct: number) {
  return {
    net12: netPerClass(card.rate12, 12, gstPct, instructorPct),
    net8: netPerClass(card.rate8, 8, gstPct, instructorPct),
    net4: netPerClass(card.rate4, 4, gstPct, instructorPct),
    net1: netPerClass(card.rate1, 1, gstPct, instructorPct),
  };
}

export function effectiveBlendedRate(
  overrideBlendedPaise: number | null | undefined,
  autoPaise: number,
): number {
  return overrideBlendedPaise != null && Number.isFinite(overrideBlendedPaise)
    ? overrideBlendedPaise
    : autoPaise;
}

/** Total payout (paise) = payable units × blended rate. */
export function payoutForUnits(payableUnits: number, blendedRatePaise: number): number {
  return Math.round(payableUnits * blendedRatePaise);
}

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

export function periodBoundsFor(
  window: PayoutWindow,
  ref: Date = new Date(),
): { start: Date | null; end: Date | null } {
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
  const d = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate()));
  const day = d.getUTCDay() || 7;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - (day - 1));
  const nextMonday = new Date(monday);
  nextMonday.setUTCDate(monday.getUTCDate() + 7);
  return { start: monday, end: nextMonday };
}

// ── Structured payout period model ────────────────────────────────────────────
// A period is an EXPLICIT (granularity, year, index) — not "the current month" — so it never
// drifts. A tab open across a month boundary keeps its month, which simply becomes a past
// (still-recordable) month rather than silently changing period.

export type PayoutGranularity = "month" | "quarter" | "year" | "all";

export interface PayoutPeriod {
  granularity: PayoutGranularity;
  year: number;
  index: number; // month 1-12 | quarter 1-4; ignored for year/all
}

export interface ResolvedPayoutPeriod {
  granularity: PayoutGranularity;
  key: string; // "2026-03" | "2026-Q1" | "2026" | "all"
  start: Date | null; // inclusive
  end: Date | null; // exclusive
  label: string;
}

const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function currentMonthPeriod(now: Date = new Date()): PayoutPeriod {
  return { granularity: "month", year: now.getUTCFullYear(), index: now.getUTCMonth() + 1 };
}

/** Strict structural validity. Writes reject on false; reads silently fall back to current month. */
export function isValidPayoutPeriod(period: PayoutPeriod): boolean {
  const { granularity, year, index } = period;
  if (granularity === "all") return true;
  if (!Number.isInteger(year) || year < 2000 || year > 3000) return false;
  if (granularity === "year") return true;
  if (granularity === "month") return Number.isInteger(index) && index >= 1 && index <= 12;
  if (granularity === "quarter") return Number.isInteger(index) && index >= 1 && index <= 4;
  return false;
}

/** Payment is monthly. Safe on any input, including non-strings. */
export function isAdjustableGranularity(g: unknown): boolean {
  return g === "month";
}

/**
 * Resolve an explicit period into a key + UTC bounds + display label.
 * A malformed period falls back to the current month — a bad querystring must not 500 the page.
 * `end` is exclusive throughout, matching the `lt` filter both payout endpoints apply.
 */
export function resolvePayoutPeriod(period: PayoutPeriod, now: Date = new Date()): ResolvedPayoutPeriod {
  // Fall back by REASSIGNING, not recursing: currentMonthPeriod(now) is itself "invalid" when
  // now's year sits outside [2000,3000] (an absurd but non-throwing clock), and re-entering the
  // validity gate on it would loop forever. The month branch resolves any year without throwing.
  const { granularity, year, index } = isValidPayoutPeriod(period) ? period : currentMonthPeriod(now);

  if (granularity === "all") {
    return { granularity, key: "all", start: null, end: null, label: "All time" };
  }
  if (granularity === "year") {
    return {
      granularity,
      key: `${year}`,
      start: new Date(Date.UTC(year, 0, 1)),
      end: new Date(Date.UTC(year + 1, 0, 1)),
      label: `${year}`,
    };
  }
  if (granularity === "quarter") {
    const qStartMonth = (index - 1) * 3;
    return {
      granularity,
      key: `${year}-Q${index}`,
      start: new Date(Date.UTC(year, qStartMonth, 1)),
      end: new Date(Date.UTC(year, qStartMonth + 3, 1)),
      label: `Q${index} ${year}`,
    };
  }
  // month
  return {
    granularity,
    key: `${year}-${String(index).padStart(2, "0")}`,
    start: new Date(Date.UTC(year, index - 1, 1)),
    end: new Date(Date.UTC(year, index, 1)),
    label: `${MONTH_LABELS[index - 1]} ${year}`,
  };
}

/** Querystring fragment for the payout read APIs. */
export function payoutPeriodToQuery(period: PayoutPeriod): string {
  if (period.granularity === "all") return "granularity=all";
  if (period.granularity === "year") return `granularity=year&year=${period.year}`;
  return `granularity=${period.granularity}&year=${period.year}&index=${period.index}`;
}

/**
 * Parse a query/body record into a PayoutPeriod, tolerantly. Unknown granularity or non-numeric
 * fields fall back to the current month. Reads use this directly; the WRITE path must additionally
 * reject (not silently fall back) via isValidPayoutPeriod — see the adjustment endpoint.
 */
export function parsePayoutPeriod(src: Record<string, unknown>, now: Date = new Date()): PayoutPeriod {
  const raw = String(src.granularity ?? "");
  const granularity = (["month", "quarter", "year", "all"] as const).includes(raw as PayoutGranularity)
    ? (raw as PayoutGranularity)
    : "month";
  const candidate: PayoutPeriod = {
    granularity,
    year: granularity === "all" ? now.getUTCFullYear() : Number(src.year),
    index: granularity === "month" || granularity === "quarter" ? Number(src.index) : 0,
  };
  return isValidPayoutPeriod(candidate) ? candidate : currentMonthPeriod(now);
}

/** The four preset windows plus the free-form calendar range. */
export type PayoutPeriodToken = PayoutWindow | "custom";

/** Structurally compatible with react-day-picker's DateRange; keeps this module dependency-free. */
export type DayRange = { from?: Date; to?: Date };

export interface ResolvedPeriod {
  start: Date | null;
  end: Date | null;
  /** null for a custom range — no adjustment row can exist for it. */
  periodKey: string | null;
  window: PayoutPeriodToken;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const PRESET_WINDOWS: PayoutWindow[] = ["week", "month", "quarter", "all"];

/** Parse `YYYY-MM-DD` to UTC midnight. Returns null on a malformed or non-existent date. */
function parseDayUtc(raw: string | undefined): Date | null {
  if (typeof raw !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const da = Number(m[3]);
  const d = new Date(Date.UTC(y, mo, da));
  // Rejects 2026-02-30 and friends, which Date.UTC would silently roll forward.
  if (d.getUTCFullYear() !== y || d.getUTCMonth() !== mo || d.getUTCDate() !== da) return null;
  return d;
}

/**
 * Resolve a window token (+ optional custom bounds) into schedule bounds and a period key.
 *
 * `end` is exclusive throughout, matching the `lt` filter both payout endpoints already apply,
 * so a custom `to` of 2026-05-22 yields an end of 2026-05-23T00:00Z and includes that whole day.
 *
 * A malformed, incomplete, or reversed custom range falls back to `month`: a bad querystring
 * must not 500 the payout page.
 */
export function resolvePeriod(
  windowRaw: string,
  fromRaw?: string,
  toRaw?: string,
  ref: Date = new Date(),
): ResolvedPeriod {
  if (windowRaw === "custom") {
    const from = parseDayUtc(fromRaw);
    const to = parseDayUtc(toRaw);
    if (from && to && from <= to) {
      return {
        start: from,
        end: new Date(to.getTime() + DAY_MS),
        periodKey: null,
        window: "custom",
      };
    }
    return resolvePeriod("month", undefined, undefined, ref);
  }

  const w: PayoutWindow = PRESET_WINDOWS.includes(windowRaw as PayoutWindow)
    ? (windowRaw as PayoutWindow)
    : "month";
  const { start, end } = periodBoundsFor(w, ref);
  return { start, end, periodKey: periodKeyFor(w, ref), window: w };
}

/**
 * A preset window as an inclusive calendar range, for seeding the date picker.
 * `to` is the last INCLUDED day (bounds.end minus one day), because a calendar
 * highlights days, not half-open intervals. `all` has no bounds.
 */
export function presetRange(window: PayoutWindow, ref: Date = new Date()): DayRange {
  const { start, end } = periodBoundsFor(window, ref);
  if (!start || !end) return {};
  return { from: start, to: new Date(end.getTime() - DAY_MS) };
}

/**
 * Inverse of `presetRange`. Lets one control serve both roles: the picker's presets are
 * generated from `presetRange`, so a preset click round-trips back to its token exactly,
 * while a hand-drawn calendar range falls through to `custom`.
 */
export function windowFromRange(
  range: DayRange | undefined,
  ref: Date = new Date(),
): PayoutPeriodToken {
  if (!range?.from) return "all";
  if (!range.to) return "custom";
  for (const w of ["week", "month", "quarter"] as const) {
    const p = presetRange(w, ref);
    if (p.from?.getTime() === range.from.getTime() && p.to?.getTime() === range.to.getTime()) {
      return w;
    }
  }
  return "custom";
}

/**
 * Payout *payment* is a monthly accounting act. Adjustment rows are keyed
 * `@@unique([instructor_id, period_key])`, and only a month key is allowed to be written:
 * any other window would let one instructor be "paid" for May and "pending" for an
 * overlapping range covering the same classes, and could double-write the expense row.
 */
export function isAdjustableWindow(raw: unknown): boolean {
  return raw === "month";
}

function isoWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week: weekNo };
}
