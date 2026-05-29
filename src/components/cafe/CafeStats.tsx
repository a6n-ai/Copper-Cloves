import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { CalendarDays, IndianRupee, Clock, ShoppingBag, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

/** Loose shape — matches the rows `/api/cafe/orders` returns. */
interface CafeStatsOrder {
  status: string;
  quantity: number;
  order_date: string;
  cafe_item?: { id?: string; name?: string; price?: number | string | null } | null;
}

interface CafeStatsProps {
  /** All orders (active + history) for accurate revenue + best-seller math. */
  orders: CafeStatsOrder[];
  className?: string;
}

const CANCELLED = "cancelled";

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const lineTotal = (o: CafeStatsOrder) => Number(o.cafe_item?.price ?? 0) * o.quantity;

const rupees = (paiseLess: number) =>
  `₹${Math.round(paiseLess).toLocaleString("en-IN")}`;

interface Kpi {
  title: string;
  value: string;
  hint: string;
  icon: LucideIcon;
}

function KpiCard({ kpi, index = 0 }: { kpi: Kpi; index?: number }) {
  return (
    <Card
      style={{ animationDelay: `${index * 70}ms` }}
      className="rounded-2xl border border-border bg-white-warm p-0 shadow-none ring-0 duration-500 fade-in-0 slide-in-from-bottom-3 fill-mode-both animate-in"
    >
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="flex flex-col gap-1">
          <p className="font-body text-xs font-medium uppercase tracking-[0.06em] text-charcoal/55">
            {kpi.title}
          </p>
          <p className="font-display text-3xl leading-none text-charcoal">{kpi.value}</p>
          <p className="font-body text-xs text-charcoal/50">{kpi.hint}</p>
        </div>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-terracotta/10 text-terracotta">
          <kpi.icon size={18} />
        </span>
      </CardContent>
    </Card>
  );
}

const chartConfig = {
  revenue: { label: "Revenue", color: "var(--color-terracotta)" },
} satisfies ChartConfig;

/**
 * Admin café Overview — re-skin of shadcn-space statistics-01 / widget-01 /
 * chart-01 to DESIGN.md. Terracotta leads (café accent); KPIs sit on white-warm
 * cards, flat at rest. Every number is computed client-side from the orders the
 * page already polls — no new endpoint, nothing fabricated.
 */
export function CafeStats({ orders, className }: CafeStatsProps) {
  const { kpis, bestSellers, chartData } = useMemo(() => {
    const now = new Date();
    const live = orders.filter((o) => o.status !== CANCELLED);
    const todays = live.filter((o) => isSameDay(new Date(o.order_date), now));

    const revenueToday = todays.reduce((sum, o) => sum + lineTotal(o), 0);
    const pending = orders.filter((o) => o.status === "pending").length;
    const avgValue = todays.length ? revenueToday / todays.length : 0;

    const kpiList: Kpi[] = [
      {
        title: "Orders today",
        value: String(todays.length),
        hint: "placed since midnight",
        icon: CalendarDays,
      },
      {
        title: "Revenue today",
        value: rupees(revenueToday),
        hint: "excludes cancelled",
        icon: IndianRupee,
      },
      {
        title: "Pending",
        value: String(pending),
        hint: "awaiting prep",
        icon: Clock,
      },
      {
        title: "Avg order value",
        value: rupees(avgValue),
        hint: "today",
        icon: ShoppingBag,
      },
    ];

    // Best-sellers: total quantity per item across all non-cancelled orders.
    const tally = new Map<string, { name: string; qty: number }>();
    for (const o of live) {
      const name = o.cafe_item?.name;
      if (!name) continue;
      const key = o.cafe_item?.id ?? name;
      const row = tally.get(key) ?? { name, qty: 0 };
      row.qty += o.quantity;
      tally.set(key, row);
    }
    const best = [...tally.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);
    const maxQty = best[0]?.qty ?? 1;

    // Sales over the last 7 days (revenue per day), oldest → newest.
    const days: { day: string; revenue: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const revenue = live
        .filter((o) => isSameDay(new Date(o.order_date), d))
        .reduce((sum, o) => sum + lineTotal(o), 0);
      days.push({
        day: d.toLocaleDateString("en-US", { weekday: "short" }),
        revenue,
      });
    }

    return {
      kpis: kpiList,
      bestSellers: best.map((b) => ({ ...b, pct: Math.round((b.qty / maxQty) * 100) })),
      chartData: days,
    };
  }, [orders]);

  return (
    <div className={cn("space-y-6", className)}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, i) => (
          <KpiCard key={kpi.title} kpi={kpi} index={i} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Sales chart */}
        <Card className="rounded-2xl border border-border bg-white-warm p-0 shadow-none ring-0 lg:col-span-3">
          <CardHeader className="px-6 pt-6 pb-0">
            <CardTitle className="font-display text-xl text-charcoal">
              Café sales · last 7 days
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-4 sm:px-6">
            <ChartContainer config={chartConfig} className="h-[260px] w-full">
              <BarChart accessibilityLayer data={chartData} margin={{ left: -16, top: 8 }}>
                <CartesianGrid
                  vertical={false}
                  strokeDasharray="3 3"
                  stroke="var(--color-sand)"
                />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  fontSize={12}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  fontSize={12}
                  tickFormatter={(v) => `₹${v}`}
                  width={56}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="line" />}
                />
                <Bar
                  dataKey="revenue"
                  fill="var(--color-revenue)"
                  radius={[6, 6, 0, 0]}
                  barSize={28}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Best-selling */}
        <Card className="rounded-2xl border border-border bg-white-warm p-0 shadow-none ring-0 lg:col-span-2">
          <CardHeader className="px-6 pt-6 pb-0">
            <CardTitle className="font-display text-xl text-charcoal">
              Best sellers
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6 pt-4">
            {bestSellers.length === 0 ? (
              <p className="py-8 text-center font-body text-sm text-charcoal/50">
                No orders yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-4">
                {bestSellers.map((item, i) => (
                  <li key={item.name} className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-body text-sm text-charcoal">
                        <span className="mr-2 font-display text-terracotta">
                          {i + 1}
                        </span>
                        {item.name}
                      </span>
                      <span className="font-body text-xs text-charcoal/55">
                        {item.qty} sold
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-sand/50">
                      <div
                        className="h-full rounded-full bg-terracotta transition-[width] duration-700 ease-out"
                        style={{ width: `${item.pct}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default CafeStats;
