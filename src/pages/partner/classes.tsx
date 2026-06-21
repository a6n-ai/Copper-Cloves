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
import { Calendar, Users, CheckCircle2, Clock, UserX, Hourglass, TrendingUp } from "lucide-react";
import { NavPrevButton, NavNextButton } from "@/components/ui/quick-actions";
import { toast } from "sonner";

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

            {/* Booking rows */}
            <ul className="divide-y divide-sage/10">
              {Array.from({ length: 3 }).map((__, bi) => (
                <li key={bi} className="flex items-center justify-between gap-3 py-2">
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
                </li>
              ))}
            </ul>
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
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function dayKey(d: Date) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function fmtTime(iso: string) { return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }); }
function initials(name: string) { return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase(); }

export default function PartnerClasses() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  const rangeKey = `${rangeStart.getTime()}-${rangeEnd.getTime()}`;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/partner/classes?from=${encodeURIComponent(rangeStart.toISOString())}&to=${encodeURIComponent(rangeEnd.toISOString())}`);
        if (res.status === 401) { router.replace("/partner/login"); return; }
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!cancelled) { setClasses(data); setError(null); }
      } catch {
        if (!cancelled) setError("Could not load classes. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  // rangeKey already encodes start+end timestamps — including the Date objects
  // would refire this effect on every render (new Date refs each pass).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey]);

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
      setClasses((prev) =>
        prev.map((c) => {
          if (c.id !== classId) return c;
          if (action === "confirm") {
            return { ...c, bookings: c.bookings.map((b) => (b.id === bookingId ? { ...b, confirmationStatus: "confirmed" } : b)) };
          }
          const removed = c.bookings.find((b) => b.id === bookingId);
          const freed = removed ? 1 + (removed.extraGuests ?? 0) : 1;
          return { ...c, bookings: c.bookings.filter((b) => b.id !== bookingId), signups: Math.max(0, c.signups - freed), openSpots: c.openSpots + freed };
        }),
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
    <main className="max-w-5xl mx-auto p-4 lg:p-6 space-y-5">
      <PageHeader title="Classes" subtitle="Your weekly roster and bookings" />
      {/* Period metrics — admin classes style */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Classes" value={periodStats.count} icon={Calendar} tone="sage" hint="In this view" />
        <MetricCard label="Avg utilization" value={periodStats.avgUtil} suffix="%" icon={TrendingUp} tone="sage" />
        <MetricCard label="Signed up" value={periodStats.signups} icon={Users} tone="sage" />
        <MetricCard label="Pending" value={periodStats.pending} icon={Hourglass} tone="clay" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <NavPrevButton onClick={() => shift(-1)} />
          <div className="font-display text-2xl text-charcoal min-w-0 sm:min-w-[180px] text-center flex items-center justify-center gap-2 truncate">
            <Calendar className="h-5 w-5 text-sage" /> {periodLabel}
          </div>
          <NavNextButton onClick={() => shift(1)} />
          <Button variant="sage-outline" size="sm" onClick={goToday}>Today</Button>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-cream/60 p-1 border border-sage/15">
          {(["week", "month"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setViewMode(m)} className={`px-4 h-8 rounded-full font-body text-sm capitalize transition-colors ${viewMode === m ? "bg-sage text-cream" : "text-charcoal/60 hover:text-charcoal"}`}>{m}</button>
          ))}
        </div>
      </div>

      {viewMode === "week" && (
        <div className="flex gap-2 overflow-x-auto snap-x [-webkit-overflow-scrolling:touch] pb-2 md:grid md:grid-cols-7 md:overflow-visible md:pb-0">
          {gridDays.map((d) => {
            const k = dayKey(d);
            const count = (byDay.get(k) ?? []).length;
            const active = k === selectedDay;
            return (
              <button key={k} type="button" onClick={() => setSelectedDay(k)} className={`flex flex-col items-center py-2 rounded-xl border transition-colors min-w-[3.25rem] snap-start shrink-0 md:min-w-0 ${active ? "bg-sage text-cream border-sage" : "bg-[#fafaf8]/70 border-sage/15 text-charcoal hover:bg-sage/5"}`}>
                <span className="font-body text-[10px] uppercase tracking-wide opacity-80">{DAY_SHORT[d.getDay()]}</span>
                <span className="font-display text-lg leading-tight">{d.getDate()}</span>
                <span className={`font-body text-[10px] ${active ? "text-cream/80" : k === todayKey ? "text-sage" : "text-charcoal/50"}`}>{k === todayKey ? "Today" : count ? `${count} cls` : "—"}</span>
              </button>
            );
          })}
        </div>
      )}

      {viewMode === "month" && (
        <div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="text-center font-body text-[10px] uppercase tracking-wide text-charcoal/50 py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {gridDays.map((d) => {
              const k = dayKey(d);
              const count = (byDay.get(k) ?? []).length;
              const inMonth = d.getMonth() === anchor.getMonth();
              const active = k === selectedDay;
              return (
                <button key={k} type="button" onClick={() => setSelectedDay(k)} className={`aspect-square sm:aspect-auto sm:h-16 flex flex-col items-center justify-center rounded-lg border text-sm transition-colors ${active ? "bg-sage text-cream border-sage" : inMonth ? "bg-[#fafaf8]/70 border-sage/15 text-charcoal hover:bg-sage/5" : "bg-transparent border-transparent text-charcoal/30"}`}>
                  <span className={`font-display ${k === todayKey && !active ? "text-sage font-semibold" : ""}`}>{d.getDate()}</span>
                  {count > 0 && <span className={`font-body text-[9px] mt-0.5 ${active ? "text-cream/80" : "text-sage"}`}>{count} cls</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <h2 className="font-display text-lg text-charcoal mb-3">
          {selDate ? selDate.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" }) : "Select a day"}
        </h2>

        {loading ? (
          <PartnerClassesSkeleton />
        ) : error ? (
          <Card className="border-terracotta/30 bg-terracotta/5"><CardContent className="p-4 font-body text-charcoal">{error}</CardContent></Card>
        ) : activeClasses.length === 0 ? (
          <Card className="border-sage/15 bg-[#fafaf8]/80"><CardContent className="p-8 text-center font-body text-charcoal/50">No classes scheduled this day.</CardContent></Card>
        ) : (
          <div className="space-y-4">
            {activeClasses.map((c) => (
              <Card key={c.id} className="border-sage/15 bg-white-warm">
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                    <div>
                      <h3 className="font-display text-xl text-charcoal">{c.className}</h3>
                      <div className="flex items-center gap-3 mt-1 font-body text-sm text-charcoal/60">
                        <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {fmtTime(c.startTime)} – {fmtTime(c.endTime)}</span>
                        <span>· {c.instructorName}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Pill tone="success" className="font-body" icon={<Users className="h-3.5 w-3.5" />}>{c.signups}/{c.capacity} signed up</Pill>
                      <Pill tone="neutral" className="font-body">{c.openSpots} open</Pill>
                    </div>
                  </div>

                  <div className="h-2 rounded-full bg-sage/10 overflow-hidden mb-4">
                    <div className="h-full bg-sage rounded-full" style={{ width: `${Math.min(100, c.capacity > 0 ? (c.signups / c.capacity) * 100 : 0)}%` }} />
                  </div>

                  {c.bookings.length === 0 ? (
                    <div className="flex items-center gap-2 font-body text-sm text-charcoal/40"><UserX className="h-4 w-4" /> No one has signed up yet.</div>
                  ) : (
                    <ul className="divide-y divide-sage/10">
                      {c.bookings.map((b) => (
                        <li key={b.id} className="flex items-center justify-between gap-3 py-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar className="h-8 w-8">
                              {b.avatarUrl && <AvatarImage src={b.avatarUrl} alt={b.memberName} />}
                              <AvatarFallback className="bg-sage/10 text-sage text-xs">{initials(b.memberName)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="font-body text-sm font-medium text-charcoal truncate">
                                {b.memberName}
                                {b.extraGuests > 0 && <span className="text-charcoal/50 font-normal"> +{b.extraGuests} guest{b.extraGuests > 1 ? "s" : ""}</span>}
                              </div>
                              <div className="font-body text-xs text-charcoal/50 truncate">
                                {b.email}
                                {b.phone ? ` · ${b.phone}` : ""}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {b.status === "payment_pending" && (() => {
                              const { label, ...pill } = bookingPaymentPill(b.status)
                              return <Pill {...pill} className="font-body whitespace-nowrap">{label}</Pill>
                            })()}
                            {(() => {
                              const { label, ...pill } = waiverPill(b.hasWaiver)
                              return <Pill {...pill} className="font-body whitespace-nowrap">{label}</Pill>
                            })()}
                            {b.confirmationStatus === "pending" ? (
                              <>
                                <Pill {...bookingStatusPill("pending")} className="font-body whitespace-nowrap">Pending</Pill>
                                <Button size="sm" variant="sage" disabled={actioningId === b.id} onClick={() => actionBooking(c.id, b.id, "confirm")} className="h-7 px-3 text-xs rounded-full">Confirm</Button>
                                <Button size="sm" variant="ghost" disabled={actioningId === b.id} onClick={() => actionBooking(c.id, b.id, "reject")} className="text-charcoal/70 hover:bg-charcoal/5 hover:text-charcoal h-7 px-3 text-xs rounded-full font-body">Reject</Button>
                              </>
                            ) : b.checkedIn ? (
                              <Pill tone="success" className="font-body whitespace-nowrap" icon={<CheckCircle2 className="h-3.5 w-3.5" />}>Checked in</Pill>
                            ) : (
                              <Pill tone="neutral" className="font-body whitespace-nowrap">Not checked in</Pill>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            ))}
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
