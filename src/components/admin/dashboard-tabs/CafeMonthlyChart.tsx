import { memo, useMemo } from "react";
import { useReducedMotion } from "framer-motion";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { MonthRow } from "@/lib/cafeReport";

const SERIES = {
  online: { label: "Online", color: "color-mix(in srgb, var(--color-sage) 50%, var(--color-charcoal))" },
  credit: { label: "Food credit", color: "color-mix(in srgb, var(--color-sage) 55%, var(--color-cream))" },
  counter: { label: "Counter", color: "var(--color-terracotta)" },
};
const TICK = { fontSize: 11, fill: "var(--color-muted-foreground)" };
const monthFmt = new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "UTC" });
const monthLongFmt = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

const monthDate = (m: string) => new Date(`${m}-01T00:00:00Z`);
const compact = (v: number) => (v >= 100000 ? `${+(v / 100000).toFixed(1)}L` : v >= 1000 ? `${+(v / 1000).toFixed(1)}k` : String(v));

function CafeMonthlyChartImpl({ monthly }: Readonly<{ monthly: MonthRow[] }>) {
  const animate = !useReducedMotion();
  const data = useMemo(
    () =>
      monthly.map((m) => ({
        month: m.month,
        label: monthFmt.format(monthDate(m.month)),
        online: m.online / 100,
        credit: m.credit / 100,
        counter: m.counter / 100,
      })),
    [monthly],
  );
  const summary = useMemo(() => {
    const total = (m: MonthRow) => m.online + m.credit + m.counter;
    const best = monthly.reduce((a, b) => (total(b) > total(a) ? b : a), monthly[0]);
    return best ? `Best month: ${monthLongFmt.format(monthDate(best.month))}, ${inr.format(total(best) / 100)}.` : "";
  }, [monthly]);

  return (
    <div className="space-y-3">
      <p className="sr-only">{summary}</p>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 font-body text-xs text-charcoal/70">
        {Object.values(SERIES).map((s) => (
          <li key={s.label} className="flex items-center gap-1.5">
            {/* Series colours come from the SERIES map, so they are set inline rather than as utilities. */}
            <span aria-hidden className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: s.color }} />
            {s.label}
          </li>
        ))}
      </ul>
      <ChartContainer config={SERIES} className="h-[240px] w-full">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={TICK} tickMargin={8} interval={0} />
          <YAxis width={44} tickLine={false} axisLine={false} tick={TICK} tickFormatter={compact} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_l: unknown, items: ReadonlyArray<{ payload?: { month?: string } }>) =>
                  items[0]?.payload?.month ? monthLongFmt.format(monthDate(items[0].payload.month)) : ""
                }
              />
            }
          />
          <Bar dataKey="online" stackId="m" fill={SERIES.online.color} maxBarSize={32} isAnimationActive={animate} animationDuration={300} />
          <Bar dataKey="credit" stackId="m" fill={SERIES.credit.color} maxBarSize={32} isAnimationActive={animate} animationDuration={300} />
          <Bar dataKey="counter" stackId="m" fill={SERIES.counter.color} radius={[4, 4, 0, 0]} maxBarSize={32} isAnimationActive={animate} animationDuration={300} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}

export const CafeMonthlyChart = memo(CafeMonthlyChartImpl);
