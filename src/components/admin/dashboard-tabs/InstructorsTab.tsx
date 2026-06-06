import { memo, useCallback, useMemo } from "react";
import { Award, Calendar, CreditCard, Star, TrendingUp, UserCheck } from "lucide-react";
import { SortableHeader, useTableSort } from "@/components/admin/sortable-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { MetricCard } from "@/components/admin/MetricCard";
import { ListAvatar } from "@/components/admin/ListAvatar";
import { Pagination, usePagination } from "@/components/Pagination";

// Recharts components MUST be statically imported — `next/dynamic` wrappers break
// recharts' child-type detection (BarChart looks at children's class to decide layout).
// This tab is itself loaded via next/dynamic from dashboard.tsx, so recharts JS still
// defers until the tab opens.
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

const PIE_COLORS = ["#8F9779", "#D4A574", "#C4B8A8", "#B8A99A", "#6B7280", "#9CA3AF"];

interface InstructorRow {
  name: string;
  rating: number;
  classes: number;
  totalCheckIns: number;
  avgAttendance: number;
  photo?: string | null;
}

interface DashboardInstructor {
  id: string;
  name: string;
}

interface Props {
  dashboardInstructors: DashboardInstructor[];
  instructorPerformance: InstructorRow[];
  selectedInstructor: string;
  onSelectInstructor: (v: string) => void;
}

