import { FilterSelect } from "@/components/filters";
import type { SelectOption } from "@/components/filters";

export function CategoryFilter({
  categories,
  value,
  onChange,
}: {
  categories: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const options: SelectOption[] = [
    { value: "all", label: "All categories" },
    ...categories.map((c) => ({ value: c, label: c })),
  ];
  return (
    <div data-testid="category-filter" className="flex justify-center">
      <FilterSelect
        value={value}
        onChange={onChange}
        options={options}
        ariaLabel="Filter by category"
        placeholder="All categories"
      />
    </div>
  );
}
