import { cn } from "@/lib/utils";

export type FilterPillOption<T extends string> = {
  value: T;
  label: string;
  /** Optional count shown after the label, e.g. "Issues (3)". */
  count?: number;
};

/**
 * Segmented pill-chip filter — the count-chip idiom used for at-a-glance filters
 * (e.g. reconcile match groups, view toggles). Single source of truth so every
 * chip row looks/behaves the same. For dropdown-style filters use FilterSelect.
 */
export function FilterPills<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: FilterPillOption<T>[];
  size?: "sm" | "md";
  className?: string;
}) {
  const pad = size === "sm" ? "px-3 py-1" : "px-4 py-1.5";
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={cn(
              "rounded-full border font-body text-xs transition-colors",
              pad,
              active
                ? "border-sage bg-sage text-cream"
                : "border-sage/25 bg-white-warm text-charcoal/60 hover:bg-sage/5",
            )}
          >
            {opt.label}
            {opt.count != null && ` (${opt.count})`}
          </button>
        );
      })}
    </div>
  );
}
