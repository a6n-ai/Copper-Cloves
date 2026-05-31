import { memo, useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
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
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricCard } from "@/components/admin/MetricCard";
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
        <MetricCard label="Expiring This Week" value={overviewStats.expiringWeek} icon={AlertTriangle} tone="amber" loading={!overviewLoaded} />
        <MetricCard label="Month Revenue" value={Math.round(overviewStats.monthRevenue)} prefix="₹" icon={CreditCard} tone="sage" loading={!overviewLoaded} hint="+23% vs last month" />
        <MetricCard
          label="Café Orders"
          value={overviewStats.cafeOrders}
          icon={Coffee}
          tone="sage"
          loading={!overviewLoaded}
          footer={
            <Button variant="outline" size="sm" className="border-sage/20 text-sage hover:bg-sage/5 h-7 text-xs font-body" onClick={onOpenCafe}>
              View Queue
            </Button>
          }
        />
        <MetricCard label="Pending Waivers" value={overviewStats.pendingWaivers} icon={AlertTriangle} tone="amber" loading={!overviewLoaded} />
      </div>

      <Card className="border-sage/20 bg-white-warm overflow-x-hidden overflow-y-visible w-full min-w-0 max-w-full">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="font-display text-2xl text-charcoal">{dateTitle}</CardTitle>
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
                className="border-sage/40 text-sage bg-white hover:!bg-sage hover:!text-white hover:!border-sage h-9 w-9 p-0 transition-all"
                onClick={() => {
                  const prev = new Date(y, m - 1, d - 1);
                  onScheduleDateChange(iso(prev));
                }}
                aria-label="Previous day"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Input
                type="date"
                value={scheduleDate}
                onChange={(e) => onScheduleDateChange(e.target.value)}
                className="h-9 w-40 border-sage/40 font-body"
              />
              <Button
                variant="outline"
                size="sm"
                className="border-sage/40 text-sage bg-white hover:!bg-sage hover:!text-white hover:!border-sage h-9 w-9 p-0 transition-all"
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
                className="border-sage/40 text-sage bg-white hover:!bg-sage hover:!text-white hover:!border-sage h-9 font-body transition-all"
                onClick={() => onScheduleDateChange(todayIso)}
              >
                Today
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="min-w-0 max-w-full overflow-x-hidden overflow-y-visible">
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
                  <div key={i} className="shrink-0 w-[340px] rounded-2xl border border-sage/15 bg-white p-5">
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-display text-2xl text-charcoal flex items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-terracotta" />
                Members Expiring Soon
              </CardTitle>
              <CardDescription className="font-body text-charcoal/60 mt-1">
                {expiringMembers.length} memberships expiring in the next 14 days
              </CardDescription>
            </div>
            <Button onClick={onOpenCRM} variant="sage">Open CRM</Button>
          </div>
        </CardHeader>
        <CardContent>
          {selectedMembers.size > 0 && (
            <div className="mb-4 p-4 rounded-xl bg-sage/10 border border-sage/30 flex items-center justify-between">
              <p className="font-body text-sm text-charcoal">
                {selectedMembers.size} member{selectedMembers.size > 1 ? "s" : ""} selected
              </p>
              <div className="flex gap-2">
                <Button onClick={handleBulkNudge} size="sm" variant="sage">
                  <Zap size={14} className="mr-1" />
                  Nudge All ({selectedMembers.size})
                </Button>
                <Button
                  onClick={() => setSelectedMembers(new Set())}
                  size="sm"
                  variant="outline"
                  className="border-sage/30 text-charcoal hover:bg-sage/5"
                >
                  Clear
                </Button>
              </div>
            </div>
          )}

          <div className="mb-3 flex items-center gap-2 pb-2 border-b border-sage/10">
            <input
              type="checkbox"
              checked={selectedMembers.size === expiringMembers.length && expiringMembers.length > 0}
              onChange={handleSelectAll}
              className="w-4 h-4 accent-sage cursor-pointer"
            />
            <span className="font-body text-xs text-charcoal/60">Select all</span>
          </div>

          <div className="space-y-3">
            {expiringPg.pageItems.map((member) => (
              <div
                key={member.id}
                className="rounded-xl border border-terracotta/20 bg-white p-4 hover:shadow-md transition-all duration-600"
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedMembers.has(member.id)}
                    onChange={() => handleToggleMember(member.id)}
                    className="mt-1 w-4 h-4 shrink-0 accent-sage cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-body font-medium text-charcoal truncate">{member.name}</p>
                      <span className="shrink-0 rounded-full bg-terracotta/10 border border-terracotta/20 px-2.5 py-0.5 font-body text-xs font-medium text-terracotta whitespace-nowrap">
                        Expires in {member.expires}
                      </span>
                    </div>
                    <p className="font-body text-sm text-charcoal/55 truncate">{member.email}</p>
                    <p className="font-body text-xs text-charcoal/45 mt-0.5">
                      {member.package} Package · {member.credits} credits left
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2 pl-7">
                  <Button
                    onClick={() => onViewProfile(member as unknown as Record<string, unknown>)}
                    variant="outline"
                    size="sm"
                    className="flex-1 sm:flex-none border-sage/30 text-sage hover:bg-sage/5 font-body"
                  >
                    <Eye size={14} className="mr-1" />
                    View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 sm:flex-none border-terracotta/20 text-terracotta hover:bg-terracotta/10 font-body transition-all"
                    onClick={() => {
                      toast.success(`"The Ritual Renewal" CRM template instantly queued for ${member.name} via WhatsApp/Email!`);
                    }}
                  >
                    <Zap size={14} className="mr-1" />
                    Nudge
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <Pagination page={expiringPg.page} total={expiringPg.total} onChange={expiringPg.setPage} />
        </CardContent>
      </Card>
    </>
  );
}

export const OverviewTab = memo(OverviewTabImpl);
