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
}

export function isPayable(b: BookingRow, startTime: Date): boolean {
  if (b.status === "cancelled") {
    if (!b.cancellation_date) return false;
    const lead = startTime.getTime() - b.cancellation_date.getTime();
    return lead < SIX_HOURS_MS;
  }
  return true;
}

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

function isoWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week: weekNo };
}
