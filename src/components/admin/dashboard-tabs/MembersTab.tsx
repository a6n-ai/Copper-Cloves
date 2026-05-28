import { memo, useCallback, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUpDown,
  Award,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  Flame,
  Star,
  Trophy,
  UserCheck,
  Users,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { MetricCard } from "@/components/admin/MetricCard";
import { ListAvatar } from "@/components/admin/ListAvatar";
import { Pagination, usePagination } from "@/components/Pagination";

// Recharts MUST be static (see InstructorsTab.tsx comment). Tab itself is dynamic-loaded.
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

export interface MemberStats {
  memberOfMonth: { name: string; classes: number; streak: number };
  topClass: { name: string; bookings: number };
  weeklyStreak: { average: number; top: number };
  onTimeCheckIns: number;
  lateCheckIns: number;
  checkInSample: number;
  onTimeCheckInPct: number;
  lateCheckInPct: number;
  noShows: number;
  expiring7Days: number;
  expiring15Days: number;
  expiring30Days: number;
  premiumActive: number;
  specialtyActive: number;
  inactiveUsers: number;
  totalMembers: number;
  activeMembers: number;
  studioPassActive: number;
  classPassActive: number;
  checkInsThisMonth: number;
  memberGrowth: { month: string; growth: number }[];
  streakDistribution: { range: string; count: number }[];
}

type SortKey = "name" | "streak" | "onTime" | "late" | "noShow";

interface Props {
  memberList: Record<string, unknown>[];
  memberStats: MemberStats;
  selectedMember: string;
  onSelectMember: (v: string) => void;
  onViewProfile: (member: Record<string, unknown>) => void;
}

const isStudioPkg = (pkg: string) =>
  pkg.includes("studio") || pkg.includes("aerial") || pkg.includes("special") || pkg.includes("unlimited");

function MembersTabImpl({
  memberList,
  memberStats,
  selectedMember,
  onSelectMember,
  onViewProfile,
}: Props) {
  const [perfSortKey, setPerfSortKey] = useState<SortKey | null>(null);
  const [perfSortDir, setPerfSortDir] = useState<"asc" | "desc">("desc");

  const filteredMemberList = useMemo(
    () =>
      memberList.filter((m) => {
        if (selectedMember === "all") return true;
        const pkg = String((m as { package?: string }).package ?? "").toLowerCase();
        const credits = Number((m as { credits?: number }).credits ?? 0);
        const active = Boolean((m as { isUnlimited?: boolean }).isUnlimited) || credits > 0;
        if (selectedMember === "studio") return active && isStudioPkg(pkg);
        if (selectedMember === "class") return active && !isStudioPkg(pkg);
        if (selectedMember === "active") return active;
        if (selectedMember === "inactive") return !active;
        return true;
      }),
    [memberList, selectedMember],
  );

  const filteredMemberStats = useMemo(() => {
    const sum = (k: string) =>
      filteredMemberList.reduce((s, m) => s + (Number((m as Record<string, unknown>)[k]) || 0), 0);
    const onTime = sum("onTime");
    const late = sum("late");
    const noShows = sum("noShow");
    const sample = onTime + late;
    const isPremium = (pkg: string) => pkg.includes("premium");
    const isSpecialty = (pkg: string) =>
      pkg.includes("aerial") || pkg.includes("special") || pkg.includes("unlimited");
    let premiumActive = 0;
    let specialtyActive = 0;
    let inactive = 0;
    let active = 0;
    let studio = 0;
    let classPass = 0;
    for (const m of filteredMemberList) {
      const pkg = String((m as { package?: string }).package ?? "").toLowerCase();
      const credits = Number((m as { credits?: number }).credits ?? 0);
      if (credits <= 0) {
        inactive += 1;
      } else {
        active += 1;
        if (isSpecialty(pkg)) studio += 1;
        else classPass += 1;
      }
      if (credits > 0 && isPremium(pkg)) premiumActive += 1;
      if (credits > 0 && isSpecialty(pkg)) specialtyActive += 1;
    }
    return {
      onTimeCheckIns: onTime,
      lateCheckIns: late,
      noShows,
      checkInSample: sample,
      onTimeCheckInPct: sample > 0 ? Math.round((onTime / sample) * 100) : 0,
      lateCheckInPct: sample > 0 ? Math.round((late / sample) * 100) : 0,
      premiumActive,
      specialtyActive,
      inactiveUsers: inactive,
      activeMembers: active,
      studioPassActive: studio,
      classPassActive: classPass,
    };
  }, [filteredMemberList]);

  const displayedMemberStats = useMemo(
    () => (selectedMember !== "all" ? { ...memberStats, ...filteredMemberStats } : memberStats),
    [selectedMember, memberStats, filteredMemberStats],
  );
  const activeMemberTierTotal = useMemo(
    () => displayedMemberStats.studioPassActive + displayedMemberStats.classPassActive,
    [displayedMemberStats.studioPassActive, displayedMemberStats.classPassActive],
  );

  const sortedMemberList = useMemo(() => {
    if (!perfSortKey) return filteredMemberList;
    const dir = perfSortDir === "asc" ? 1 : -1;
    return [...filteredMemberList].sort((a, b) => {
      const aa = a as Record<string, unknown>;
      const bb = b as Record<string, unknown>;
      const cmp =
        perfSortKey === "name"
          ? String(aa.name ?? "").localeCompare(String(bb.name ?? ""))
          : (Number(aa[perfSortKey]) || 0) - (Number(bb[perfSortKey]) || 0);
      return cmp * dir;
    });
  }, [filteredMemberList, perfSortKey, perfSortDir]);

  // Don't nest setPerfSortDir inside setPerfSortKey updater — StrictMode double-
  // invocation flips direction back. Read latest key via ref.
  const perfSortKeyRef = useRef(perfSortKey);
  perfSortKeyRef.current = perfSortKey;
  const togglePerfSort = useCallback((key: SortKey) => {
    if (perfSortKeyRef.current === key) {
      setPerfSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setPerfSortKey(key);
      setPerfSortDir(key === "name" ? "asc" : "desc");
    }
  }, []);

  const perfSortIcon = (key: SortKey) =>
    perfSortKey === key ? (
      perfSortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
    ) : (
      <ArrowUpDown className="h-3 w-3 opacity-40" />
    );

  const membersPg = usePagination(sortedMemberList, 10, `${selectedMember}|${perfSortKey}|${perfSortDir}`);

  const activeInactivePieData = useMemo(() => {
    const active = displayedMemberStats.activeMembers ?? 0;
    const inactive = displayedMemberStats.inactiveUsers ?? 0;
    const total = active + inactive;
    const activePct = total > 0 ? Math.round((active / total) * 100) : 0;
    return { active, inactive, activePct, data: [{ name: "Active", value: active }, { name: "Inactive", value: inactive }] };
  }, [displayedMemberStats.activeMembers, displayedMemberStats.inactiveUsers]);

  return (
    <>
      <div className="rounded-xl border border-sage/20 bg-white/60 backdrop-blur-xl p-3">
        <div className="font-body text-sm font-medium text-charcoal">Metrics scope</div>
        <div className="font-body text-xs text-charcoal/60">
          {selectedMember === "all"
            ? "Showing stats across all members"
            : `Showing stats from the ${filteredMemberList.length} member(s) matching the current filter`}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <MetricCard label="Total Members" value={memberStats.totalMembers} icon={Users} tone="sage" />
        <MetricCard label="Active" value={memberStats.activeMembers} icon={UserCheck} tone="sage" hint="Holding an active pass" />
        <MetricCard label="Studio Pass" value={memberStats.studioPassActive} icon={Trophy} tone="sage" hint="Active studio passes" />
        <MetricCard label="Class Pass" value={memberStats.classPassActive} icon={CreditCard} tone="sage" hint="Active class passes" />
        <MetricCard label="Check-ins (mo)" value={memberStats.checkInsThisMonth} icon={Calendar} tone="amber" hint="This month" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-sage/20 bg-white/95 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="font-display text-xl text-charcoal">Member Growth</CardTitle>
            <CardDescription className="font-body text-charcoal/60">New member signups over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{ growth: { label: "New members", color: "#8F9779" } }} className="h-[240px] w-full">
              <BarChart data={memberStats.memberGrowth} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E5E5E0" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#6B6B6B" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#6B6B6B" }} width={32} />
                <ChartTooltip cursor={{ fill: "rgba(143,151,121,0.05)" }} content={<ChartTooltipContent />} />
                <Bar dataKey="growth" fill="var(--color-growth)" radius={[6, 6, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="border-sage/20 bg-white/95 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="font-display text-xl text-charcoal">Member Activity Status</CardTitle>
            <CardDescription className="font-body text-charcoal/60">Active vs inactive members</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{ Active: { label: "Active", color: "#8F9779" }, Inactive: { label: "Inactive", color: "#D1D5DB" } }} className="mx-auto aspect-square max-h-[200px]">
              <RechartsPieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Pie data={activeInactivePieData.data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} strokeWidth={2} stroke="#FFFFFF">
                  <Cell fill="#8F9779" />
                  <Cell fill="#D1D5DB" />
                  <RechartsLabel
                    position="center"
                    content={({ viewBox }) => {
                      if (!viewBox || !("cx" in viewBox)) return null;
                      const cx = viewBox.cx ?? 0;
                      const cy = viewBox.cy ?? 0;
                      return (
                        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                          <tspan x={cx} y={cy - 4} fill="#333333" fontSize="22" fontWeight="600">{activeInactivePieData.activePct}%</tspan>
                          <tspan x={cx} y={cy + 16} fill="#6B6B6B" fontSize="10">Active</tspan>
                        </text>
                      );
                    }}
                  />
                </Pie>
              </RechartsPieChart>
            </ChartContainer>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="p-3 rounded-lg bg-sage/5 border border-sage/20">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-sage" />
                  <span className="font-body text-xs text-charcoal/60">Active</span>
                </div>
                <div className="font-display text-2xl text-sage tabular-nums">{activeInactivePieData.active}</div>
              </div>
              <div className="p-3 rounded-lg bg-charcoal/5 border border-charcoal/20">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-charcoal/40" />
                  <span className="font-body text-xs text-charcoal/60">Inactive</span>
                </div>
                <div className="font-display text-2xl text-charcoal tabular-nums">{activeInactivePieData.inactive}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-sage/20 bg-white/95 backdrop-blur-xl lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-display text-xl text-charcoal">Streak Distribution</CardTitle>
            <CardDescription className="font-body text-charcoal/60">Members by current streak length (days)</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{ count: { label: "Members", color: "#8F9779" } }} className="h-[220px] w-full">
              <BarChart data={memberStats.streakDistribution} layout="vertical" margin={{ top: 8, right: 24, left: 16, bottom: 0 }}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#E5E5E0" />
                <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#6B6B6B" }} />
                <YAxis dataKey="range" type="category" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#6B6B6B" }} width={70} />
                <ChartTooltip cursor={{ fill: "rgba(143,151,121,0.05)" }} content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={[0, 6, 6, 0]} maxBarSize={28} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="border-sage/20 bg-linear-to-br from-sage/5 to-white backdrop-blur-xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-display text-2xl text-charcoal flex items-center gap-2">
                <Trophy className="h-6 w-6 text-amber-500" />
                Member of the Month
              </CardTitle>
              <CardDescription className="font-body text-charcoal/60 mt-1">Top performer this month</CardDescription>
            </div>
            <Award className="h-12 w-12 text-sage/20" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-6 p-6 rounded-xl bg-white border border-sage/20">
            <div className="h-20 w-20 rounded-full bg-sage/10 flex items-center justify-center">
              <Star className="h-10 w-10 text-sage" />
            </div>
            <div className="flex-1 min-w-[180px]">
              <div className="font-display text-3xl text-charcoal mb-2">{memberStats.memberOfMonth.name}</div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-charcoal/60">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span className="font-body">{memberStats.memberOfMonth.classes} classes</span>
                </div>
                <div className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-terracotta" />
                  <span className="font-body">{memberStats.memberOfMonth.streak} day streak</span>
                </div>
              </div>
            </div>
            <Button variant="sage">View Profile</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-amber-500/20 bg-linear-to-br from-amber-50 to-white backdrop-blur-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-body text-sm text-charcoal/60 font-medium">Expiring in 7 Days</CardTitle>
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-display text-5xl text-charcoal mb-3">{memberStats.expiring7Days}</div>
            <Button variant="outline" size="sm" className="w-full border-amber-500/20 text-amber-600 hover:bg-amber-50 font-body">Add to CRM</Button>
          </CardContent>
        </Card>

        <Card className="border-amber-500/20 bg-linear-to-br from-amber-50/50 to-white backdrop-blur-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-body text-sm text-charcoal/60 font-medium">Expiring in 15 Days</CardTitle>
              <Clock className="h-5 w-5 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-display text-5xl text-charcoal mb-3">{memberStats.expiring15Days}</div>
            <Button variant="outline" size="sm" className="w-full border-amber-500/20 text-amber-600 hover:bg-amber-50 font-body">Add to CRM</Button>
          </CardContent>
        </Card>

        <Card className="border-sage/20 bg-white/95 backdrop-blur-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-body text-sm text-charcoal/60 font-medium">Expiring in 30 Days</CardTitle>
              <Calendar className="h-5 w-5 text-sage" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-display text-5xl text-charcoal mb-3">{memberStats.expiring30Days}</div>
            <Button variant="outline" size="sm" className="w-full border-sage/20 text-sage hover:bg-sage/5 font-body">View List</Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-sage/20 bg-white/95 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="font-display text-2xl text-charcoal">Active Members by Pass Type</CardTitle>
          <CardDescription className="font-body text-charcoal/60">Distribution across membership tiers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-sage text-white">Studio Pass</Badge>
                  <span className="font-body text-charcoal/60">{displayedMemberStats.studioPassActive} members</span>
                </div>
                <span className="font-body font-medium text-charcoal">
                  {activeMemberTierTotal > 0
                    ? ((displayedMemberStats.studioPassActive / activeMemberTierTotal) * 100).toFixed(0)
                    : "0"}
                  %
                </span>
              </div>
              <Progress
                value={activeMemberTierTotal > 0 ? (displayedMemberStats.studioPassActive / activeMemberTierTotal) * 100 : 0}
                className="h-3 bg-sage/10"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-terracotta/20 text-terracotta">Class Pass</Badge>
                  <span className="font-body text-charcoal/60">{displayedMemberStats.classPassActive} members</span>
                </div>
                <span className="font-body font-medium text-charcoal">
                  {activeMemberTierTotal > 0
                    ? ((displayedMemberStats.classPassActive / activeMemberTierTotal) * 100).toFixed(0)
                    : "0"}
                  %
                </span>
              </div>
              <Progress
                value={activeMemberTierTotal > 0 ? (displayedMemberStats.classPassActive / activeMemberTierTotal) * 100 : 0}
                className="h-3 bg-terracotta/10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-sage/20 bg-white/95 backdrop-blur-xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-display text-2xl text-charcoal">Member Performance</CardTitle>
              <CardDescription className="font-body text-charcoal/60">Detailed check-in and attendance stats</CardDescription>
            </div>
            <Select value={selectedMember} onValueChange={onSelectMember}>
              <SelectTrigger className="w-48 border-sage/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                <SelectItem value="studio">Studio Pass</SelectItem>
                <SelectItem value="class">Class Pass</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="inactive">Inactive Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-sage/15 bg-white overflow-hidden">
            <ResponsiveTable>
              <Table>
                <TableHeader>
                  <TableRow className="bg-sage/5 hover:bg-sage/5 border-sage/10">
                    <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3">
                      <button type="button" onClick={() => togglePerfSort("name")} className="inline-flex items-center gap-1 uppercase hover:text-charcoal transition-colors">
                        Member {perfSortIcon("name")}
                      </button>
                    </TableHead>
                    <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3 w-[160px]">Package</TableHead>
                    <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3 w-[80px]">
                      <button type="button" onClick={() => togglePerfSort("streak")} className="inline-flex items-center gap-1 uppercase hover:text-charcoal transition-colors">
                        Streak {perfSortIcon("streak")}
                      </button>
                    </TableHead>
                    <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3 w-[80px]">
                      <button type="button" onClick={() => togglePerfSort("onTime")} className="inline-flex items-center gap-1 uppercase hover:text-charcoal transition-colors">
                        On Time {perfSortIcon("onTime")}
                      </button>
                    </TableHead>
                    <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3 w-[70px]">
                      <button type="button" onClick={() => togglePerfSort("late")} className="inline-flex items-center gap-1 uppercase hover:text-charcoal transition-colors">
                        Late {perfSortIcon("late")}
                      </button>
                    </TableHead>
                    <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3 w-[90px]">
                      <button type="button" onClick={() => togglePerfSort("noShow")} className="inline-flex items-center gap-1 uppercase hover:text-charcoal transition-colors">
                        No-Show {perfSortIcon("noShow")}
                      </button>
                    </TableHead>
                    <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3 w-[80px] text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {membersPg.pageItems.map((member) => {
                    const m = member as Record<string, unknown>;
                    return (
                      <TableRow key={`${(m.profileId as string) ?? "p"}-${m.id}`} className="border-sage/10">
                        <TableCell className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <ListAvatar name={String(m.name ?? "?")} src={(m.avatarUrl as string) ?? null} size="sm" ringClassName="ring-sage/20" />
                            <div className="min-w-0">
                              <div className="font-body font-medium text-charcoal truncate">{m.name as string}</div>
                              <div className="font-body text-xs text-charcoal/50">{m.isUnlimited ? "∞ Unlimited" : `${m.credits} credits`}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-5 py-3">
                          <Badge variant="outline" className="border-sage/20 text-sage bg-sage/5 font-body whitespace-nowrap">
                            {m.package as string}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-5 py-3 font-display text-base text-sage tabular-nums">{m.streak as number}</TableCell>
                        <TableCell className="px-5 py-3 font-display text-base text-charcoal tabular-nums">{m.onTime as number}</TableCell>
                        <TableCell className="px-5 py-3 font-display text-base text-amber-600 tabular-nums">{m.late as number}</TableCell>
                        <TableCell className="px-5 py-3 font-display text-base text-red-500 tabular-nums">{m.noShow as number}</TableCell>
                        <TableCell className="px-5 py-3 text-right">
                          <Button variant="sage-outline" size="sm" onClick={() => onViewProfile(m)} className="h-8">View</Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ResponsiveTable>
          </div>
          <Pagination page={membersPg.page} total={membersPg.total} onChange={membersPg.setPage} />
        </CardContent>
      </Card>
    </>
  );
}

export const MembersTab = memo(MembersTabImpl);
