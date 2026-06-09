import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { SelectOption } from "./types";

export function FilterSelect({
  value,
  onChange,
  options,
  placeholder = "All",
  className,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange} activityLabel={ariaLabel}>
      <SelectTrigger
        aria-label={ariaLabel ?? placeholder}
        className={cn(
          "h-9 w-full sm:w-[180px] border-sage/20 bg-white-warm font-body text-sm text-charcoal/80",
          "focus:ring-sage/30 data-[placeholder]:text-charcoal/40",
          className,
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="border-sage/20 font-body">
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
