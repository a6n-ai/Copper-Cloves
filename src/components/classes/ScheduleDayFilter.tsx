type ScheduleDayOption = { index: number; day: string; date: string; count: number };

export function ScheduleDayFilter({
  days,
  value,
  todayIndex,
  onChange,
}: {
  days: ScheduleDayOption[];
  value: number | "all";
  todayIndex: number | null;
  onChange: (v: number | "all") => void;
}) {
  const chip = (active: boolean) =>
    `relative flex items-center gap-2 rounded-full border px-4 py-2 font-body text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sage ${
      active
        ? "border-[#d8d3c4] bg-sand font-medium text-charcoal"
        : "border-[#e5e4dc] bg-white-warm text-charcoal/60 hover:bg-cream"
    }`;
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onChange("all")}
        aria-pressed={value === "all"}
        className={chip(value === "all")}
      >
        All week
      </button>
      {days.map((d) => {
        const active = value === d.index;
        return (
          <button
            key={d.index}
            type="button"
            onClick={() => onChange(d.index)}
            aria-pressed={active}
            className={chip(active)}
          >
            <span className="flex flex-col items-start leading-tight">
              <span className="flex items-center gap-1.5">
                {d.day.slice(0, 3)}
                {todayIndex === d.index && (
                  <span className="size-1.5 rounded-full bg-sage" aria-label="Today" />
                )}
              </span>
              <span className="text-[11px] text-charcoal/45">{d.date}</span>
            </span>
            {d.count > 0 ? (
              <span
                className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  active ? "bg-sage text-white-warm" : "bg-sage/15 text-sage"
                }`}
              >
                {d.count}
              </span>
            ) : (
              <span className="ml-1 rounded-full bg-charcoal/5 px-1.5 py-0.5 text-[10px] font-semibold text-charcoal/35">0</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
