import { CalendarDays } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { FilterDateRange, type FilterPreset } from "@/components/filters";
import { presetRange, windowFromRange, type PayoutPeriodToken } from "@/lib/payoutCalc";

/**
 * The four payout windows as calendar ranges. Generated from `presetRange`, which is the
 * inverse of `windowFromRange` — so clicking a preset round-trips back to its token exactly,
 * while a hand-drawn calendar range falls through to "custom".
 *
 * "All time" is the picker's built-in clear action (range === undefined), not a listed preset.
 */
export function payoutPresets(ref: Date = new Date()): FilterPreset[] {
  return [
    { label: "This week", range: presetRange("week", ref) as DateRange },
    { label: "This month", range: presetRange("month", ref) as DateRange },
    { label: "This quarter", range: presetRange("quarter", ref) as DateRange },
  ];
}

/**
 * Both payout surfaces open on the current month — the one window that permits payment recording.
 *
 * ponytail: evaluated once at import, while windowFromRange resolves "this month" at call time.
 * A tab left open across a month boundary therefore degrades month -> custom, hiding mark-paid
 * until reload. That is deliberate and fail-safe: the server keys adjustments on
 * periodKeyFor("month", now), so a stale tab that still offered mark-paid would write the
 * displayed month's numbers into the NEW month's period_key. Degrading to custom trips the
 * isAdjustableWindow guard instead. Upgrade path if this ever bites: recompute on window focus —
 * never by matching the range against the month containing range.from, which re-opens the write.
 */
export const DEFAULT_PAYOUT_RANGE = presetRange("month") as DateRange;

/**
 * ponytail: formats from LOCAL date parts while the server parses as UTC midnight.
 * Correct for IST (+5:30), where the local and UTC calendar dates coincide and studio
 * classes run 06:30–20:00 IST = 01:00–14:30 UTC, i.e. the same UTC day. A studio in a
 * negative-offset timezone would need these serialised from UTC parts instead.
 */
function toDayParam(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Querystring fragment for the payout read APIs. */
export function payoutPeriodQuery(range: DateRange | undefined, ref: Date = new Date()): string {
  const token: PayoutPeriodToken = windowFromRange(range, ref);
  if (token !== "custom") return `window=${token}`;
  // windowFromRange only returns "custom" when `from` is set; `to` may still be pending.
  if (!range?.from || !range.to) return "window=month";
  return `window=custom&from=${toDayParam(range.from)}&to=${toDayParam(range.to)}`;
}

export function PayoutPeriodPicker({
  value,
  onChange,
  className,
}: {
  value: DateRange | undefined;
  onChange: (v: DateRange | undefined) => void;
  className?: string;
}) {
  return (
    <FilterDateRange
      value={value}
      onChange={onChange}
      presets={payoutPresets()}
      allTimeLabel="All time"
      placeholder="All time"
      icon={CalendarDays}
      className={className}
    />
  );
}

export default PayoutPeriodPicker;
