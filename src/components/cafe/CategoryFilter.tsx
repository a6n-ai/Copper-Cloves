import { cn } from "@/lib/utils";
import { FilterSearch, FilterChips } from "@/components/filters";
import type { ChipOption } from "@/components/filters";
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
 * voice); inactive pills are sand-on-warm-border.
 */
export function CategoryFilter({
  selected,
  onSelect,
  search,
  onSearch,
  counts,
  className,
}: CategoryFilterProps) {
  const options: ChipOption[] = CAFE_CATEGORIES.map((cat) => ({
    value: cat.id,
    label: cat.label,
    count: counts?.[cat.id],
  }));

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <FilterSearch
        value={search}
        onChange={onSearch}
        placeholder="Search the menu…"
        aria-label="Search menu"
        className="max-w-md"
      />
      <FilterChips
        value={selected}
        onChange={onSelect}
        options={options}
        aria-label="Filter by category"
      />
    </div>
  );
}

export default CategoryFilter;
