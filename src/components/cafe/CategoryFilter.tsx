import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CAFE_CATEGORIES } from "./types";

interface CategoryFilterProps {
  selected: string;
  onSelect: (id: string) => void;
  search: string;
  onSearch: (value: string) => void;
  /** Optional counts keyed by category id (shown as a small number on the pill). */
  counts?: Record<string, number>;
  className?: string;
}

/**
 * Café category pills + search. Sage owns the active pill (the action/selection
 * voice); inactive pills are sand-on-warm-border. Replaces the gated
 * shadcn-space `product-category-01` block, re-skinned to DESIGN.md.
 */
export function CategoryFilter({
  selected,
  onSelect,
  search,
  onSearch,
  counts,
  className,
}: CategoryFilterProps) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-charcoal/40" />
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search the menu…"
          className="h-11 rounded-full border-border bg-white-warm pl-10 font-body"
          aria-label="Search menu"
        />
      </div>
      <div className="flex gap-2.5 overflow-x-auto pb-1">
        {CAFE_CATEGORIES.map((cat) => {
          const active = selected === cat.id;
          const count = counts?.[cat.id];
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelect(cat.id)}
              aria-pressed={active}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap rounded-full px-5 py-2 font-body text-sm transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-sage",
                active
                  ? "bg-sage text-white-warm"
                  : "border border-border bg-white-warm text-charcoal hover:bg-sand/50",
              )}
            >
              {cat.label}
              {typeof count === "number" ? (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[0.7rem]",
                    active ? "bg-white-warm/20" : "bg-sand text-charcoal/60",
                  )}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default CategoryFilter;
