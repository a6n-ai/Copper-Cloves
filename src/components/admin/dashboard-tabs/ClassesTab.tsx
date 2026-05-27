import { Fragment, memo, useCallback, useMemo } from "react";
import { AlertTriangle, Calendar, Star, TrendingUp, Users } from "lucide-react";
import { SortableHeader, useTableSort } from "@/components/admin/sortable-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import { Badge } from "@/components/ui/badge";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { MetricCard } from "@/components/admin/MetricCard";
import { Pagination, usePagination } from "@/components/Pagination";

// Recharts MUST be static — dynamic wrappers break child-type detection. The whole
// ClassesTab is dynamic-imported from dashboard.tsx so recharts still ships only when used.
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label as RechartsLabel,
  Pie,
  PieChart as RechartsPieChart,
  XAxis,
  YAxis,
} from "recharts";

const PIE_COLORS = ["#8F9779", "#D4A574", "#C4B8A8", "#B8A99A", "#6B7280", "#9CA3AF"];

export interface ClassRow {
  name: string;
  discipline: string;
  bookings: number;
  capacity: number;
  utilization: number;
}

export interface DisciplineRow {
  name: string;
  count: number;
}

export interface PeakHours {
  slots: string[];
  days: string[];
  grid: number[][];
  max: number;
}

interface Props {
  classPerformance: ClassRow[];
  disciplineSplit: DisciplineRow[];
  peakHours: PeakHours;
  classesLoaded: boolean;
}

