import { useEffect, useState, type ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricCard } from "@/components/admin/MetricCard";
import { chartColors } from "@/lib/chartColors";
import { cn } from "@/lib/utils";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  BarChart3,
  TrendingUp,
  PieChart,
  Users,
  CheckCircle2,
  DollarSign,
  Calendar,
  Clock,
  Coffee,
  Flame,
  GraduationCap,
  Sparkles,
} from "lucide-react";

// Recharts MUST be a static import (the panel is already dynamic-loaded with
// ssr:false by admin/control.tsx, so charts never run on the server).
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Label as RechartsLabel,
  Line,
  Pie,
  PieChart as RechartsPieChart,
  XAxis,
  YAxis,
} from "recharts";

export type ControlAnalyticsPayload = {
  monthlyProfitLoss: { label: string; revenue: number; expense: number; profitk: number }[];
  financial: {
    monthlyRevenue: { label: string; amount: number; amountKDisplay: number }[];
    revenueGrowthPct: number | null;
    revenueSources: { name: string; amount: number; pct: number }[];
    totalRevenuePackages: number;
  };
  members: {
    newMembersMonthly: { label: string; count: number }[];
    memberGrowthPct: number | null;
    passDistribution: { name: string; count: number; pct: number }[];
    totalPassHolders: number;
    activeRatePct: number;
    atRiskCount: number;
    leaderboard: { name: string; streak: number }[];
    streakMax: number;
  };
  instructors: {
    comparison: { name: string; checkIns: number; maxScale: number }[];
    topEarners: { name: string; earnings: number; sharePct: number }[];
    classesTaught: { name: string; classes: number; maxScale: number }[];
  };
  classes: {
    popularity: { name: string; bookings: number; maxScale: number }[];
    occupancy: { name: string; occupancy: number; status: string }[];
    peakHours: { label: string; bookings: number; intensity: number }[];
  };
  kpis: {
    revenuePerMember: number;
    revenuePerMemberGrowthPct: number | null;
    classUtilization: number;
    memberSatisfaction: number | null;
    cafeAttachPct: number;
  };
};

const emptyAnalytics: ControlAnalyticsPayload = {
  monthlyProfitLoss: [],
  financial: {
    monthlyRevenue: [],
    revenueGrowthPct: null,
    revenueSources: [{ name: "No data yet", amount: 0, pct: 100 }],
    totalRevenuePackages: 0,
  },
  members: {
    newMembersMonthly: [],
    memberGrowthPct: null,
    passDistribution: [],
    totalPassHolders: 0,
    activeRatePct: 0,
    atRiskCount: 0,
    leaderboard: [],
    streakMax: 1,
  },
  instructors: { comparison: [], topEarners: [], classesTaught: [] },
  classes: { popularity: [], occupancy: [], peakHours: [] },
  kpis: {
    revenuePerMember: 0,
    revenuePerMemberGrowthPct: null,
    classUtilization: 0,
    memberSatisfaction: null,
    cafeAttachPct: 0,
  },
};

// Chart axis colours mirror FinanceTab/MembersTab — Recharts can't read Tailwind
// classes, so these sanctioned hex values match the brand grid/text tokens.
const AXIS_GRID = "#E5E5E0";
const AXIS_TICK = "#6B6B6B";
const HOVER_FILL = "rgba(143,151,121,0.05)";

function compactInr(n: number): string {
  const abs = Math.abs(Math.round(n));
  if (abs >= 100000) return `₹${(abs / 100000).toFixed(1)}L`;
  if (abs >= 1000) return `₹${(abs / 1000).toFixed(1)}k`;
  return `₹${abs.toLocaleString("en-IN")}`;
}

