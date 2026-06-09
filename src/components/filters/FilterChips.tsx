import { cn } from "@/lib/utils";
import type { ChipOption } from "./types";

export function FilterChips({
  value,
  onChange,
  options,
  className,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: ChipOption[];
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel ?? "Filter"}
      className={cn("flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 font-body text-xs font-medium",
              "transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sage/40",
              active
                ? "bg-sage text-cream"
                : "bg-sand text-charcoal/70 hover:bg-sand/60 hover:text-charcoal",
            )}
          >
            {opt.label}
            {opt.count != null && (
              <span className={cn("text-[11px]", active ? "text-cream/80" : "text-charcoal/40")}>
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
