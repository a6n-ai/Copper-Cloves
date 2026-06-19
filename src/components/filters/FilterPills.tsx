import { cn } from "@/lib/utils";
import { pillVariants } from "@/components/ui/pill";

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
              // Use the canonical `Pill` styles (same cva) so chips are visually
              // identical to status pills. Inactive = neutral soft; active = solid sage.
              pillVariants({ tone: "neutral", size, appearance: active ? "solid" : "soft" }),
              "cursor-pointer font-body",
              active && "bg-sage text-cream",
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