// Signed percentage label ("+12% Growth") or em-dash when the pct is null.
function growthPctLabel(pct: number | null, suffix: string) {
  if (pct === null) return "—";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct}${suffix}`;
}

function growthTone(pct: number | null): "success" | "danger" | "neutral" {
  if (pct === null) return "neutral";
  return pct >= 0 ? "success" : "danger";
}

// Per-bar occupancy colour, replacing the old status→Tailwind-fill map.
function occupancyColor(status: string): string {
  if (status === "full" || status === "high" || status === "good") return chartColors.sage;
  if (status === "moderate") return chartColors.terracotta;
  return chartColors.warmRed;
}

// ── Reusable internal chart pieces ──────────────────────────────────────────

type RankRow = { name: string; value: number; status?: string };

function RankedBarChart({
  data,
  color = chartColors.sage,
  valueLabel,
  heightClass = "h-[300px]",
  colorFor,
}: Readonly<{
  data: RankRow[];
  color?: string;
  valueLabel: string;
  heightClass?: string;
  colorFor?: (row: RankRow) => string;
}>) {
  const config: ChartConfig = { value: { label: valueLabel, color } };
  return (
    <ChartContainer config={config} className={cn(heightClass, "w-full")}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke={AXIS_GRID} />
        <XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: AXIS_TICK }}
          allowDecimals={false}
        />
        <YAxis
          dataKey="name"
          type="category"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12, fill: AXIS_TICK }}
          width={120}
        />
        <ChartTooltip cursor={{ fill: HOVER_FILL }} content={<ChartTooltipContent />} />
        <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={26} fill={color}>
          {colorFor ? data.map((row) => <Cell key={row.name} fill={colorFor(row)} />) : null}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

type DonutSlice = { name: string; value: number; color: string };

function DonutChart({
  data,
  centerValue,
  centerLabel,
}: Readonly<{ data: DonutSlice[]; centerValue: string; centerLabel: string }>) {
  const config: ChartConfig = Object.fromEntries(
    data.map((d) => [d.name, { label: d.name, color: d.color }]),
  );
  return (
    <ChartContainer config={config} className="mx-auto aspect-square max-h-[220px]">
      <RechartsPieChart>
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={56}
          outerRadius={86}
          strokeWidth={2}
          stroke={chartColors.cream}
        >
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
          <RechartsLabel
            position="center"
            content={({ viewBox }) => {
              if (!viewBox || !("cx" in viewBox)) return null;
              const cx = viewBox.cx ?? 0;
              const cy = viewBox.cy ?? 0;
              return (
                <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                  <tspan x={cx} y={cy - 4} fill={chartColors.charcoal} fontSize="22" fontWeight="600">
                    {centerValue}
                  </tspan>
                  <tspan x={cx} y={cy + 16} fill={AXIS_TICK} fontSize="10">
                    {centerLabel}
                  </tspan>
                </text>
              );
            }}
          />
        </Pie>
      </RechartsPieChart>
    </ChartContainer>
  );
}

// Coloured-dot legend row shared by the two donut cards.
function LegendRow({
  color,
  name,
  primary,
  secondary,
}: Readonly<{ color: string; name: string; primary: string; secondary?: string }>) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="flex items-center gap-2 font-body text-sm text-charcoal">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="truncate">{name}</span>
      </span>
      <span className="font-body text-sm tabular-nums text-charcoal/60 whitespace-nowrap">
        <span className="font-medium text-charcoal">{primary}</span>
        {secondary ? <> · {secondary}</> : null}
      </span>
    </div>
  );
}

function SectionHeading({
  icon: Icon,
  children,
}: Readonly<{ icon: React.ComponentType<{ className?: string }>; children: ReactNode }>) {
  return (
    <h3 className="font-body font-semibold text-xl sm:text-2xl text-charcoal mb-4 flex items-center gap-2">
      <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-sage" />
      {children}
    </h3>
  );
}

function CardTitleRow({
  icon: Icon,
  title,
  description,
  accessory,
}: Readonly<{
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  accessory?: ReactNode;
}>) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <CardTitle className="font-body font-semibold text-lg sm:text-xl text-charcoal flex items-center gap-2">
          {Icon ? <Icon className="h-5 w-5 text-sage shrink-0" /> : null}
          {title}
        </CardTitle>
        {description ? (
          <CardDescription className="font-body text-charcoal/60">{description}</CardDescription>
        ) : null}
      </div>
      {accessory}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl bg-sage/10" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="h-72 rounded-xl bg-sage/10 lg:col-span-2" />
        <Skeleton className="h-72 rounded-xl bg-sage/10" />
      </div>
      <Skeleton className="h-72 rounded-xl bg-sage/10" />
    </div>
  );
}

export function ControlAnalyticsPanel() {
  const [d, setD] = useState<ControlAnalyticsPayload>(emptyAnalytics);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/control-analytics");
        if (!res.ok) throw new Error();
        const json = (await res.json()) as ControlAnalyticsPayload;
        if (!cancelled) setD(json);
      } catch {
        if (!cancelled) setD(emptyAnalytics);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <LoadingState />;
  }

  // ── Derived view-models (presentation only) ──────────────────────────────
  const revenueSourceTotal = d.financial.revenueSources.reduce((s, r) => s + r.amount, 0);
  const revenueSourceSlices: DonutSlice[] = d.financial.revenueSources
    .filter((r) => r.amount > 0)
    .map((r, i) => ({ name: r.name, value: r.amount, color: chartColors.series[i % chartColors.series.length] }));

  const passSlices: DonutSlice[] = d.members.passDistribution.map((r, i) => ({
    name: r.name,
    value: r.count,
    color: chartColors.series[i % chartColors.series.length],
  }));

  const activityData: DonutSlice[] = [
    { name: "Active", value: Math.max(0, Math.min(100, d.members.activeRatePct)), color: chartColors.sage },
    { name: "Quiet", value: Math.max(0, 100 - d.members.activeRatePct), color: chartColors.sand },
  ];

  const profitLossData = d.monthlyProfitLoss.map((m) => ({
    label: m.label,
    revenue: m.revenue,
    expense: m.expense,
    profit: m.profitk,
  }));

  const occupancyRows: RankRow[] = d.classes.occupancy.map((c) => ({
    name: c.name,
    value: c.occupancy,
    status: c.status,
  }));

  return (
    <div className="space-y-10">
      <div>
        <h2 className="font-body font-semibold text-2xl sm:text-3xl text-charcoal mb-2">
          Analytics &amp; Visualization
        </h2>
        <p className="font-body text-charcoal/60">
          Metrics from live database aggregates (six rolling calendar months unless noted).
        </p>
      </div>

      {/* Headline KPIs lead the page — editorial summary before the detail charts. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard
          label="Revenue / member"
          value={d.kpis.revenuePerMember}
          prefix="₹"
          icon={DollarSign}
          tone="sage"
          hint={`${growthPctLabel(d.kpis.revenuePerMemberGrowthPct, "%")} · prev month`}
          description="Total revenue divided by active member count, versus last month's rate."
        />
        <MetricCard
          label="Class utilization"
          value={d.kpis.classUtilization}
          suffix="%"
          icon={BarChart3}
          tone="sage"
          hint="30-day estimate"
          description="Average share of class capacity filled by bookings over the last 30 days."
        />
        <MetricCard
          label="Café overlap"
          value={d.kpis.cafeAttachPct}
          suffix="%"
          icon={Coffee}
          tone="clay"
          hint="Buyers vs active members (30d)"
          description="Share of active members in the last 30 days who also bought from the café."
        />
        <MetricCard
          label="Member surveys"
          value={d.kpis.memberSatisfaction ?? "—"}
          icon={Sparkles}
          tone="charcoal"
          hint="Not collected in-app yet"
          description="Average member satisfaction score; not currently collected in-app, so this is a placeholder."
        />
      </div>

      {/* ── Financial ── */}
      <section>
        <SectionHeading icon={BarChart3}>Financial Analytics</SectionHeading>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="border-sage/20 bg-white-warm lg:col-span-2">
            <CardHeader>
              <CardTitleRow
                icon={TrendingUp}
                title="Revenue Trend"
                description="Package revenue by calendar month"
                accessory={
                  <Pill tone={growthTone(d.financial.revenueGrowthPct)} size="md">
                    {growthPctLabel(d.financial.revenueGrowthPct, "% Growth")}
                  </Pill>
                }
              />
            </CardHeader>
            <CardContent>
              {d.financial.monthlyRevenue.length === 0 ? (
                <EmptyState icon={TrendingUp} title="No revenue in range" description="Package sales will chart here once they land." />
              ) : (
                <ChartContainer
                  config={{ amount: { label: "Revenue", color: chartColors.sage } }}
                  className="h-[280px] w-full"
                >
                  <BarChart data={d.financial.monthlyRevenue} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={AXIS_GRID} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: AXIS_TICK }} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12, fill: AXIS_TICK }}
                      tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`}
                      width={48}
                    />
                    <ChartTooltip
                      cursor={{ fill: HOVER_FILL }}
                      content={<ChartTooltipContent formatter={(v) => `₹${Number(v).toLocaleString("en-IN")}`} />}
                    />
                    <Bar dataKey="amount" fill="var(--color-amount)" radius={[6, 6, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <Card className="border-sage/20 bg-white-warm">
            <CardHeader>
              <CardTitleRow icon={PieChart} title="Revenue Sources" description="Package purchases (6 mo)" />
            </CardHeader>
            <CardContent>
              {revenueSourceTotal === 0 || revenueSourceSlices.length === 0 ? (
                <EmptyState icon={PieChart} title="No revenue to break down" description="Sources appear once package sales are recorded." />
              ) : (
                <>
                  <DonutChart
                    data={revenueSourceSlices}
                    centerValue={compactInr(revenueSourceTotal)}
                    centerLabel="Total"
                  />
                  <div className="mt-4 space-y-2.5">
                    {revenueSourceSlices.map((s) => (
                      <LegendRow
                        key={s.name}
                        color={s.color}
                        name={s.name}
                        primary={compactInr(s.value)}
                        secondary={`${Math.round((s.value / revenueSourceTotal) * 100)}%`}
                      />
                    ))}
                  </div>
                  <div className="mt-5 rounded-xl border border-sage/15 bg-sage/5 px-4 py-3">
                    <div className="font-body text-xs uppercase tracking-wide text-charcoal/50">
                      Total package revenue (6 mo)
                    </div>
                    <div className="font-body font-semibold text-2xl text-charcoal tabular-nums">
                      ₹{d.financial.totalRevenuePackages.toLocaleString("en-IN")}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-sage/20 bg-white-warm lg:col-span-3">
            <CardHeader>
              <CardTitleRow
                icon={BarChart3}
                title="Profit / Loss"
                description="Thousands of ₹: revenue vs estimated coach payouts (check-ins × share)"
              />
            </CardHeader>
            <CardContent>
              {profitLossData.length === 0 ? (
                <EmptyState icon={BarChart3} title="No data" description="Revenue and payout history will compare here." />
              ) : (
                <ChartContainer
                  config={{
                    revenue: { label: "Revenue (₹k)", color: chartColors.sage },
                    expense: { label: "Est. payouts (₹k)", color: chartColors.terracotta },
                    profit: { label: "Profit (₹k)", color: chartColors.slateBlue },
                  }}
                  className="h-[300px] w-full"
                >
                  <ComposedChart data={profitLossData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={AXIS_GRID} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: AXIS_TICK }} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12, fill: AXIS_TICK }}
                      tickFormatter={(v: number) => `₹${v}k`}
                      width={44}
                    />
                    <ChartTooltip cursor={{ fill: HOVER_FILL }} content={<ChartTooltipContent formatter={(v) => `₹${Number(v)}k`} />} />
                    <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[6, 6, 0, 0]} maxBarSize={32} />
                    <Bar dataKey="expense" fill="var(--color-expense)" radius={[6, 6, 0, 0]} maxBarSize={32} />
                    <Line
                      type="monotone"
                      dataKey="profit"
                      stroke="var(--color-profit)"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "var(--color-profit)" }}
                      activeDot={{ r: 6 }}
                    />
                  </ComposedChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── Members ── */}
      <section>
        <SectionHeading icon={Users}>Member Analytics</SectionHeading>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-sage/20 bg-white-warm">
            <CardHeader>
              <CardTitleRow
                icon={TrendingUp}
                title="Member Growth"
                description="New member profiles per month"
                accessory={
                  <Pill tone={growthTone(d.members.memberGrowthPct)} size="md">
                    {growthPctLabel(d.members.memberGrowthPct, "% Growth Rate")}
                  </Pill>
                }
              />
            </CardHeader>
            <CardContent>
              {d.members.newMembersMonthly.length === 0 ? (
                <EmptyState icon={Users} title="No signups yet" description="New member sign-ups will chart here." />
              ) : (
                <ChartContainer
                  config={{ count: { label: "New members", color: chartColors.sage } }}
                  className="h-[240px] w-full"
                >
                  <BarChart data={d.members.newMembersMonthly} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={AXIS_GRID} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: AXIS_TICK }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: AXIS_TICK }} width={32} allowDecimals={false} />
                    <ChartTooltip cursor={{ fill: HOVER_FILL }} content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="var(--color-count)" radius={[6, 6, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <Card className="border-sage/20 bg-white-warm">
            <CardHeader>
              <CardTitleRow icon={PieChart} title="Pass Distribution" description="Active memberships" />
            </CardHeader>
            <CardContent>
              {passSlices.length === 0 ? (
                <EmptyState icon={PieChart} title="No active packages" description="Pass mix appears once members hold passes." />
              ) : (
                <>
                  <DonutChart
                    data={passSlices}
                    centerValue={String(d.members.totalPassHolders)}
                    centerLabel="Holders"
                  />
                  <div className="mt-4 space-y-2.5">
                    {d.members.passDistribution.map((row, i) => (
                      <LegendRow
                        key={`${row.name}-${i}`}
                        color={chartColors.series[i % chartColors.series.length]}
                        name={row.name}
                        primary={String(row.count)}
                        secondary={`${row.pct}%`}
                      />
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-sage/20 bg-white-warm">
            <CardHeader>
              <CardTitleRow icon={CheckCircle2} title="Activity (30-day)" description="Members with at least one check-in" />
            </CardHeader>
            <CardContent>
              <DonutChart
                data={activityData}
                centerValue={`${d.members.activeRatePct}%`}
                centerLabel="Active"
              />
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-sage/15 bg-sage/5 px-4 py-3">
                  <div className="font-body text-xs uppercase tracking-wide text-charcoal/50">Active rate</div>
                  <div className="font-body font-semibold text-2xl text-sage tabular-nums">{d.members.activeRatePct}%</div>
                </div>
                <div className="rounded-xl border border-terracotta/15 bg-terracotta/5 px-4 py-3">
                  <div className="font-body text-xs uppercase tracking-wide text-charcoal/50">Quiet members</div>
                  <div className="font-body font-semibold text-2xl text-terracotta tabular-nums">{d.members.atRiskCount}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-sage/20 bg-white-warm">
            <CardHeader>
              <CardTitleRow icon={Flame} title="Streak Leaders" description="Current streak (days)" />
            </CardHeader>
            <CardContent>
              {d.members.leaderboard.length === 0 ? (
                <EmptyState icon={Flame} title="No streak data" description="Member streaks will rank here once classes are attended." />
              ) : (
                <RankedBarChart
                  data={d.members.leaderboard.map((m) => ({ name: m.name, value: m.streak }))}
                  valueLabel="Day streak"
                  heightClass="h-[260px]"
                />
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── Instructors ── */}
      <section>
        <SectionHeading icon={GraduationCap}>Instructors (this month)</SectionHeading>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-sage/20 bg-white-warm lg:col-span-2">
            <CardHeader>
              <CardTitleRow icon={CheckCircle2} title="Check-ins" description="Members checked in, by instructor" />
            </CardHeader>
            <CardContent>
              {d.instructors.comparison.length === 0 ? (
                <EmptyState icon={CheckCircle2} title="No check-ins yet" description="Instructor check-in counts will chart here." />
              ) : (
                <RankedBarChart
                  data={d.instructors.comparison.map((i) => ({ name: i.name, value: i.checkIns }))}
                  valueLabel="Check-ins"
                  heightClass="h-[300px]"
                />
              )}
            </CardContent>
          </Card>

          <Card className="border-sage/20 bg-white-warm">
            <CardHeader>
              <CardTitleRow icon={DollarSign} title="Top earners (est.)" description="Share of estimated payouts" />
            </CardHeader>
            <CardContent>
              {d.instructors.topEarners.length === 0 ? (
                <EmptyState icon={DollarSign} title="No earnings yet" description="Estimated instructor payouts appear here." />
              ) : (
                <div className="space-y-3">
                  {d.instructors.topEarners.map((inst, idx) => (
                    <div
                      key={`${inst.name}-${idx}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-sage/15 bg-sage/5 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="font-body text-sm font-medium text-charcoal truncate">{inst.name}</div>
                        <div className="font-body font-semibold text-xl text-sage tabular-nums">
                          ₹{inst.earnings.toLocaleString("en-IN")}
                        </div>
                      </div>
                      <Pill tone="success">{inst.sharePct}%</Pill>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-sage/20 bg-white-warm">
            <CardHeader>
              <CardTitleRow icon={Calendar} title="Scheduled slots" description="Classes scheduled per instructor" />
            </CardHeader>
            <CardContent>
              {d.instructors.classesTaught.length === 0 ? (
                <EmptyState icon={Calendar} title="No scheduled classes" description="Scheduled slots per instructor appear here." />
              ) : (
                <RankedBarChart
                  data={d.instructors.classesTaught.map((r) => ({ name: r.name, value: r.classes }))}
                  valueLabel="Classes"
                  heightClass="h-[260px]"
                />
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── Classes ── */}
      <section>
        <SectionHeading icon={Calendar}>Classes (this month)</SectionHeading>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-sage/20 bg-white-warm lg:col-span-2">
            <CardHeader>
              <CardTitleRow icon={TrendingUp} title="Bookings by class type" description="Total bookings per class" />
            </CardHeader>
            <CardContent>
              {d.classes.popularity.length === 0 ? (
                <EmptyState icon={TrendingUp} title="No bookings yet" description="Booking volume by class type will chart here." />
              ) : (
                <RankedBarChart
                  data={d.classes.popularity.map((c) => ({ name: c.name, value: c.bookings }))}
                  valueLabel="Bookings"
                  heightClass="h-[300px]"
                />
              )}
            </CardContent>
          </Card>

          <Card className="border-sage/20 bg-white-warm">
            <CardHeader>
              <CardTitleRow icon={BarChart3} title="Utilization estimate" description="Occupancy by class (%)" />
            </CardHeader>
            <CardContent>
              {occupancyRows.length === 0 ? (
                <EmptyState icon={BarChart3} title="No data" description="Class occupancy estimates appear here." />
              ) : (
                <>
                  <RankedBarChart
                    data={occupancyRows}
                    valueLabel="Occupancy %"
                    heightClass="h-[240px]"
                    colorFor={(row) => occupancyColor(row.status ?? "")}
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                    <span className="flex items-center gap-1.5 font-body text-xs text-charcoal/55">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: chartColors.sage }} /> Healthy
                    </span>
                    <span className="flex items-center gap-1.5 font-body text-xs text-charcoal/55">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: chartColors.terracotta }} /> Moderate
                    </span>
                    <span className="flex items-center gap-1.5 font-body text-xs text-charcoal/55">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: chartColors.warmRed }} /> Low
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-sage/20 bg-white-warm">
            <CardHeader>
              <CardTitleRow icon={Clock} title="Peak booking hours" description="Bookings by time of day" />
            </CardHeader>
            <CardContent>
              {d.classes.peakHours.length === 0 ? (
                <EmptyState icon={Clock} title="No peak data" description="Busiest booking windows will chart here." />
              ) : (
                <ChartContainer
                  config={{ bookings: { label: "Bookings", color: chartColors.sage } }}
                  className="h-[240px] w-full"
                >
                  <BarChart data={d.classes.peakHours} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={AXIS_GRID} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: AXIS_TICK }} interval={0} angle={-30} textAnchor="end" height={48} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: AXIS_TICK }} width={32} allowDecimals={false} />
                    <ChartTooltip cursor={{ fill: HOVER_FILL }} content={<ChartTooltipContent />} />
                    <Bar dataKey="bookings" fill="var(--color-bookings)" radius={[6, 6, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
