import { useEffect, useState } from "react";
import { format, startOfDay, subDays } from "date-fns";
import type { DateRange } from "react-day-picker";

const DAY = "yyyy-MM-dd";
const RANGE_SETTLE_MS = 400;

function defaultRange(): DateRange {
  const today = startOfDay(new Date());
  return { from: subDays(today, 29), to: today };
}

function sameDay(a: Date | undefined, b: Date | undefined): boolean {
  return !!a && !!b && format(a, DAY) === format(b, DAY);
}

/** Date-range state for a report tab: defaults to the last 30 days, and clearing returns there. */
export function useReportRange() {
  // The picker reports a complete one-day range on the first click, so `picked`
  // (drives the filter button) updates at once while `applied` (drives the fetch)
  // only follows after the selection has been stable for RANGE_SETTLE_MS.
  const [picked, setPicked] = useState<DateRange | undefined>(defaultRange);
  const [applied, setApplied] = useState<DateRange>(defaultRange);

  useEffect(() => {
    if (!picked?.from || !picked.to) return;
    const { from: f, to: t } = picked;
    const timer = setTimeout(() => setApplied({ from: f, to: t }), RANGE_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [picked]);

  const onRangeChange = (next: DateRange | undefined) => {
    if (!next?.from) {
      const reset = defaultRange();
      setPicked(reset);
      setApplied(reset);
      return;
    }
    setPicked(next);
  };

  // At the default the filter gets no value, so it reads "Last 30 days" and offers no
  // clear control: clearing a range that is already the default would do nothing.
  const base = defaultRange();
  const isDefault = sameDay(picked?.from, base.from) && sameDay(picked?.to, base.to);

  return {
    picked,
    onRangeChange,
    from: format(applied.from as Date, DAY),
    to: format(applied.to as Date, DAY),
    isDefault,
  };
}
