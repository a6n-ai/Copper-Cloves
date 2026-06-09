import { FilterChips } from "@/components/filters";
import type { ChipOption } from "@/components/filters";

export function CategoryFilter({
  categories,
  value,
  onChange,
}: {
  categories: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const options: ChipOption[] = [
    { value: "all", label: "All" },
    ...categories.map((c) => ({ value: c, label: c })),
  ];
  return (
    <div data-testid="category-filter" className="flex flex-wrap justify-center">
      <FilterChips
        value={value}
        onChange={onChange}
        options={options}
        aria-label="Filter by category"
      />
    </div>
  );
}