function InstructorsTabImpl({
  dashboardInstructors,
  instructorPerformance,
  selectedInstructor,
  onSelectInstructor,
}: Props) {
  const filtered = useMemo(
    () =>
      selectedInstructor === "all"
        ? instructorPerformance
        : instructorPerformance.filter((i) => i.name === selectedInstructor),
    [instructorPerformance, selectedInstructor],
  );

  type InstructorSortKey = "name" | "rating" | "classes" | "totalCheckIns" | "avgAttendance" | "earnings";
  const getInstructorSortValue = useCallback((row: InstructorRow, key: InstructorSortKey): number | string => {
    switch (key) {
      case "name": return row.name;
      case "rating": return row.rating;
      case "classes": return row.classes;
      case "totalCheckIns": return row.totalCheckIns;
      case "avgAttendance": return row.avgAttendance;
      case "earnings": return row.totalCheckIns * 150;
    }
  }, []);
  const { sorted: sortedFiltered, sortKey, sortDir, toggle } = useTableSort(filtered, {
    initialKey: "totalCheckIns",
    initialDir: "desc",
    getValue: getInstructorSortValue,
    defaultDirFor: (k) => (k === "name" ? "asc" : "desc"),
  });

  const perfPg = usePagination(sortedFiltered, 10, `${selectedInstructor}|${sortKey}|${sortDir}`);

  const stats = useMemo(() => {
    const total = dashboardInstructors.length;
    const checkInsSum = filtered.reduce((s, i) => s + i.totalCheckIns, 0);
    const classesSum = filtered.reduce((s, i) => s + i.classes, 0);
    const totalPayout = checkInsSum * 150;
    const avgPerInstructor = total > 0 ? Math.round(totalPayout / total) : 0;
    const ratings = filtered.filter((i) => i.rating > 0).map((i) => i.rating);
    const avgRating = ratings.length > 0 ? ratings.reduce((s, r) => s + r, 0) / ratings.length : 0;
    const top = [...filtered].sort((a, b) => b.totalCheckIns - a.totalCheckIns)[0];
    const classTotal = filtered.reduce((s, i) => s + i.classes, 0) || 1;
    return { total, checkInsSum, classesSum, totalPayout, avgPerInstructor, avgRating, top, classTotal };
  }, [dashboardInstructors, filtered]);

  const pieConfig = useMemo(
    () =>
      Object.fromEntries(
        filtered.map((i, idx) => [i.name, { label: i.name, color: PIE_COLORS[idx % PIE_COLORS.length] }]),
      ),
    [filtered],
  );

  const pieData = useMemo(
    () => filtered.map((i) => ({ name: i.name, value: i.classes })),
    [filtered],
  );

  const earningsData = useMemo(
    () =>
      [...filtered]
        .sort((a, b) => b.totalCheckIns - a.totalCheckIns)
        .slice(0, 8)
        .map((i) => ({ name: i.name, earnings: i.totalCheckIns * 150 })),
    [filtered],
  );

  const attendanceData = useMemo(
    () => filtered.map((i) => ({ name: i.name, avgAttendance: i.avgAttendance })),
    [filtered],
  );

  const efficiencyData = useMemo(
    () =>
      filtered.map((i) => ({
        name: i.name,
        classes: i.classes,
        totalCheckIns: i.totalCheckIns,
        perClass: i.classes > 0 ? Number((i.totalCheckIns / i.classes).toFixed(1)) : 0,
      })),
    [filtered],
  );

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard label="Active Instructors" value={stats.total} icon={Award} tone="sage" />
        <MetricCard label="Check-Ins (30d)" value={stats.checkInsSum} icon={UserCheck} tone="sage" />
        <MetricCard label="Classes (30d)" value={stats.classesSum} icon={Calendar} tone="sage" />
        <MetricCard label="Avg Rating" value={stats.avgRating} decimals={1} icon={Star} tone="amber" />
        <MetricCard label="Total Payout" value={stats.totalPayout} prefix="₹" icon={CreditCard} tone="terracotta" hint={`Avg ₹${stats.avgPerInstructor.toLocaleString("en-IN")} / instructor`} />
        <MetricCard label="Top Performer" value={stats.top?.name ?? "—"} icon={TrendingUp} tone="terracotta" hint={stats.top ? `${stats.top.totalCheckIns} check-ins` : ""} />
      </div>

      <Card className="border-sage/20 bg-white-warm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="font-display text-2xl text-charcoal">Instructor Performance</CardTitle>
            <Select value={selectedInstructor} onValueChange={onSelectInstructor}>
              <SelectTrigger className="w-48 border-sage/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Instructors</SelectItem>
                {dashboardInstructors.map((ins) => (
                  <SelectItem key={ins.id} value={ins.name}>{ins.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-sage/15 bg-white-warm overflow-hidden">
            <ResponsiveTable>
              <Table>
                <TableHeader>
                  <TableRow className="bg-sage/5 hover:bg-sage/5 border-sage/10">
                    <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3 w-[60px]">Rank</TableHead>
                    <SortableHeader sortKey="name" active={sortKey} dir={sortDir} onToggle={toggle}>Instructor</SortableHeader>
                    <SortableHeader sortKey="rating" active={sortKey} dir={sortDir} onToggle={toggle} className="w-[110px]">Rating</SortableHeader>
                    <SortableHeader sortKey="classes" active={sortKey} dir={sortDir} onToggle={toggle} className="w-[100px]">Classes</SortableHeader>
                    <SortableHeader sortKey="totalCheckIns" active={sortKey} dir={sortDir} onToggle={toggle} className="w-[110px]">Check-Ins</SortableHeader>
                    <SortableHeader sortKey="avgAttendance" active={sortKey} dir={sortDir} onToggle={toggle} className="w-[130px]">Avg Attendance</SortableHeader>
                    <SortableHeader sortKey="earnings" active={sortKey} dir={sortDir} onToggle={toggle} className="w-[130px]">Earnings</SortableHeader>
                    <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3 w-[90px] text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {perfPg.pageItems.map((instructor, index) => {
                    const rank = (perfPg.page - 1) * perfPg.pageSize + index + 1;
                    return (
                      <TableRow key={instructor.name} className="border-sage/10">
                        <TableCell className="px-5 py-3">
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-sage/10 text-sage font-display text-xs">#{rank}</span>
                        </TableCell>
                        <TableCell className="px-5 py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <ListAvatar name={instructor.name} src={instructor.photo ?? null} size="md" ringClassName="ring-sage/20" />
                            <div className="font-body font-medium text-charcoal truncate">{instructor.name}</div>
                          </div>
                        </TableCell>
                        <TableCell className="px-5 py-3">
                          <div className="flex items-center gap-1">
                            <Star className="h-3.5 w-3.5 text-terracotta fill-terracotta" />
                            <span className="font-body text-sm text-charcoal tabular-nums">{instructor.rating}</span>
                          </div>
                        </TableCell>
                        <TableCell className="px-5 py-3 font-body text-sm text-charcoal tabular-nums">{instructor.classes}</TableCell>
                        <TableCell className="px-5 py-3 font-display text-base text-sage tabular-nums">{instructor.totalCheckIns}</TableCell>
                        <TableCell className="px-5 py-3 font-display text-base text-charcoal tabular-nums">{instructor.avgAttendance}</TableCell>
                        <TableCell className="px-5 py-3 font-display text-sm text-terracotta tabular-nums whitespace-nowrap">
                          ₹{(instructor.totalCheckIns * 150).toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell className="px-5 py-3 text-right">
                          <Button variant="sage-outline" size="sm" className="h-8">View</Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ResponsiveTable>
          </div>
          <Pagination page={perfPg.page} total={perfPg.total} onChange={perfPg.setPage} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-sage/20 bg-white-warm">
          <CardHeader>
            <CardTitle className="font-display text-xl text-charcoal">Class Share</CardTitle>
            <CardDescription className="font-body text-charcoal/60">Classes taught split by instructor</CardDescription>
          </CardHeader>
          <CardContent>
            {filtered.length === 0 || stats.classTotal === 0 ? (
              <div className="h-[240px] flex items-center justify-center font-body text-sm text-charcoal/40">No classes yet.</div>
            ) : (
              <ChartContainer config={pieConfig} className="h-[240px] w-full">
                <RechartsPieChart>
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} strokeWidth={2} stroke="#FFFFFF">
                    {filtered.map((inst, idx) => (
                      <Cell key={inst.name} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                    <RechartsLabel
                      position="center"
                      content={({ viewBox }) => {
                        if (!viewBox || !("cx" in viewBox)) return null;
                        const cx = viewBox.cx ?? 0;
                        const cy = viewBox.cy ?? 0;
                        return (
                          <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                            <tspan x={cx} y={cy - 4} fill="#333333" fontSize="22" fontWeight="600">{stats.classTotal}</tspan>
                            <tspan x={cx} y={cy + 16} fill="#6B6B6B" fontSize="10">classes</tspan>
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

        <Card className="border-sage/20 bg-white-warm">
          <CardHeader>
            <CardTitle className="font-display text-xl text-charcoal">Earnings Leaderboard</CardTitle>
            <CardDescription className="font-body text-charcoal/60">₹ payout this month per instructor</CardDescription>
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center font-body text-sm text-charcoal/40">No earnings yet.</div>
            ) : (
              <ChartContainer config={{ earnings: { label: "Earnings (₹)", color: "#C17856" } }} className="h-[260px] w-full">
                <BarChart data={earningsData} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#E5E5E0" />
                  <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#6B6B6B" }} tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} />
                  <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#6B6B6B" }} width={80} />
                  <ChartTooltip cursor={{ fill: "rgba(193,120,86,0.05)" }} content={<ChartTooltipContent formatter={(v) => `₹${Number(v).toLocaleString("en-IN")}`} />} />
                  <Bar dataKey="earnings" fill="var(--color-earnings)" radius={[0, 6, 6, 0]} maxBarSize={20} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-sage/20 bg-white-warm">
          <CardHeader>
            <CardTitle className="font-display text-xl text-charcoal">Avg Attendance</CardTitle>
            <CardDescription className="font-body text-charcoal/60">Members per class on average</CardDescription>
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center font-body text-sm text-charcoal/40">No attendance data yet.</div>
            ) : (
              <ChartContainer config={{ avgAttendance: { label: "Avg attendance", color: "#8F9779" } }} className="h-[260px] w-full">
                <BarChart data={attendanceData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E5E5E0" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#6B6B6B" }} interval={0} angle={-25} textAnchor="end" height={60} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#6B6B6B" }} width={28} />
                  <ChartTooltip cursor={{ fill: "rgba(143,151,121,0.05)" }} content={<ChartTooltipContent />} />
                  <Bar dataKey="avgAttendance" fill="var(--color-avgAttendance)" radius={[6, 6, 0, 0]} maxBarSize={22} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-sage/20 bg-white-warm">
        <CardHeader>
          <CardTitle className="font-display text-xl text-charcoal">Efficiency: Check-Ins vs Classes</CardTitle>
          <CardDescription className="font-body text-charcoal/60">Higher check-ins-per-class = stronger draw</CardDescription>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center font-body text-sm text-charcoal/40">No data yet.</div>
          ) : (
            <ChartContainer
              config={{
                classes: { label: "Classes", color: "#A3B18A" },
                totalCheckIns: { label: "Check-ins", color: "#8F9779" },
                perClass: { label: "Per class", color: "#C17856" },
              }}
              className="h-[280px] w-full"
            >
              <ComposedChart data={efficiencyData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E5E5E0" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#6B6B6B" }} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis yAxisId="left" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#6B6B6B" }} width={32} />
                <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#C17856" }} width={32} />
                <ChartTooltip cursor={{ fill: "rgba(143,151,121,0.05)" }} content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar yAxisId="left" dataKey="classes" fill="var(--color-classes)" radius={[6, 6, 0, 0]} maxBarSize={22} />
                <Bar yAxisId="left" dataKey="totalCheckIns" fill="var(--color-totalCheckIns)" radius={[6, 6, 0, 0]} maxBarSize={22} />
                <Line yAxisId="right" type="monotone" dataKey="perClass" stroke="var(--color-perClass)" strokeWidth={2.5} dot={{ r: 4, fill: "var(--color-perClass)" }} activeDot={{ r: 6 }} />
              </ComposedChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export const InstructorsTab = memo(InstructorsTabImpl);