function ClassesTabImpl({ classPerformance, disciplineSplit, peakHours, classesLoaded }: Props) {
  const stats = useMemo(() => {
    const total = classPerformance.length;
    const avgUtil = total > 0
      ? Math.round(classPerformance.reduce((s, c) => s + c.utilization, 0) / total)
      : 0;
    const totalBookings = classPerformance.reduce((s, c) => s + c.bookings, 0);
    const underperforming = classPerformance.filter((c) => c.utilization < 60);
    const topClass = [...classPerformance].sort((a, b) => b.utilization - a.utilization)[0];
    return { total, avgUtil, totalBookings, underperforming, topClass };
  }, [classPerformance]);

  type ClassSortKey = "name" | "discipline" | "spots" | "utilization";
  const getClassSortValue = useCallback((row: ClassRow, key: ClassSortKey): number | string => {
    switch (key) {
      case "name": return row.name;
      case "discipline": return row.discipline;
      case "spots": return row.bookings;
      case "utilization": return row.utilization;
    }
  }, []);
  const { sorted: sortedClasses, sortKey, sortDir, toggle } = useTableSort(classPerformance, {
    initialKey: "utilization",
    initialDir: "desc",
    getValue: getClassSortValue,
    defaultDirFor: (k) => (k === "name" || k === "discipline" ? "asc" : "desc"),
  });
  const classesPerfPg = usePagination(sortedClasses, 10, `${sortKey}|${sortDir}`);

  const disciplinePieConfig = useMemo(
    () =>
      Object.fromEntries(
        disciplineSplit.map((d, idx) => [d.name, { label: d.name, color: PIE_COLORS[idx % PIE_COLORS.length] }]),
      ),
    [disciplineSplit],
  );

  const disciplinePieData = useMemo(
    () => disciplineSplit.map((d) => ({ name: d.name, value: d.count })),
    [disciplineSplit],
  );

  const disciplineTotal = useMemo(
    () => disciplineSplit.reduce((s, d) => s + d.count, 0),
    [disciplineSplit],
  );

  const utilLeaderData = useMemo(
    () =>
      [...classPerformance]
        .sort((a, b) => b.utilization - a.utilization)
        .slice(0, 10)
        .map((c) => ({ name: c.name, utilization: c.utilization })),
    [classPerformance],
  );

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <MetricCard label="Total Classes" value={stats.total} icon={Calendar} tone="sage" loading={!classesLoaded} />
        <MetricCard label="Avg Utilization" value={stats.avgUtil} suffix="%" icon={TrendingUp} tone="sage" loading={!classesLoaded} />
        <MetricCard label="Bookings 30d" value={stats.totalBookings} icon={Users} tone="sage" loading={!classesLoaded} />
        <MetricCard label="Low Util" value={stats.underperforming.length} icon={AlertTriangle} tone="terracotta" loading={!classesLoaded} hint="Below 60% capacity" />
        <MetricCard label="Top Class" value={stats.topClass?.name ?? "—"} icon={Star} tone="amber" loading={!classesLoaded} hint={stats.topClass ? `${stats.topClass.utilization}% filled` : ""} />
      </div>

      <Card className="border-sage/20 bg-white/95 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="font-display text-2xl text-charcoal">Class Performance</CardTitle>
          <CardDescription className="font-body text-charcoal/60">Utilization and bookings per class type</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-sage/15 bg-white overflow-hidden">
            <ResponsiveTable>
              <Table>
                <TableHeader>
                  <TableRow className="bg-sage/5 hover:bg-sage/5 border-sage/10">
                    <SortableHeader sortKey="name" active={sortKey} dir={sortDir} onToggle={toggle}>Class</SortableHeader>
                    <SortableHeader sortKey="discipline" active={sortKey} dir={sortDir} onToggle={toggle} className="w-[160px]">Discipline</SortableHeader>
                    <SortableHeader sortKey="spots" active={sortKey} dir={sortDir} onToggle={toggle} className="w-[120px]">Spots</SortableHeader>
                    <SortableHeader sortKey="utilization" active={sortKey} dir={sortDir} onToggle={toggle} className="w-[220px]">Utilization</SortableHeader>
                    <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3 w-[120px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classesPerfPg.pageItems.map((cls) => {
                    const util = cls.utilization;
                    const statusColor =
                      util >= 75 ? "border-sage/30 text-sage bg-sage/5" :
                      util >= 50 ? "border-amber-500/20 text-amber-600 bg-amber-50" :
                      "border-red-500/30 text-red-600 bg-red-50";
                    const barColor =
                      util >= 75 ? "bg-sage" :
                      util >= 50 ? "bg-amber-500" :
                      "bg-red-500";
                    const status = util >= 75 ? "Strong" : util >= 50 ? "Steady" : "Low";
                    return (
                      <TableRow key={cls.name} className="border-sage/10">
                        <TableCell className="px-5 py-3 font-body font-medium text-charcoal">{cls.name}</TableCell>
                        <TableCell className="px-5 py-3">
                          <Badge variant="outline" className="border-sage/20 text-sage bg-sage/5 font-body whitespace-nowrap">{cls.discipline}</Badge>
                        </TableCell>
                        <TableCell className="px-5 py-3 font-body text-sm text-charcoal/70 tabular-nums whitespace-nowrap">
                          {cls.bookings} / {cls.capacity}
                        </TableCell>
                        <TableCell className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-1.5 flex-1 max-w-[160px] rounded-full bg-sage/10 overflow-hidden">
                              <div className={`h-full transition-all ${barColor}`} style={{ width: `${util}%` }} />
                            </div>
                            <span className="font-display text-sm text-charcoal tabular-nums whitespace-nowrap">{util}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="px-5 py-3">
                          <Badge variant="outline" className={`font-body whitespace-nowrap ${statusColor}`}>{status}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ResponsiveTable>
          </div>
          <Pagination page={classesPerfPg.page} total={classesPerfPg.total} onChange={classesPerfPg.setPage} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-sage/20 bg-white/95 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="font-display text-xl text-charcoal">Discipline Split</CardTitle>
            <CardDescription className="font-body text-charcoal/60">Bookings by category</CardDescription>
          </CardHeader>
          <CardContent>
            {disciplineSplit.length === 0 ? (
              <div className="h-[240px] flex items-center justify-center font-body text-sm text-charcoal/40">No bookings yet.</div>
            ) : (
              <ChartContainer config={disciplinePieConfig} className="mx-auto aspect-square max-h-[240px]">
                <RechartsPieChart>
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                  <Pie data={disciplinePieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} strokeWidth={2} stroke="#FFFFFF">
                    {disciplineSplit.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                    <RechartsLabel
                      position="center"
                      content={({ viewBox }) => {
                        if (!viewBox || !("cx" in viewBox)) return null;
                        const cx = viewBox.cx ?? 0;
                        const cy = viewBox.cy ?? 0;
                        return (
                          <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                            <tspan x={cx} y={cy - 4} fill="#333333" fontSize="22" fontWeight="600">{disciplineTotal}</tspan>
                            <tspan x={cx} y={cy + 16} fill="#6B6B6B" fontSize="10">bookings</tspan>
                          </text>
                        );
                      }}
                    />
                  </Pie>
                </RechartsPieChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-sage/20 bg-white/95 backdrop-blur-xl lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-display text-xl text-charcoal">Utilization Leaderboard</CardTitle>
            <CardDescription className="font-body text-charcoal/60">Top 10 classes by capacity fill</CardDescription>
          </CardHeader>
          <CardContent>
            {classPerformance.length === 0 ? (
              <div className="h-[280px] flex items-center justify-center font-body text-sm text-charcoal/40">No class data yet.</div>
            ) : (
              <ChartContainer config={{ utilization: { label: "Utilization %", color: "#8F9779" } }} className="h-[280px] w-full">
                <BarChart data={utilLeaderData} layout="vertical" margin={{ top: 4, right: 32, left: 0, bottom: 0 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#E5E5E0" />
                  <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#6B6B6B" }} tickFormatter={(v: number) => `${v}%`} />
                  <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#6B6B6B" }} width={180} interval={0} />
                  <ChartTooltip cursor={{ fill: "rgba(143,151,121,0.05)" }} content={<ChartTooltipContent formatter={(v) => `${v}%`} />} />
                  <Bar dataKey="utilization" fill="var(--color-utilization)" radius={[0, 6, 6, 0]} maxBarSize={20} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-sage/20 bg-white/95 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="font-display text-xl text-charcoal">Peak Hours Heatmap</CardTitle>
          <CardDescription className="font-body text-charcoal/60">
            Bookings by time slot × day of week · last 30 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          {peakHours.max === 0 ? (
            <div className="h-[240px] flex items-center justify-center font-body text-sm text-charcoal/40">
              No bookings yet to plot.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="overflow-x-auto">
                <div
                  className="inline-grid gap-1 min-w-full"
                  style={{ gridTemplateColumns: `auto repeat(${peakHours.days.length}, minmax(56px, 1fr))` }}
                >
                  <div />
                  {peakHours.days.map((d) => (
                    <div key={d} className="font-body text-[11px] text-charcoal/50 text-center uppercase tracking-wide pb-1">{d}</div>
                  ))}
                  {peakHours.slots.map((slot, rIdx) => (
                    <Fragment key={slot}>
                      <div className="font-body text-[11px] text-charcoal/60 pr-3 flex items-center justify-end whitespace-nowrap">{slot}</div>
                      {peakHours.days.map((day, cIdx) => {
                        const count = peakHours.grid[rIdx]?.[cIdx] ?? 0;
                        const intensity = peakHours.max > 0 ? count / peakHours.max : 0;
                        const opacity = count === 0 ? 0.06 : 0.18 + intensity * 0.82;
                        return (
                          <div
                            key={`${slot}-${day}`}
                            className="h-10 rounded-md flex items-center justify-center font-body text-xs font-medium transition-all hover:scale-[1.04] hover:shadow-md cursor-default"
                            style={{
                              backgroundColor: `rgba(143, 151, 121, ${opacity})`,
                              color: intensity > 0.55 ? "#FFFFFF" : "#333333",
                            }}
                            title={`${day} ${slot}: ${count} bookings`}
                          >
                            {count > 0 ? count : ""}
                          </div>
                        );
                      })}
                    </Fragment>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <span className="font-body text-[11px] text-charcoal/50">Less</span>
                {[0.1, 0.3, 0.5, 0.7, 0.95].map((op) => (
                  <div key={op} className="w-5 h-3 rounded-sm" style={{ backgroundColor: `rgba(143,151,121,${op})` }} />
                ))}
                <span className="font-body text-[11px] text-charcoal/50">More</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {stats.underperforming.length > 0 && (
        <Card className="border-red-500/20 bg-linear-to-br from-red-50 to-white backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="font-display text-xl text-charcoal flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Needs Attention
            </CardTitle>
            <CardDescription className="font-body text-charcoal/60">
              Classes below 60% capacity — consider rescheduling or promoting
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {stats.underperforming.map((cls) => (
                <div key={cls.name} className="flex items-center gap-2 rounded-full bg-white border border-red-500/20 px-3 py-1.5">
                  <span className="font-body text-sm text-charcoal">{cls.name}</span>
                  <Badge className="bg-red-500/10 text-red-600 border-red-500/20 font-body">
                    {cls.utilization}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

export const ClassesTab = memo(ClassesTabImpl);
