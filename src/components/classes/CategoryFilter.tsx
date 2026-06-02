export function CategoryFilter({
  categories,
  value,
  onChange,
}: {
  categories: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const options = ["all", ...categories];
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            aria-pressed={active}
            className={`rounded-full border px-4 py-1.5 font-body text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sage ${
              active
                ? "border-[#d8d3c4] bg-sand font-medium text-charcoal"
                : "border-[#e5e4dc] bg-white-warm text-charcoal/60 hover:bg-cream"
            }`}
          >
            {opt === "all" ? "All" : opt}
          </button>
        );
      })}
    </div>
  );
}
