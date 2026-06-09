import { format, parse, isValid } from "date-fns";
import { CalendarIcon, type LucideIcon } from "lucide-react";
import { useState } from "react";
import type { Matcher } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FILTER_TRIGGER } from "./styles";

// Drop-in replacement for native <input type="date">: same string contract
// (value/onChange are "yyyy-MM-dd"), but renders the brand sage Calendar in a
// Popover instead of the browser's default date control.
export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  className,
  id,
  disabled,
  min,
  max,
  icon: Icon = CalendarIcon,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
  /** Earliest selectable day, "yyyy-MM-dd". */
  min?: string;
  /** Latest selectable day, "yyyy-MM-dd". */
  max?: string;
  icon?: LucideIcon;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;
  const valid = selected && isValid(selected) ? selected : undefined;
  const minDate = min ? parse(min, "yyyy-MM-dd", new Date()) : undefined;
  const maxDate = max ? parse(max, "yyyy-MM-dd", new Date()) : undefined;
  const disabledDays: Matcher[] = [];
  if (minDate && isValid(minDate)) disabledDays.push({ before: minDate });
  if (maxDate && isValid(maxDate)) disabledDays.push({ after: maxDate });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            FILTER_TRIGGER,
            "justify-start",
            !valid && "text-charcoal/40",
            className,
          )}
        >
          <Icon className="mr-2 h-4 w-4 text-charcoal/40 shrink-0" aria-hidden />
          <span className="truncate">{valid ? format(valid, "d MMM yyyy") : placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0 border-sage/20 bg-popover">
        <Calendar
          mode="single"
          selected={valid}
          onSelect={(d) => {
            onChange(d ? format(d, "yyyy-MM-dd") : "");
            setOpen(false);
          }}
          defaultMonth={valid ?? maxDate}
          disabled={disabledDays.length ? disabledDays : undefined}
          {...(minDate || maxDate
            ? {
                captionLayout: "dropdown" as const,
                startMonth: minDate ?? new Date(1940, 0),
                endMonth: maxDate ?? new Date(2035, 11),
              }
            : {})}
          autoFocus
          className="font-body"
        />
      </PopoverContent>
    </Popover>
  );
}
