import { useState } from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarDays, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Date-range filter built on our shadcn Calendar (range mode) + Popover so it
// inherits the brand palette — selected day = sage (--primary), range/today =
// terracotta (--accent). Used by the activity log and CRM message log.
export function FilterDateRange({
  value,
  onChange,
  placeholder = "All time",
  className,
}: {
  value: DateRange | undefined;
  onChange: (v: DateRange | undefined) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
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
            "h-9 w-full justify-start font-body font-normal border-sage/20 text-charcoal/80",
            !active && "text-charcoal/50",
            className,
          )}
        >
          <CalendarDays className="mr-2 h-4 w-4 text-charcoal/40 shrink-0" />
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
      <PopoverContent align="start" className="w-auto p-0 border-sage/20 bg-white-warm">
        <Calendar
          mode="range"
          selected={value}
          onSelect={onChange}
          numberOfMonths={1}
          defaultMonth={value?.from}
          initialFocus
          className="font-body"
        />
        <div className="flex justify-end gap-2 border-t border-sage/10 p-2">
          <Button variant="ghost" size="sm" className="font-body" onClick={() => onChange(undefined)}>
            Clear
          </Button>
          <Button variant="sage" size="sm" className="font-body" onClick={() => setOpen(false)}>
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
