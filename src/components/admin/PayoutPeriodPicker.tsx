import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  resolvePayoutPeriod,
  type PayoutGranularity,
  type PayoutPeriod,
} from "@/lib/payoutCalc";

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const GRANULARITIES: { value: PayoutGranularity; label: string }[] = [
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "Year" },
  { value: "all", label: "All time" },
];

export function PayoutPeriodPicker({
  value,
  onChange,
  allowAllTime = true,
  className,
}: {
  value: PayoutPeriod;
  onChange: (p: PayoutPeriod) => void;
  allowAllTime?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const label = resolvePayoutPeriod(value).label;
  const grains = allowAllTime ? GRANULARITIES : GRANULARITIES.filter((g) => g.value !== "all");

  const setGranularity = (g: PayoutGranularity) => {
    // Preserve year; default index to a sensible in-range value for the new granularity.
    const index = g === "month" ? Math.min(Math.max(value.index || 1, 1), 12)
      : g === "quarter" ? Math.min(Math.max(value.index || 1, 1), 4)
      : 0;
    onChange({ granularity: g, year: value.year, index });
  };

  // Clamp to isValidPayoutPeriod's window. Without this, stepping past the bounds leaves the
  // stepper showing e.g. 1999 while resolvePayoutPeriod rejects it and the trigger label silently
  // falls back to the current month — stepper and label would disagree and mislead the admin.
  const stepYear = (delta: number) =>
    onChange({ ...value, year: Math.min(3000, Math.max(2000, value.year + delta)) });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("justify-start border-sage/20 font-body text-charcoal", className)}
        >
          <CalendarDays className="h-4 w-4 mr-2 text-sage" aria-hidden />
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-3 border-sage/20 bg-popover space-y-3">
        {/* granularity segmented control */}
        <div className="flex flex-wrap gap-1">
          {grains.map((g) => (
            <Button
              key={g.value}
              type="button"
              size="sm"
              variant={value.granularity === g.value ? "sage" : "ghost"}
              className="font-body text-xs"
              onClick={() => setGranularity(g.value)}
            >
              {g.label}
            </Button>
          ))}
        </div>

        {/* year stepper (month/quarter/year only) */}
        {value.granularity !== "all" && (
          <div className="flex items-center justify-between gap-2 font-body text-sm text-charcoal">
            <Button type="button" size="sm" variant="ghost" onClick={() => stepYear(-1)} disabled={value.year <= 2000} aria-label="Previous year">‹</Button>
            <span className="tabular-nums font-medium">{value.year}</span>
            <Button type="button" size="sm" variant="ghost" onClick={() => stepYear(1)} disabled={value.year >= 3000} aria-label="Next year">›</Button>
          </div>
        )}

        {/* month grid */}
        {value.granularity === "month" && (
          <div className="grid grid-cols-3 gap-1">
            {MONTHS_SHORT.map((m, i) => (
              <Button
                key={m}
                type="button"
                size="sm"
                variant={value.index === i + 1 ? "sage" : "ghost"}
                className="font-body text-xs"
                onClick={() => { onChange({ granularity: "month", year: value.year, index: i + 1 }); setOpen(false); }}
              >
                {m}
              </Button>
            ))}
          </div>
        )}

        {/* quarter buttons */}
        {value.granularity === "quarter" && (
          <div className="grid grid-cols-4 gap-1">
            {[1, 2, 3, 4].map((q) => (
              <Button
                key={q}
                type="button"
                size="sm"
                variant={value.index === q ? "sage" : "ghost"}
                className="font-body text-xs"
                onClick={() => { onChange({ granularity: "quarter", year: value.year, index: q }); setOpen(false); }}
              >
                Q{q}
              </Button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default PayoutPeriodPicker;
