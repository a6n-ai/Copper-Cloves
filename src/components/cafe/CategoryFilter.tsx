import { cn } from "@/lib/utils";
import { FilterSearch, FilterSelect } from "@/components/filters";
import type { SelectOption } from "@/components/filters";
import { CAFE_CATEGORIES } from "./types";

interface CategoryFilterProps {
  selected: string;
  onSelect: (id: string) => void;
  search: string;
  onSearch: (value: string) => void;
  /** Optional counts keyed by category id (folded into the option label). */
  counts?: Record<string, number>;
  className?: string;
}

/**
 * Café category dropdown + search. One dropdown idiom for category selection —
 * no chip/pill rows.
 */
export function CategoryFilter({
  selected,
  onSelect,
  search,
  onSearch,
  counts,
  className,
}: CategoryFilterProps) {
  const options: SelectOption[] = CAFE_CATEGORIES.map((cat) => {
    const count = counts?.[cat.id];
    return {
      value: cat.id,
      label: count != null ? `${cat.label} (${count})` : cat.label,
    };
  });

  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-center", className)}>
      <FilterSearch
        value={search}
        onChange={onSearch}
        placeholder="Search the menu…"
        aria-label="Search menu"
        className="max-w-md"
      />
      <FilterSelect
        value={selected}
        onChange={onSelect}
        options={options}
        ariaLabel="Filter by category"
        placeholder="All categories"
      />
    </div>
  );
}

export default CategoryFilter;
