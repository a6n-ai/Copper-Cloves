import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { useRouter } from "next/router";
import type { GetServerSideProps } from "next";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { startOfMondayWeekLocal, endOfSundayWeekLocal } from "@/lib/calendarWeek";
import { Card, CardContent } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { bookingStatusPill, bookingPaymentPill, waiverPill } from "@/lib/pillMaps";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MetricCard } from "@/components/admin/MetricCard";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ResponsiveTable, ResponsiveCards } from "@/components/responsive/ResponsiveTable";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Calendar,
  CalendarX,
  Users,
  CheckCircle2,
  Clock,
  UserX,
  Hourglass,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { NavPrevButton, NavNextButton } from "@/components/ui/quick-actions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useStudioSWR } from "@/lib/swr";

function PartnerClassesSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 2 }).map((_, ci) => (
        <Card key={ci} className="border-sage/15 bg-white-warm">
          <CardContent className="p-5">
            {/* Header: title/time + capacity badges */}
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <Skeleton className="h-7 w-44" />
                <Skeleton className="h-4 w-56 mt-2" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-32 rounded-full" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            </div>

            {/* Capacity progress bar */}
            <Skeleton className="h-2 w-full rounded-full mb-4" />

            {/* Roster rows */}
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((__, bi) => (
                <div key={bi} className="flex items-center justify-between gap-3 py-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                    <div className="min-w-0 space-y-1.5">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-44" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-6 w-24 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

interface BookingRow {
  id: string;
  memberName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  checkedIn: boolean;
  checkInOutcome: string | null;
  extraGuests: number;
  status: string;
  confirmationStatus: string | null;
  hasWaiver: boolean;
  userId: string;
  invitedByUserId?: string | null;
}
interface ClassRow {
  id: string;
  className: string;
  category: string;
  instructorName: string;
  startTime: string;
  endTime: string;
  capacity: number;
  signups: number;
  openSpots: number;
  checkedInCount: number;
  status: string;
  bookings: BookingRow[];
}

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_HEADS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function dayKey(d: Date) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function fmtTime(iso: string) { return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }); }
function initials(name: string) { return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase(); }

export default function PartnerClasses() {
  const router = useRouter();
  const [actioningId, setActioningId] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [anchor, setAnchor] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(dayKey(new Date()));

  const { rangeStart, rangeEnd, gridDays, periodLabel } = useMemo(() => {
    if (viewMode === "week") {
      const start = startOfMondayWeekLocal(anchor);
      const end = endOfSundayWeekLocal(start);
      const gd = Array.from({ length: 7 }, (_, i) => addDays(start, i));
      const label = `${MONTHS[start.getMonth()].slice(0, 3)} ${start.getDate()} – ${MONTHS[end.getMonth()].slice(0, 3)} ${end.getDate()}, ${end.getFullYear()}`;
      return { rangeStart: start, rangeEnd: end, gridDays: gd, periodLabel: label };
    }
    const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const monthEnd = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    const start = startOfMondayWeekLocal(monthStart);
    const end = endOfSundayWeekLocal(startOfMondayWeekLocal(monthEnd));
    const count = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
    const gd = Array.from({ length: count }, (_, i) => addDays(start, i));
    const label = `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`;
    return { rangeStart: start, rangeEnd: end, gridDays: gd, periodLabel: label };
  }, [viewMode, anchor]);

  // Same URL shape the dashboard fetches — for the current week both hooks share
  // one SWR cache entry (dedupe / keepPreviousData).
  const swrKey = `/api/partner/classes?from=${encodeURIComponent(rangeStart.toISOString())}&to=${encodeURIComponent(rangeEnd.toISOString())}`;
  const { data: classesData, error: swrError, isLoading, mutate } = useStudioSWR<ClassRow[]>(swrKey);
  const classes = useMemo(() => classesData ?? [], [classesData]);
  const loading = isLoading;

  useEffect(() => {
    if ((swrError as (Error & { status?: number }) | undefined)?.status === 401) {
      router.replace("/partner/login");
    }
  }, [swrError, router]);

  const loadError = swrError && (swrError as Error & { status?: number }).status !== 401
    ? "Could not load classes. Please try again."
    : null;

  async function actionBooking(classId: string, bookingId: string, action: "confirm" | "reject") {
    setActioningId(bookingId);
    try {
      const res = await fetch("/api/partner/booking-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, action }),
      });
      if (res.status === 401) { router.replace("/partner/login"); return; }
      if (!res.ok) throw new Error();
      await mutate(
        (prev) =>
          (prev ?? []).map((c) => {
            if (c.id !== classId) return c;
            if (action === "confirm") {
              return { ...c, bookings: c.bookings.map((b) => (b.id === bookingId ? { ...b, confirmationStatus: "confirmed" } : b)) };
            }
            const removed = c.bookings.find((b) => b.id === bookingId);
            const freed = removed ? 1 + (removed.extraGuests ?? 0) : 1;
            return { ...c, bookings: c.bookings.filter((b) => b.id !== bookingId), signups: Math.max(0, c.signups - freed), openSpots: c.openSpots + freed };
          }),
        { revalidate: false },
      );
    } catch {
      toast.error("Could not update the booking. Please try again.");
    } finally {
      setActioningId(null);
    }
  }

  function shift(dir: -1 | 1) {
    setAnchor((a) => (viewMode === "week" ? addDays(a, dir * 7) : new Date(a.getFullYear(), a.getMonth() + dir, 1)));
  }
  function goToday() { setAnchor(new Date()); setSelectedDay(dayKey(new Date())); }

  const byDay = useMemo(() => {
    const m = new Map<string, ClassRow[]>();
    for (const c of classes) {
      const k = dayKey(new Date(c.startTime));
      const arr = m.get(k) ?? [];
      arr.push(c);
      m.set(k, arr);
    }
    return m;
  }, [classes]);

  const periodStats = useMemo(() => {
    let signups = 0, pending = 0, capacity = 0;
    for (const c of classes) {
      signups += c.signups;
      capacity += c.capacity;
      pending += c.bookings.filter((b) => b.confirmationStatus === "pending").length;
    }
    const avgUtil = capacity > 0 ? Math.round((signups / capacity) * 100) : 0;
    return { count: classes.length, signups, pending, avgUtil };
  }, [classes]);

  const todayKey = dayKey(new Date());
  const activeClasses = byDay.get(selectedDay) ?? [];
  const selDate = gridDays.find((d) => dayKey(d) === selectedDay) ?? null;

  return (
    <main className="max-w-5xl mx-auto px-4 py-4 sm:px-6 lg:px-8 lg:py-6 space-y-5">
      <PageHeader title="Classes" subtitle="Your weekly roster and bookings" />

      {/* Period metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Classes" value={periodStats.count} icon={Calendar} tone="sage" hint="In this view" />
        <MetricCard label="Avg utilization" value={periodStats.avgUtil} suffix="%" icon={TrendingUp} tone="sage" />
        <MetricCard label="Signed up" value={periodStats.signups} icon={Users} tone="sage" />
        <MetricCard label="Pending" value={periodStats.pending} icon={Hourglass} tone="clay" />
      </div>

      {/* Calendar — tokenized, Button/Card primitives */}
      <Card className="border-sage/15 bg-white-warm">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <NavPrevButton label="Previous period" onClick={() => shift(-1)} />
              <div className="flex min-w-0 items-center justify-center gap-2 text-center sm:min-w-[180px]">
                <Calendar className="h-5 w-5 shrink-0 text-sage" aria-hidden="true" />
                <span className="truncate font-body text-xl font-semibold tabular-nums text-charcoal">{periodLabel}</span>
              </div>
              <NavNextButton label="Next period" onClick={() => shift(1)} />
              <Button variant="sage-outline" size="sm" onClick={goToday}>Today</Button>
            </div>
            <div className="inline-flex items-center gap-1 rounded-full border border-sage/15 bg-cream/60 p-1">
              {(["week", "month"] as const).map((m) => (
                <Button
                  key={m}
                  type="button"
                  size="sm"
                  variant={viewMode === m ? "sage" : "ghost"}
                  aria-pressed={viewMode === m}
                  onClick={() => setViewMode(m)}
                  className={cn(
                    "h-8 rounded-full px-4 capitalize focus-visible:ring-sage/40",
                    viewMode !== m && "text-charcoal/60 hover:bg-sage/10 hover:text-sage",
                  )}
                >
                  {m}
                </Button>
              ))}
            </div>
          </div>

          {viewMode === "week" && (
            <div className="flex gap-2 overflow-x-auto snap-x [-webkit-overflow-scrolling:touch] pb-2 md:grid md:grid-cols-7 md:overflow-visible md:pb-0">
              {gridDays.map((d) => {
                const k = dayKey(d);
                const count = (byDay.get(k) ?? []).length;
                const active = k === selectedDay;
                const isToday = k === todayKey;
                return (
                  <Button
                    key={k}
                    type="button"
                    variant={active ? "sage" : "sage-outline"}
                    aria-pressed={active}
                    aria-label={`${DAY_SHORT[d.getDay()]} ${d.getDate()} — ${count} ${count === 1 ? "class" : "classes"}`}
                    onClick={() => setSelectedDay(k)}
                    className="h-auto min-w-[3.25rem] shrink-0 snap-start flex-col gap-0.5 py-2 md:min-w-0"
                  >
                    <span className={cn("text-[10px] font-semibold uppercase tracking-wide", active ? "text-cream/80" : "text-muted-foreground")}>{DAY_SHORT[d.getDay()]}</span>
                    <span className={cn("text-lg font-semibold leading-tight tabular-nums", active ? "text-cream" : "text-charcoal")}>{d.getDate()}</span>
                    <span className={cn("text-[10px] tabular-nums", active ? "text-cream/80" : isToday ? "text-sage" : "text-muted-foreground")}>{isToday ? "Today" : count ? `${count} cls` : "—"}</span>
                  </Button>
                );
              })}
            </div>
          )}

          {viewMode === "month" && (
            <div>
              <div className="mb-1 grid grid-cols-7 gap-1">
                {WEEKDAY_HEADS.map((d) => (
                  <div key={d} className="py-1 text-center font-body text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {gridDays.map((d) => {
                  const k = dayKey(d);
                  const count = (byDay.get(k) ?? []).length;
                  const inMonth = d.getMonth() === anchor.getMonth();
                  const active = k === selectedDay;
                  const isToday = k === todayKey;
                  return (
                    <Button
                      key={k}
                      type="button"
                      variant={active ? "sage" : inMonth ? "sage-outline" : "ghost"}
                      aria-pressed={active}
                      aria-label={`${d.toLocaleDateString("en-IN", { day: "numeric", month: "long" })} — ${count} ${count === 1 ? "class" : "classes"}`}
                      onClick={() => setSelectedDay(k)}
                      className={cn(
                        "aspect-square h-auto flex-col gap-0.5 p-0 sm:aspect-auto sm:h-16",
                        !inMonth && !active && "border-transparent focus-visible:ring-sage/40 hover:bg-muted",
                      )}
                    >
                      <span className={cn("text-sm font-semibold tabular-nums", active ? "text-cream" : !inMonth ? "text-muted-foreground/50" : isToday ? "text-sage" : "text-charcoal")}>{d.getDate()}</span>
                      {count > 0 && <span className={cn("text-[9px] tabular-nums", active ? "text-cream/80" : "text-sage")}>{count} cls</span>}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected-day rosters */}
      <div>
        <h2 className="font-body font-semibold text-lg text-charcoal mb-3">
          {selDate ? selDate.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" }) : "Select a day"}
        </h2>

        {loading ? (
          <PartnerClassesSkeleton />
        ) : loadError ? (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="flex items-center justify-center gap-2 p-8 text-center">
              <AlertCircle className="size-5 shrink-0 text-destructive" aria-hidden="true" />
              <span className="font-body text-sm text-destructive">{loadError}</span>
            </CardContent>
          </Card>
        ) : activeClasses.length === 0 ? (
          <Card className="border-sage/15 bg-card/80">
            <CardContent className="p-0">
              <EmptyState
                icon={CalendarX}
                title="No classes scheduled"
                description="Nothing on the calendar for this day. Pick another date above."
              />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {activeClasses.map((c) => {
              const fillPct = Math.min(100, c.capacity > 0 ? (c.signups / c.capacity) * 100 : 0);
              return (
                <Card key={c.id} className="border-sage/15 bg-white-warm">
                  <CardContent className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                      <div>
                        <h3 className="font-body font-semibold text-xl text-charcoal">{c.className}</h3>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 font-body text-sm text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" aria-hidden="true" /> <span className="tabular-nums">{fmtTime(c.startTime)} – {fmtTime(c.endTime)}</span></span>
                          <span>· {c.instructorName}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Pill tone="success" className="font-body tabular-nums" icon={<Users className="h-3.5 w-3.5" />}>{c.signups}/{c.capacity} signed up</Pill>
                        <Pill tone="neutral" className="font-body tabular-nums">{c.openSpots} open</Pill>
                      </div>
                    </div>

                    <div className="h-2 rounded-full bg-sage/10 overflow-hidden mb-4" role="progressbar" aria-valuenow={Math.round(fillPct)} aria-valuemin={0} aria-valuemax={100} aria-label="Capacity filled">
                      <div className="h-full bg-sage rounded-full" style={{ width: `${fillPct}%` }} />
                    </div>

                    {c.bookings.length === 0 ? (
                      <EmptyState
                        icon={UserX}
                        title="No sign-ups yet"
                        description="Bookings for this class will appear here."
                        className="py-8"
                      />
                    ) : (
                      <ResponsiveCards
                        data={c.bookings}
                        renderCard={(b) => {
                          const bookerName = b.invitedByUserId
                            ? c.bookings.find((x) => x.userId === b.invitedByUserId)?.memberName ?? null
                            : null;
                          const broughtNames = b.invitedByUserId
                            ? []
                            : c.bookings.filter((x) => x.invitedByUserId === b.userId).map((x) => x.memberName);
                          const waiver = waiverPill(b.hasWaiver);
                          const { label: waiverLabel, ...waiverRest } = waiver;
                          const isPending = b.confirmationStatus === "pending";
                          return (
                            <div key={b.id} className="rounded-lg border border-sage/15 bg-white-warm p-4">
                              <div className="flex items-start gap-3">
                                <Avatar className="h-9 w-9 shrink-0">
                                  {b.avatarUrl && <AvatarImage src={b.avatarUrl} alt={b.memberName} />}
                                  <AvatarFallback className="bg-sage/10 text-sage text-xs">{initials(b.memberName)}</AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                  <div className="font-body text-sm font-medium text-charcoal">
                                    {b.memberName}
                                    {b.extraGuests > 0 && <span className="text-muted-foreground font-normal"> +{b.extraGuests} guest{b.extraGuests > 1 ? "s" : ""}</span>}
                                    {broughtNames.length > 0 && (
                                      <span className="text-muted-foreground font-normal"> · brought {broughtNames.join(", ")}</span>
                                    )}
                                  </div>
                                  <div className="font-body text-xs text-muted-foreground break-words">
                                    {bookerName ? `Guest of ${bookerName} · ` : ""}
                                    {b.email}
                                    {b.phone ? ` · ${b.phone}` : ""}
                                  </div>
                                </div>
                              </div>
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <Pill {...waiverRest} className="font-body whitespace-nowrap">{waiverLabel}</Pill>
                                {b.status === "payment_pending" && (() => {
                                  const { label, ...pill } = bookingPaymentPill(b.status);
                                  return <Pill {...pill} className="font-body whitespace-nowrap">{label}</Pill>;
                                })()}
                                {isPending ? (
                                  <Pill {...bookingStatusPill("pending")} className="font-body whitespace-nowrap">Pending</Pill>
                                ) : b.checkedIn ? (
                                  <Pill tone="success" className="font-body whitespace-nowrap" icon={<CheckCircle2 className="h-3.5 w-3.5" />}>Checked in</Pill>
                                ) : (
                                  <Pill tone="neutral" className="font-body whitespace-nowrap">Not checked in</Pill>
                                )}
                              </div>
                              {isPending && (
                                <div className="mt-3 grid grid-cols-2 gap-2">
                                  <Button size="sm" variant="sage" disabled={actioningId === b.id} onClick={() => actionBooking(c.id, b.id, "confirm")} className="w-full">Confirm</Button>
                                  <Button size="sm" variant="ghost" disabled={actioningId === b.id} onClick={() => actionBooking(c.id, b.id, "reject")} className="w-full border border-sage/20">Reject</Button>
                                </div>
                              )}
                            </div>
                          );
                        }}
                        renderTable={() => (
                      <ResponsiveTable>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Member</TableHead>
                              <TableHead>Waiver</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {c.bookings.map((b) => {
                              // Derive grouping from ids using the co-present rows — no duplicated names.
                              const bookerName = b.invitedByUserId
                                ? c.bookings.find((x) => x.userId === b.invitedByUserId)?.memberName ?? null
                                : null;
                              const broughtNames = b.invitedByUserId
                                ? []
                                : c.bookings.filter((x) => x.invitedByUserId === b.userId).map((x) => x.memberName);
                              const waiver = waiverPill(b.hasWaiver);
                              const { label: waiverLabel, ...waiverRest } = waiver;
                              const isPending = b.confirmationStatus === "pending";
                              return (
                                <TableRow key={b.id}>
                                  <TableCell>
                                    <div className="flex items-center gap-3 min-w-0">
                                      <Avatar className="h-8 w-8 shrink-0">
                                        {b.avatarUrl && <AvatarImage src={b.avatarUrl} alt={b.memberName} />}
                                        <AvatarFallback className="bg-sage/10 text-sage text-xs">{initials(b.memberName)}</AvatarFallback>
                                      </Avatar>
                                      <div className="min-w-0">
                                        <div className="font-body text-sm font-medium text-charcoal truncate">
                                          {b.memberName}
                                          {b.extraGuests > 0 && <span className="text-muted-foreground font-normal"> +{b.extraGuests} guest{b.extraGuests > 1 ? "s" : ""}</span>}
                                          {broughtNames.length > 0 && (
                                            <span className="text-muted-foreground font-normal"> · brought {broughtNames.join(", ")}</span>
                                          )}
                                        </div>
                                        <div className="font-body text-xs text-muted-foreground truncate">
                                          {bookerName ? `Guest of ${bookerName} · ` : ""}
                                          {b.email}
                                          {b.phone ? ` · ${b.phone}` : ""}
                                        </div>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Pill {...waiverRest} className="font-body whitespace-nowrap">{waiverLabel}</Pill>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-wrap items-center gap-2">
                                      {b.status === "payment_pending" && (() => {
                                        const { label, ...pill } = bookingPaymentPill(b.status);
                                        return <Pill {...pill} className="font-body whitespace-nowrap">{label}</Pill>;
                                      })()}
                                      {isPending ? (
                                        <Pill {...bookingStatusPill("pending")} className="font-body whitespace-nowrap">Pending</Pill>
                                      ) : b.checkedIn ? (
                                        <Pill tone="success" className="font-body whitespace-nowrap" icon={<CheckCircle2 className="h-3.5 w-3.5" />}>Checked in</Pill>
                                      ) : (
                                        <Pill tone="neutral" className="font-body whitespace-nowrap">Not checked in</Pill>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {isPending ? (
                                      <div className="flex items-center justify-end gap-2">
                                        <Button size="sm" variant="sage" disabled={actioningId === b.id} onClick={() => actionBooking(c.id, b.id, "confirm")} className="h-7 px-3 text-xs">Confirm</Button>
                                        <Button size="sm" variant="ghost" disabled={actioningId === b.id} onClick={() => actionBooking(c.id, b.id, "reject")} className="h-7 px-3 text-xs">Reject</Button>
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground/50">—</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </ResponsiveTable>
                        )}
                      />
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const sess = await getStudioServerSession(context.req as never, context.res as never);
  const user = sess?.user as { role?: string; partner_id?: string | null } | undefined;
  if (!user || user.role !== "partner" || !user.partner_id) {
    return { redirect: { destination: "/partner/login", permanent: false } };
  }
  return { props: {} };
};
