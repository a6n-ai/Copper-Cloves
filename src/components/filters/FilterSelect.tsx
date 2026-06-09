import { ListFilter, type LucideIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { FILTER_TRIGGER } from "./styles";
import type { SelectOption } from "./types";

export function FilterSelect({
  value,
  onChange,
  options,
  placeholder = "All",
  className,
  ariaLabel,
  icon: Icon = ListFilter,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  icon?: LucideIcon;
}) {
  return (
    <Select value={value} onValueChange={onChange} activityLabel={ariaLabel}>
      <SelectTrigger
        aria-label={ariaLabel ?? placeholder}
        className={cn(FILTER_TRIGGER, "text-sm data-[placeholder]:text-charcoal/40", className)}
      >
        {Icon && <Icon className="mr-2 h-4 w-4 shrink-0 text-charcoal/40" aria-hidden />}
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
