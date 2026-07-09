import { useState } from "react";
import {
  format,
  startOfDay,
  subDays,
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfYear,
} from "date-fns";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarDays, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { FILTER_TRIGGER, FILTER_ICON } from "./styles";

export type FilterPreset = { label: string; range: DateRange };

// Default quick-range presets (right column). Each returns a {from,to} range; the order
// here is the order shown. "All time" clears the filter. Callers with a different
// vocabulary (e.g. payout periods) pass their own via the `presets` prop.
function buildDefaultPresets(): FilterPreset[] {
  const today = startOfDay(new Date());
  return [
    { label: "Today", range: { from: today, to: today } },
    { label: "Last 7 days", range: { from: subDays(today, 6), to: today } },
    { label: "Last 30 days", range: { from: subDays(today, 29), to: today } },
    { label: "This month", range: { from: startOfMonth(today), to: today } },
    {
      label: "Last month",
      range: {
        from: startOfMonth(subMonths(today, 1)),
        to: endOfMonth(subMonths(today, 1)),
      },
    },
    { label: "This year", range: { from: startOfYear(today), to: today } },
  ];
}

// Date-range filter: shadcn Calendar (range mode) + quick-range presets, in one
// Popover. Pick two dates on the calendar OR tap a preset; "All time" clears.
// Single source of truth for every date-range filter (finance, activity, CRM).
export function FilterDateRange({
  value,
  onChange,
  placeholder = "All time",
  className,
  defaultOpen = false,
  icon: Icon = CalendarDays,
  presets,
  allTimeLabel = "All time",
}: {
  value: DateRange | undefined;
  onChange: (v: DateRange | undefined) => void;
  placeholder?: string;
  className?: string;
  defaultOpen?: boolean;
  icon?: LucideIcon;
  presets?: FilterPreset[];
  allTimeLabel?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const resolvedPresets = presets ?? buildDefaultPresets();
  const active = !!value?.from;
  const label = value?.from
    ? value.to
      ? `${format(value.from, "d MMM")} – ${format(value.to, "d MMM yyyy")}`
      : format(value.from, "d MMM yyyy")
    : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            FILTER_TRIGGER,
            "justify-start",
            !active && "text-charcoal/50",
            className,
          )}
        >
          <Icon className={FILTER_ICON} aria-hidden />
          <span className="truncate">{label}</span>
          {active && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear date range"
              onClick={(e) => {
                e.stopPropagation();
                onChange(undefined);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange(undefined);
                }
              }}
              className="ml-auto -mr-1 rounded p-0.5 hover:bg-sage/10"
            >
              <X className="h-3.5 w-3.5 text-charcoal/50" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0 border-sage/20 bg-popover">
        {/* Live readout of the in-progress selection so range picking doesn't
            feel abrupt — start fills first, then end. */}
        <div className="flex items-center gap-2 border-b border-sage/10 p-2.5 font-body text-xs">
          <span
            className={cn(
              "flex-1 rounded-md border px-2.5 py-1.5 transition-colors duration-200",
              value?.from
                ? "border-sage/30 bg-sage/10 text-charcoal"
                : "border-dashed border-sage/30 text-charcoal/40",
            )}
          >
            <span className="block text-[10px] uppercase tracking-wide text-charcoal/40">Start</span>
            {value?.from ? format(value.from, "d MMM yyyy") : "Select start"}
          </span>
          <span className="text-charcoal/30">→</span>
          <span
            className={cn(
              "flex-1 rounded-md border px-2.5 py-1.5 transition-colors duration-200",
              value?.to
                ? "border-sage/30 bg-sage/10 text-charcoal"
                : "border-dashed border-sage/30 text-charcoal/40",
            )}
          >
            <span className="block text-[10px] uppercase tracking-wide text-charcoal/40">End</span>
            {value?.to ? format(value.to, "d MMM yyyy") : "Select end"}
          </span>
        </div>
        <div className="flex flex-col sm:flex-row">
          <Calendar
            mode="range"
            selected={value}
            onSelect={onChange}
            numberOfMonths={1}
            defaultMonth={value?.from}
            autoFocus
            className="font-body"
          />
          <div className="flex flex-row flex-wrap gap-1 border-t border-sage/10 p-2 sm:w-40 sm:flex-col sm:flex-nowrap sm:border-t-0 sm:border-l">
            {resolvedPresets.map((p) => (
              <Button
                key={p.label}
                variant="ghost"
                size="sm"
                className="font-body justify-start text-charcoal/80 hover:bg-sage/10 hover:text-sage! flex-1 sm:flex-none"
                onClick={() => {
                  onChange(p.range);
                  setOpen(false);
                }}
              >
                {p.label}
              </Button>
            ))}
            <div className="flex gap-1 sm:mt-auto sm:flex-col">
              <Button
                variant="ghost"
                size="sm"
                className="font-body justify-start text-charcoal/50 hover:bg-sage/10 hover:text-sage! flex-1 sm:flex-none"
                onClick={() => {
                  onChange(undefined);
                  setOpen(false);
                }}
              >
                {allTimeLabel}
              </Button>
              <Button
                variant="sage"
                size="sm"
                disabled={!value?.from}
                className="font-body flex-1 sm:flex-none"
                onClick={() => setOpen(false)}
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
