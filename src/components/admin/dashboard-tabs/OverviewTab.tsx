import { memo, useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Coffee,
  CreditCard,
  Eye,
  Flame,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/filters";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricCard } from "@/components/admin/MetricCard";
import { Pill } from "@/components/ui/pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import { TodayClassesCarousel } from "@/components/admin/TodayClassesCarousel";
import { Pagination } from "@/components/Pagination";
import { cn } from "@/lib/utils";

export interface OverviewStats {
  totalMembers: number;
  activeToday: number;
  expiringWeek: number;
  monthRevenue: number;
  cafeOrders: number;
  pendingWaivers: number;
}

export interface OverviewMeta {
  classesTodayCount: number;
  newMembersThisMonth: number;
}

export interface ExpiringMember {
  id: string;
  name: string;
  email: string;
  package: string;
  expires: string;
  credits: number;
}

interface PaginationState<T> {
  page: number;
  total: number;
  setPage: (n: number) => void;
  pageItems: T[];
}

interface PendingStatusChange {
  id: string;
  name: string;
  time: string;
  currentStatus?: string;
  newStatus: string;
}

interface Props {
  overviewStats: OverviewStats;
  overviewMeta: OverviewMeta;
  overviewLoaded: boolean;
  scheduleDate: string;
  onScheduleDateChange: (iso: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  todayClassesDetail: any[];
  todayClassesLoading: boolean;
  upcomingClasses: { id: string | number; scheduleId?: string; name: string; time: string; instructor: string; spots: string; status: string }[];
  expiringMembers: ExpiringMember[];
  expiringPg: PaginationState<ExpiringMember>;
  onManageClass: (scheduleId: string) => void;
  onStatusChange: (change: PendingStatusChange) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSelectClass: (cls: any) => void;
  onViewProfile: (member: Record<string, unknown>) => void;
  onOpenCRM: () => void;
  onOpenCafe: () => void;
}

type ExpiringSortCol = "name" | "package" | "expires";
function SortHead({
  label,
  col,
  sortKey,
  sortDir,
  onSort,
  className,
}: {
  label: string;
  col: ExpiringSortCol;
  sortKey: ExpiringSortCol | null;
  sortDir: "asc" | "desc";
  onSort: (c: ExpiringSortCol) => void;
  className?: string;
}) {
  const active = sortKey === col;
  const Icon = active ? (sortDir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(col)}
        className="inline-flex items-center gap-1 rounded font-body transition-colors hover:text-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-1"
      >
        {label}
        <Icon className={cn("h-3.5 w-3.5", active ? "text-sage" : "text-charcoal/30")} />
      </button>
    </TableHead>
  );
}

function OverviewTabImpl({
  overviewStats,
  overviewMeta,
  overviewLoaded,
  scheduleDate,
  onScheduleDateChange,
  todayClassesDetail,
  todayClassesLoading,
  upcomingClasses,
  expiringMembers,
  expiringPg,
  onManageClass,
  onStatusChange,
  onSelectClass,
  onViewProfile,
  onOpenCRM,
  onOpenCafe,
}: Props) {
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());

  const handleToggleMember = useCallback((memberId: string) => {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedMembers((prev) =>
      prev.size === expiringMembers.length ? new Set() : new Set(expiringMembers.map((m) => m.id)),
    );
  }, [expiringMembers]);

  const handleBulkNudge = useCallback(() => {
    const count = selectedMembers.size;
    toast.success(`"The Ritual Renewal" template queued for ${count} members via WhatsApp/Email!`);
    setSelectedMembers(new Set());
  }, [selectedMembers]);

  // Expiring table sort. Default (null) keeps the API order (soonest-first).
  const [sortKey, setSortKey] = useState<"name" | "package" | "expires" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const toggleSort = useCallback(
    (key: "name" | "package" | "expires") => {
      setSortDir((d) => (sortKey === key ? (d === "asc" ? "desc" : "asc") : "asc"));
      setSortKey(key);
      expiringPg.setPage(1);
    },
    [sortKey, expiringPg],
  );

  const sortedExpiring = useMemo(() => {
    if (!sortKey) return expiringMembers;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...expiringMembers].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "package") cmp = a.package.localeCompare(b.package);
      else {
        const da = parseInt(a.expires, 10);
        const db = parseInt(b.expires, 10);
        cmp = (Number.isNaN(da) ? 9999 : da) - (Number.isNaN(db) ? 9999 : db);
      }
      return cmp * dir;
    });
  }, [expiringMembers, sortKey, sortDir]);

  // When unsorted, defer to the parent's paginated slice; when sorted, page the
  // sorted copy locally (same 10/page as usePagination's default).
  const expiringPageItems = sortKey
    ? sortedExpiring.slice((expiringPg.page - 1) * 10, expiringPg.page * 10)
    : expiringPg.pageItems;

  // Rebuilding this 10-key shape per render forced TodayClassesCarousel to re-diff
  // every card on any parent state change (e.g. checkbox toggles).
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const carouselItems = useMemo(
    () =>
      (todayClassesDetail.length > 0 ? todayClassesDetail : upcomingClasses).map((cls: any) => ({
        id: cls.id,
        name: cls.name,
        time: cls.time,
        startIso: cls.startIso,
        endIso: cls.endIso,
        instructor: cls.instructor ?? "—",
        instructorAvatarUrl: cls.instructorAvatarUrl ?? null,
        enrolled: cls.enrolled ?? 0,
        capacity: cls.capacity ?? (cls.enrolled ?? 0),
        recurring: cls.recurring,
        status: cls.status,
        _raw: cls,
      })),
    [todayClassesDetail, upcomingClasses],
  );
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const iso = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;

  // Today/tomorrow/yesterday only change at midnight — recomputing per render
  // (the previous behavior) cost 3× `new Date()` + locale formatting every tick.
  const { todayIso, y, m, d, dateTitle } = useMemo(() => {
    const today = new Date();
    const todayIso = iso(today);
    const tom = new Date(today); tom.setDate(tom.getDate() + 1);
    const yest = new Date(today); yest.setDate(yest.getDate() - 1);
    const [y, m, d] = scheduleDate.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    const pretty = dt.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
    const dateTitle =
      scheduleDate === todayIso ? `Today · ${pretty}` :
      scheduleDate === iso(tom) ? `Tomorrow · ${pretty}` :
      scheduleDate === iso(yest) ? `Yesterday · ${pretty}` :
      pretty;
    return { todayIso, y, m, d, dateTitle };
  }, [scheduleDate]);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <MetricCard label="Total Members" value={overviewStats.totalMembers} icon={Users} tone="sage" loading={!overviewLoaded} hint={`+${overviewMeta.newMembersThisMonth} this month`} />
        <MetricCard label="Active Today" value={overviewStats.activeToday} icon={Flame} tone="terracotta" loading={!overviewLoaded} hint={`${overviewMeta.classesTodayCount} classes today`} />
        <MetricCard label="Expiring This Week" value={overviewStats.expiringWeek} icon={AlertTriangle} tone="clay" loading={!overviewLoaded} />
        <MetricCard label="Month Revenue" value={Math.round(overviewStats.monthRevenue)} prefix="₹" icon={CreditCard} tone="sage" loading={!overviewLoaded} hint="+23% vs last month" />
        <MetricCard
          label="Café Orders"
          value={overviewStats.cafeOrders}
          icon={Coffee}
          tone="sage"
          loading={!overviewLoaded}
          footer={
            <Button variant="outline" size="sm" className="border-sage/20 text-sage hover:bg-sage/5 h-7 text-xs font-body hover:text-sage!" onClick={onOpenCafe}>
              View Queue
            </Button>
          }
        />
        <MetricCard label="Pending Waivers" value={overviewStats.pendingWaivers} icon={AlertTriangle} tone="clay" loading={!overviewLoaded} />
      </div>

      <Card className="border-sage/20 bg-white-warm w-full min-w-0 max-w-full">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="font-body font-semibold text-2xl text-charcoal">{dateTitle}</CardTitle>
              <CardDescription className="font-body text-charcoal/60">
                {todayClassesDetail.length > 0
                  ? "Tap a class to see who checked in. Check-in opens for members 15 minutes before start."
                  : "No classes scheduled for this day."}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                className="border-sage/40 text-sage bg-white-warm hover:bg-sage! hover:text-cream! hover:border-sage! h-9 w-9 p-0 transition-all"
                onClick={() => {
                  const prev = new Date(y, m - 1, d - 1);
                  onScheduleDateChange(iso(prev));
                }}
                aria-label="Previous day"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <DatePicker
                value={scheduleDate}
                onChange={onScheduleDateChange}
                className="h-9 w-40"
              />
              <Button
                variant="outline"
                size="sm"
                className="border-sage/40 text-sage bg-white-warm hover:bg-sage! hover:text-cream! hover:border-sage! h-9 w-9 p-0 transition-all"
                onClick={() => {
                  const next = new Date(y, m - 1, d + 1);
                  onScheduleDateChange(iso(next));
                }}
                aria-label="Next day"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-sage/40 text-sage bg-white-warm hover:bg-sage! hover:text-cream! hover:border-sage! h-9 font-body transition-all"
                onClick={() => onScheduleDateChange(todayIso)}
              >
                Today
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="min-w-0 max-w-full">
          <div
            className={cn(
              "transition-opacity duration-200",
              todayClassesLoading && todayClassesDetail.length === 0
                ? "opacity-0"
                : todayClassesLoading
                  ? "opacity-50"
                  : "opacity-100",
            )}
          >
            {todayClassesLoading && todayClassesDetail.length === 0 ? (
              <div className="flex gap-4 w-full max-w-full overflow-hidden py-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="shrink-0 w-[340px] rounded-2xl border border-sage/15 bg-white-warm p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2 min-w-0 flex-1">
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                      </div>
                      <Skeleton className="h-6 w-16 rounded-full" />
                    </div>
                    <div className="mt-5 flex items-center gap-3">
                      <Skeleton className="h-9 w-9 rounded-full" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                    <Skeleton className="mt-5 h-1.5 w-full rounded-full" />
                    <div className="mt-4 flex gap-2">
                      <Skeleton className="h-8 flex-1 rounded-md" />
                      <Skeleton className="h-8 w-20 rounded-md" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <TodayClassesCarousel
                isToday={scheduleDate === todayIso}
                items={carouselItems}
                onManage={(row) => onManageClass(String(row.id))}
                onStatusChange={(row, newStatus) => {
                  onStatusChange({
                    id: String(row.id),
                    name: row.name,
                    time: row.time,
                    currentStatus: row.status,
                    newStatus,
                  });
                }}
                onSelect={(row) => onSelectClass(row._raw)}
                emptyText="No classes scheduled for this day."
              />
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-terracotta/20 bg-terracotta/5">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="font-body font-semibold text-2xl text-charcoal flex items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-terracotta" />
                Members Expiring Soon
              </CardTitle>
              <CardDescription className="font-body text-charcoal/60 mt-1">
                <span className="tabular-nums">{expiringMembers.length}</span>{" "}
                {expiringMembers.length === 1 ? "membership" : "memberships"} expiring in the next 14 days
              </CardDescription>
            </div>
            <Button
              onClick={onOpenCRM}
              variant="sage"
              className="transition-transform active:scale-[0.96]"
            >
              Open CRM
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {expiringMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-sage/20 bg-sage/5 px-6 py-12 text-center">
              <CheckCircle2 className="h-10 w-10 text-sage" />
              <p className="font-body font-semibold text-charcoal text-balance">No memberships expiring</p>
              <p className="font-body text-sm text-charcoal/55 text-pretty max-w-xs">
                Nothing lapses in the next 14 days — retention is looking healthy.
              </p>
            </div>
          ) : (
            <>
              {selectedMembers.size > 0 && (
                <div className="mb-4 flex items-center justify-between rounded-xl border border-sage/30 bg-sage/10 p-3">
                  <p className="font-body text-sm text-charcoal">
                    <span className="tabular-nums">{selectedMembers.size}</span> member{selectedMembers.size > 1 ? "s" : ""} selected
                  </p>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleBulkNudge}
                      size="sm"
                      variant="sage"
                      className="transition-transform active:scale-[0.96]"
                    >
                      <Zap size={14} className="mr-1" />
                      Nudge All (<span className="tabular-nums">{selectedMembers.size}</span>)
                    </Button>
                    <Button
                      onClick={() => setSelectedMembers(new Set())}
                      size="sm"
                      variant="outline"
                      className="border-sage/30 text-charcoal transition-transform hover:bg-sage/5 hover:text-charcoal! active:scale-[0.96]"
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              )}

              <div className="overflow-hidden rounded-xl border border-sage/15 bg-white-warm">
                <ResponsiveTable stack>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <label className="-m-2 flex h-10 w-10 cursor-pointer items-center justify-center p-2">
                            <input
                              type="checkbox"
                              checked={selectedMembers.size === expiringMembers.length && expiringMembers.length > 0}
                              onChange={handleSelectAll}
                              className="h-4 w-4 cursor-pointer accent-sage"
                              aria-label="Select all expiring members"
                            />
                          </label>
                        </TableHead>
                        <SortHead label="Member" col="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                        <SortHead label="Package" col="package" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="hidden sm:table-cell" />
                        <SortHead label="Expires" col="expires" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expiringPageItems.map((member) => {
                        const days = parseInt(member.expires, 10);
                        const d = Number.isNaN(days) ? 99 : days;
                        const tier = d <= 3 ? "danger" : d <= 7 ? "warning" : "info";
                        const countdown = d <= 0 ? "Today" : d === 1 ? "Tomorrow" : `${d} days`;
                        return (
                          <TableRow key={member.id} className="transition-colors hover:bg-sage/[0.04]">
                            <TableCell>
                              <label
                                className="-m-2 flex h-10 w-10 cursor-pointer items-center justify-center p-2"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedMembers.has(member.id)}
                                  onChange={() => handleToggleMember(member.id)}
                                  className="h-4 w-4 cursor-pointer accent-sage"
                                  aria-label={`Select ${member.name}`}
                                />
                              </label>
                            </TableCell>
                            <TableCell className="min-w-0">
                              <div className="truncate font-body font-medium text-charcoal">{member.name}</div>
                              <div className="truncate font-body text-xs text-charcoal/50">{member.email}</div>
                              <div className="truncate font-body text-xs text-charcoal/45 sm:hidden">{member.package}</div>
                            </TableCell>
                            <TableCell className="hidden font-body text-sm text-charcoal/60 sm:table-cell">{member.package}</TableCell>
                            <TableCell>
                              <Pill tone={tier} size="sm" icon={<CalendarClock className="h-3 w-3" />}>
                                <span className="tabular-nums">{countdown}</span>
                              </Pill>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  onClick={() => onViewProfile(member as unknown as Record<string, unknown>)}
                                  variant="outline"
                                  size="sm"
                                  className="border-sage/30 font-body text-sage transition-[transform,background-color,color] hover:bg-sage/5 hover:text-sage! active:scale-[0.96]"
                                >
                                  <Eye size={14} className="sm:mr-1" />
                                  <span className="hidden sm:inline">View</span>
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="border-terracotta/20 font-body text-terracotta transition-[transform,background-color,color] hover:bg-terracotta/10 hover:text-terracotta! active:scale-[0.96]"
                                  onClick={() => {
                                    toast.success(`"The Ritual Renewal" CRM template instantly queued for ${member.name} via WhatsApp/Email!`);
                                  }}
                                >
                                  <Zap size={14} className="sm:mr-1" />
                                  <span className="hidden sm:inline">Nudge</span>
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ResponsiveTable>
              </div>
              <Pagination page={expiringPg.page} total={expiringPg.total} onChange={expiringPg.setPage} />
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export const OverviewTab = memo(OverviewTabImpl);
