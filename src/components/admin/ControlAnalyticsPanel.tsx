import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";

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

function barPct(value: number, max: number) {
  const m = Math.max(max, 1);
  return Math.round((value / m) * 100);
}

function statusClasses(status: string) {
  switch (status) {
    case "full":
      return "bg-sage text-white";
    case "high":
      return "bg-sage/80 text-white";
    case "good":
      return "bg-sage/60 text-white";
    case "moderate":
      return "bg-amber-500 text-white";
    default:
      return "bg-red-500 text-white";
  }
}

function barFillClasses(status: string) {
  if (status === "full" || status === "high") return "bg-sage";
  if (status === "good") return "bg-sage/70";
  if (status === "moderate") return "bg-amber-500";
  return "bg-red-500";
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
    return (
      <div className="rounded-xl border border-sage/20 bg-white/80 p-12 text-center font-body text-charcoal/60">
        Loading analytics…
      </div>
    );
  }

  const maxRev = useMemo(
    () => Math.max(...d.financial.monthlyRevenue.map((x) => x.amount), 1),
    [d.financial.monthlyRevenue],
  );
  const maxGrowth = useMemo(
    () => Math.max(...d.members.newMembersMonthly.map((x) => x.count), 1),
    [d.members.newMembersMonthly],
  );

  const growthLabel =
    d.financial.revenueGrowthPct !== null
      ? `${d.financial.revenueGrowthPct > 0 ? "+" : ""}${d.financial.revenueGrowthPct}% Growth`
      : "—";

  const memberGrowthLabel =
    d.members.memberGrowthPct !== null
      ? `${d.members.memberGrowthPct > 0 ? "+" : ""}${d.members.memberGrowthPct}% Growth Rate`
      : "—";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl text-charcoal mb-2">Analytics & Visualization</h2>
        <p className="font-body text-charcoal/60">
          Metrics from live database aggregates (six rolling calendar months unless noted).
        </p>
      </div>

      <div>
        <h3 className="font-display text-2xl text-charcoal mb-4 flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-sage" />
          Financial Analytics
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-sage/20 bg-white-warm">
            <CardHeader>
              <CardTitle className="font-display text-xl text-charcoal flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-sage" />
                Revenue Trend
              </CardTitle>
              <CardDescription>Package revenue by calendar month</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-end justify-between gap-2">
                {d.financial.monthlyRevenue.length === 0 ? (
                  <p className="font-body text-sm text-charcoal/50 w-full text-center py-16">No revenue in range</p>
                ) : (
                  d.financial.monthlyRevenue.map((cell, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-2 min-w-0">
                      <div
                        className="w-full bg-linear-to-t from-sage to-sage/40 rounded-t-lg hover:from-sage/90 transition-all cursor-pointer relative group"
                        style={{
                          height: `${barPct(cell.amount, maxRev)}%`,
                          minHeight: cell.amount > 0 ? "8px" : "2px",
                        }}
                      >
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-charcoal text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                          ₹{cell.amountKDisplay}k
                        </div>
                      </div>
                      <span className="text-xs text-charcoal/60 font-body truncate w-full text-center">
                        {cell.label}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-4 flex items-center justify-center gap-2">
                <Badge className="bg-sage/10 text-sage border-sage/20">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  {growthLabel}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="border-sage/20 bg-white-warm">
            <CardHeader>
              <CardTitle className="font-display text-xl text-charcoal flex items-center gap-2">
                <PieChart className="h-5 w-5 text-sage" />
                Revenue Sources
              </CardTitle>
              <CardDescription>Share of package purchases (6 months)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {d.financial.revenueSources.map((row, idx) => (
                  <div key={`${row.name}-${idx}`}>
                    <div className="flex justify-between mb-2">
                      <span className="font-body text-sm">{row.name}</span>
                      <span className="font-body text-sm font-medium text-sage">{row.pct}%</span>
                    </div>
                    <div className="h-3 bg-sage/10 rounded-full overflow-hidden">
                      <div className="h-full bg-sage transition-all duration-600" style={{ width: `${row.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 p-4 bg-cream/30 rounded-lg">
                <div className="font-body text-sm text-charcoal/60 mb-1">Total package revenue (6 mo)</div>
                <div className="font-display text-3xl text-charcoal">
                  ₹{d.financial.totalRevenuePackages.toLocaleString("en-IN")}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-sage/20 bg-white-warm lg:col-span-2">
            <CardHeader>
              <CardTitle className="font-display text-xl text-charcoal flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-sage" />
                Profit / Loss Comparison
              </CardTitle>
              <CardDescription>Thousands of ₹: revenue vs estimated coach payouts (check-ins × share)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {d.monthlyProfitLoss.length === 0 ? (
                  <p className="text-center text-charcoal/50 font-body py-8">No data</p>
                ) : (
                  d.monthlyProfitLoss.map((data, idx) => (
                    <div key={idx}>
                      <div className="flex justify-between mb-1">
                        <span className="font-body text-sm">{data.label}</span>
                        <span
                          className={`font-body text-sm font-medium ${data.profitk >= 0 ? "text-sage" : "text-terracotta"}`}
                        >
                          {data.profitk >= 0 ? "+" : ""}₹{data.profitk}k
                        </span>
                      </div>
                      <div className="flex gap-2 h-6 items-stretch">
                        <div className="flex-1 bg-sage/10 rounded overflow-hidden flex min-h-[8px]">
                          <div
                            className="bg-sage h-full rounded-l transition-all min-w-[2px]"
                            style={{ flexGrow: Math.max(data.revenue, 0.1), flexBasis: 0 }}
                          />
                        </div>
                        <div className="flex-1 bg-red-100 rounded overflow-hidden flex min-h-[8px]">
                          <div
                            className="bg-red-400 h-full rounded-l transition-all min-w-[2px]"
                            style={{ flexGrow: Math.max(data.expense, 0.1), flexBasis: 0 }}
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-6 flex gap-4 justify-center flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-sage rounded" />
                  <span className="font-body text-sm text-charcoal/60">Revenue ₹k</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-400 rounded" />
                  <span className="font-body text-sm text-charcoal/60">Est. payouts ₹k</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div>
        <h3 className="font-display text-2xl text-charcoal mb-4 flex items-center gap-2">
          <Users className="h-6 w-6 text-sage" />
          Member Analytics
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-sage/20 bg-white-warm">
            <CardHeader>
              <CardTitle className="font-display text-xl text-charcoal flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-sage" />
                Member Growth
              </CardTitle>
              <CardDescription>New member profiles per month</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-48 flex items-end justify-between gap-2">
                {d.members.newMembersMonthly.length === 0 ? (
                  <p className="w-full text-center text-charcoal/50 font-body py-12">No signups</p>
                ) : (
                  d.members.newMembersMonthly.map((cell, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                      <div
                        className="w-full bg-linear-to-t from-sage to-sage/40 rounded-t-lg hover:from-sage/90 transition-all cursor-pointer relative group"
                        style={{
                          height: `${barPct(cell.count, maxGrowth)}%`,
                          minHeight: cell.count > 0 ? "8px" : "2px",
                        }}
                      >
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-charcoal text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          {cell.count} new
                        </div>
                      </div>
                      <span className="text-xs text-charcoal/60 font-body truncate w-full text-center">
                        {cell.label}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-4 flex items-center justify-center">
                <Badge className="bg-sage/10 text-sage border-sage/20">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  {memberGrowthLabel}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="border-sage/20 bg-white-warm">
            <CardHeader>
              <CardTitle className="font-display text-xl text-charcoal flex items-center gap-2">
                <PieChart className="h-5 w-5 text-sage" />
                Pass Distribution
              </CardTitle>
              <CardDescription>Active memberships</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {d.members.passDistribution.length === 0 ? (
                  <p className="font-body text-sm text-charcoal/50 text-center py-6">No active packages</p>
                ) : (
                  d.members.passDistribution.map((row, idx) => (
                    <div key={`${row.name}-${idx}`}>
                      <div className="flex justify-between mb-2">
                        <span className="font-body text-sm">{row.name}</span>
                        <span className="font-body text-sm font-medium text-sage">
                          {row.count} ({row.pct}%)
                        </span>
                      </div>
                      <div className="h-3 bg-sage/10 rounded-full overflow-hidden">
                        <div className="h-full bg-sage" style={{ width: `${row.pct}%` }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-6 p-4 bg-cream/30 rounded-lg">
                <div className="font-body text-sm text-charcoal/60 mb-1">Active package holders</div>
                <div className="font-display text-3xl text-charcoal">{d.members.totalPassHolders}</div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-sage/20 bg-white-warm">
            <CardHeader>
              <CardTitle className="font-display text-xl text-charcoal flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-sage" />
                Activity (30-day)
              </CardTitle>
              <CardDescription>Members with at least one check-in</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="font-body text-sm">Active approx.</span>
                    <span className="font-body text-sm font-medium text-sage">{d.members.activeRatePct}%</span>
                  </div>
                  <div className="h-4 bg-sage/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sage transition-all duration-600"
                      style={{ width: `${d.members.activeRatePct}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="font-body text-sm">No recent check-in (approx.)</span>
                    <span className="font-body text-sm font-medium text-amber-600">{d.members.atRiskCount}</span>
                  </div>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="p-3 bg-sage/5 rounded-lg border border-sage/20">
                  <div className="font-body text-xs text-charcoal/60 mb-1">Active rate</div>
                  <div className="font-display text-2xl text-sage">{d.members.activeRatePct}%</div>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="font-body text-xs text-charcoal/60 mb-1">Quiet members</div>
                  <div className="font-display text-2xl text-amber-600">{d.members.atRiskCount}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-sage/20 bg-white-warm">
            <CardHeader>
              <CardTitle className="font-display text-xl text-charcoal flex items-center gap-2">
                🔥 Streak leaders
              </CardTitle>
              <CardDescription>Current streak</CardDescription>
            </CardHeader>
            <CardContent>
              {d.members.leaderboard.length === 0 ? (
                <p className="font-body text-sm text-charcoal/50 text-center py-6">No streak data</p>
              ) : (
                <div className="space-y-3">
                  {d.members.leaderboard.map((member, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="shrink-0 w-8 h-8 rounded-full bg-sage/10 flex items-center justify-center">
                        <span className="font-display text-sm text-sage">#{idx + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-body text-sm text-charcoal truncate mb-1">{member.name}</div>
                        <div className="h-2 bg-sage/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-linear-to-r from-sage to-sage/60 rounded-full transition-all duration-600"
                            style={{ width: `${barPct(member.streak, d.members.streakMax)}%` }}
                          />
                        </div>
                      </div>
                      <Badge className="bg-sage text-white shrink-0">{member.streak}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div>
        <h3 className="font-display text-2xl text-charcoal mb-4">Instructors (this month)</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-sage/20 bg-white-warm lg:col-span-2">
            <CardHeader>
              <CardTitle className="font-display text-xl text-charcoal flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-sage" />
                Check-ins
              </CardTitle>
            </CardHeader>
            <CardContent>
              {d.instructors.comparison.length === 0 ? (
                <p className="font-body text-sm text-charcoal/50 py-8 text-center">No data</p>
              ) : (
                <div className="space-y-3">
                  {d.instructors.comparison.map((inst, idx) => (
                    <div key={`${inst.name}-${idx}`}>
                      <div className="flex justify-between mb-1">
                        <span className="font-body text-sm font-medium">{inst.name}</span>
                        <span className="font-body text-sm text-sage">{inst.checkIns}</span>
                      </div>
                      <div className="h-3 bg-sage/10 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-sage transition-all duration-600"
                          style={{ width: `${barPct(inst.checkIns, inst.maxScale)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-sage/20 bg-white-warm">
            <CardHeader>
              <CardTitle className="font-display text-xl text-charcoal flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-sage" />
                Top earners (est.)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {d.instructors.topEarners.length === 0 ? (
                  <p className="text-sm text-charcoal/50 text-center py-8 font-body">—</p>
                ) : (
                  d.instructors.topEarners.map((inst, idx) => (
                    <div key={`${inst.name}-${idx}`} className="p-3 bg-sage/5 rounded-lg border border-sage/20">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-body text-sm font-medium text-charcoal">{inst.name}</div>
                        <Badge variant="outline" className="border-sage/20 text-sage bg-sage/5">
                          {inst.sharePct}%
                        </Badge>
                      </div>
                      <div className="font-display text-2xl text-sage">
                        ₹{inst.earnings.toLocaleString("en-IN")}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-sage/20 bg-white-warm">
            <CardHeader>
              <CardTitle className="font-display text-xl text-charcoal flex items-center gap-2">
                <Calendar className="h-5 w-5 text-sage" />
                Scheduled slots
              </CardTitle>
            </CardHeader>
            <CardContent>
              {d.instructors.classesTaught.length === 0 ? (
                <p className="text-sm text-charcoal/50 py-8 text-center font-body">—</p>
              ) : (
                <div className="space-y-3">
                  {d.instructors.classesTaught.map((row, idx) => (
                    <div key={`${row.name}-${idx}`}>
                      <div className="flex justify-between mb-1">
                        <span className="font-body text-sm">{row.name}</span>
                        <span className="font-body text-sm font-medium text-sage">{row.classes}</span>
                      </div>
                      <div className="h-2 bg-sage/10 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-sage"
                          style={{ width: `${barPct(row.classes, row.maxScale)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div>
        <h3 className="font-display text-2xl text-charcoal mb-4 flex items-center gap-2">
          <Calendar className="h-6 w-6 text-sage" />
          Classes (this month)
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-sage/20 bg-white-warm lg:col-span-2">
            <CardHeader>
              <CardTitle className="font-display text-xl text-charcoal flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-sage" />
                Bookings by class type
              </CardTitle>
            </CardHeader>
            <CardContent>
              {d.classes.popularity.length === 0 ? (
                <p className="text-sm text-charcoal/50 py-8 text-center font-body">No bookings</p>
              ) : (
                <div className="space-y-3">
                  {d.classes.popularity.map((cls, idx) => (
                    <div key={`${cls.name}-${idx}`}>
                      <div className="flex justify-between mb-1">
                        <span className="font-body text-sm font-medium">{cls.name}</span>
                        <span className="font-body text-sm text-sage">{cls.bookings}</span>
                      </div>
                      <div className="h-3 bg-sage/10 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-linear-to-r from-sage to-sage/60 transition-all duration-600"
                          style={{ width: `${barPct(cls.bookings, cls.maxScale)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-sage/20 bg-white-warm">
            <CardHeader>
              <CardTitle className="font-display text-xl text-charcoal flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-sage" />
                Utilization estimate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {d.classes.occupancy.length === 0 ? (
                  <p className="text-sm text-charcoal/50 py-8 text-center font-body">No data</p>
                ) : (
                  d.classes.occupancy.map((cls, idx) => (
                    <div key={`${cls.name}-${idx}`}>
                      <div className="flex justify-between mb-1">
                        <span className="font-body text-sm">{cls.name}</span>
                        <Badge className={statusClasses(cls.status)}>{cls.occupancy}%</Badge>
                      </div>
                      <div className="h-2 bg-sage/10 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${barFillClasses(cls.status)}`}
                          style={{ width: `${cls.occupancy}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-sage/20 bg-white-warm">
            <CardHeader>
              <CardTitle className="font-display text-xl text-charcoal flex items-center gap-2">
                <Clock className="h-5 w-5 text-sage" />
                Peak booking hours
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {d.classes.peakHours.length === 0 ? (
                  <p className="text-sm text-charcoal/50 py-8 text-center font-body">—</p>
                ) : (
                  d.classes.peakHours.map((slot, idx) => (
                    <div key={`${slot.label}-${idx}`}>
                      <div className="flex justify-between mb-1">
                        <span className="font-body text-xs text-charcoal/70">{slot.label}</span>
                        <span className="font-body text-xs font-medium text-sage">{slot.bookings}</span>
                      </div>
                      <div className="h-6 bg-sage/10 rounded overflow-hidden">
                        <div
                          className="h-full bg-linear-to-r from-sage via-sage/80 to-sage/60 transition-all duration-600"
                          style={{ width: `${slot.intensity}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div>
        <h3 className="font-display text-2xl text-charcoal mb-4">🎯 KPIs</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-sage/20 bg-white-warm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="font-body text-sm text-charcoal/60">Revenue / member (prev month)</div>
                <TrendingUp className="h-4 w-4 text-sage" />
              </div>
              <div className="font-display text-3xl text-charcoal mb-1">₹{d.kpis.revenuePerMember}</div>
              <Badge className="bg-sage/10 text-sage border-sage/20">
                {d.kpis.revenuePerMemberGrowthPct !== null
                  ? `${d.kpis.revenuePerMemberGrowthPct > 0 ? "+" : ""}${d.kpis.revenuePerMemberGrowthPct}%`
                  : "—"}
              </Badge>
            </CardContent>
          </Card>

          <Card className="border-sage/20 bg-white-warm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="font-body text-sm text-charcoal/60">Utilization (30d)</div>
                <BarChart3 className="h-4 w-4 text-sage" />
              </div>
              <div className="font-display text-3xl text-charcoal mb-1">{d.kpis.classUtilization}%</div>
              <Badge className="bg-sage/10 text-sage border-sage/20">estimate</Badge>
            </CardContent>
          </Card>

          <Card className="border-sage/20 bg-white-warm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="font-body text-sm text-charcoal/60">Surveys</div>
                <CheckCircle2 className="h-4 w-4 text-sage" />
              </div>
              <div className="font-display text-3xl text-charcoal mb-1">—</div>
              <Badge className="bg-sage/10 text-sage border-sage/20">not in app</Badge>
            </CardContent>
          </Card>

          <Card className="border-sage/20 bg-white-warm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="font-body text-sm text-charcoal/60">Café overlap 30d</div>
                <Coffee className="h-4 w-4 text-sage" />
              </div>
              <div className="font-display text-3xl text-charcoal mb-1">{d.kpis.cafeAttachPct}%</div>
              <Badge className="bg-sage/10 text-sage border-sage/20">unique buyers vs active members</Badge>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
