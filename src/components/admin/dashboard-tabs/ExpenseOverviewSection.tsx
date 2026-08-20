import { memo, useEffect, useMemo, useState } from "react";
import { BadgeIndianRupee, PieChart, TrendingDown, Wallet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/admin/MetricCard";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { EXPENSE_CATEGORY_LABELS, expenseCategoryStyle } from "@/lib/expenseConstants";

type ExpenseDTO = {
  id: string;
  category: string;
  amountPaise: number;
  incurredAtISO: string;
  isPayout: boolean;
};

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function compactInr(n: number): string {
  const abs = Math.abs(Math.round(n));
  if (abs >= 100000) return `₹${(abs / 100000).toFixed(2)}L`;
  if (abs >= 1000) return `₹${(abs / 1000).toFixed(1)}k`;
  return `₹${abs.toLocaleString("en-IN")}`;
}

function ExpenseOverviewSectionImpl() {
  const [expenses, setExpenses] = useState<ExpenseDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const r = await fetch("/api/admin/expenses");
        if (r.ok) {
          const d = await r.json();
          if (Array.isArray(d.expenses)) setExpenses(d.expenses);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const totalAll = expenses.reduce((s, e) => s + e.amountPaise, 0);
    const monthRows = expenses.filter((e) => {
      const d = new Date(e.incurredAtISO);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    const monthTotal = monthRows.reduce((s, e) => s + e.amountPaise, 0);
    const payoutMonth = monthRows.filter((e) => e.isPayout).reduce((s, e) => s + e.amountPaise, 0);
    return { totalAll, monthTotal, payoutMonth };
  }, [expenses]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) map.set(e.category, (map.get(e.category) ?? 0) + e.amountPaise);
    const total = expenses.reduce((s, e) => s + e.amountPaise, 0);
    const slices = Array.from(map.entries())
      .map(([category, amountPaise]) => ({ category, amountPaise }))
      .sort((a, b) => b.amountPaise - a.amountPaise);
    return { slices, total };
  }, [expenses]);

  const trend = useMemo(() => {
    const now = new Date();
    const buckets = new Map<string, number>();
    for (const e of expenses) {
      const d = new Date(e.incurredAtISO);
      buckets.set(`${d.getFullYear()}-${d.getMonth()}`, (buckets.get(`${d.getFullYear()}-${d.getMonth()}`) ?? 0) + e.amountPaise / 100);
    }
    const out: { month: string; expenses: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      out.push({ month: MONTH_LABELS[d.getMonth()], expenses: Math.round(buckets.get(`${d.getFullYear()}-${d.getMonth()}`) ?? 0) });
    }
    return out;
  }, [expenses]);

  const hasTrend = trend.some((t) => t.expenses > 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        <MetricCard label="Total Expenses" value={Math.round(stats.totalAll / 100)} prefix="₹" icon={TrendingDown} tone="terracotta" loading={loading} hint={`${expenses.length} recorded`} description="Sum of all recorded expenses across all time." />
        <MetricCard label="This Month" value={Math.round(stats.monthTotal / 100)} prefix="₹" icon={Wallet} tone="terracotta" loading={loading} description="Total expenses recorded in the current calendar month." />
        <MetricCard label="Payouts This Month" value={Math.round(stats.payoutMonth / 100)} prefix="₹" icon={BadgeIndianRupee} tone="sage" loading={loading} hint="of expenses" description="Instructor payouts recorded this month, as a portion of total expenses." />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-sage/20 bg-white-warm">
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="font-body font-semibold text-xl text-charcoal">Where the money goes</CardTitle>
                <CardDescription className="font-body text-charcoal/60">By category, all recorded expenses</CardDescription>
              </div>
              <PieChart className="h-5 w-5 text-sage/40 shrink-0" />
            </div>
          </CardHeader>
          <CardContent>
            {byCategory.total === 0 ? (
              <div className="py-10 text-center font-body text-sm text-charcoal/40">No expenses recorded yet.</div>
            ) : (
              <div className="space-y-4">
                {byCategory.slices.map((s) => {
                  const pct = (s.amountPaise / byCategory.total) * 100;
                  const ks = expenseCategoryStyle(s.category);
                  return (
                    <div key={s.category}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-2">
                        <span className="flex items-center gap-2 font-body text-sm text-charcoal">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ks.fg }} />
                          {EXPENSE_CATEGORY_LABELS[s.category as keyof typeof EXPENSE_CATEGORY_LABELS] ?? s.category}
                        </span>
                        <span className="font-body text-sm tabular-nums text-charcoal/60">
                          <span className="font-medium text-charcoal">{compactInr(s.amountPaise / 100)}</span> · {pct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-charcoal/5">
                        <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: ks.fg }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-sage/20 bg-white-warm">
          <CardHeader>
            <CardTitle className="font-body font-semibold text-xl text-charcoal">Monthly expenses</CardTitle>
            <CardDescription className="font-body text-charcoal/60">Total recorded per month, last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            {!hasTrend ? (
              <div className="h-[280px] flex items-center justify-center font-body text-sm text-charcoal/40">No data yet.</div>
            ) : (
              <ChartContainer config={{ expenses: { label: "Expenses", color: "#C17856" } }} className="h-[280px] w-full">
                <BarChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E5E5E0" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#6B6B6B" }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#6B6B6B" }} tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} width={48} />
                  <ChartTooltip cursor={{ fill: "rgba(193,120,86,0.05)" }} content={<ChartTooltipContent formatter={(v) => `₹${Number(v).toLocaleString("en-IN")}`} />} />
                  <Bar dataKey="expenses" fill="var(--color-expenses)" radius={[6, 6, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export const ExpenseOverviewSection = memo(ExpenseOverviewSectionImpl);
export default ExpenseOverviewSection;
