import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { requireSessionSSP } from "@/lib/requireSessionSSP";

// Server-side gate: instructors only. Unauthenticated / wrong-role callers
// never see the dashboard JS bundle.
export const getServerSideProps = requireSessionSSP({ roles: ["instructor"] });
import { format, isAfter, isBefore, isToday, isTomorrow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Pill } from "@/components/ui/pill";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { InstructorDashboardSkeleton } from "@/components/dashboard/skeletons";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { InstructorCheckinBeacon } from "@/components/checkin/InstructorCheckinBeacon";
import { toast } from "sonner";
import {
  Users,
  Clock,
  CheckCircle2,
  Circle,
  ChevronRight,
  Dumbbell,
  Calendar,
  AlertCircle,
  UserCheck,
  RefreshCw,
  ArrowLeft,
} from "lucide-react";

interface BookingRow {
  id: string;
  memberName: string;
  email: string;
  avatarUrl: string | null;
  checkedIn: boolean;
  checkInTime: string | null;
  checkInOutcome: string | null;
  extraGuests: number;
  status: string;
}

interface ClassRow {
  id: string;
  className: string;
  category: string;
  startTime: string;
  endTime: string;
  capacity: number;
  enrolled: number;
  availableSpots: number;
  status: string;
  instructorCheckedIn: boolean;
  instructorCheckInTime: string | null;
  bookings: BookingRow[];
}

const INSTRUCTOR_OPEN_BEFORE_MS = 15 * 60 * 1000;
const INSTRUCTOR_CLOSE_AFTER_MS = 5 * 60 * 1000;

function instructorCheckInWindowStatus(startTimeStr: string): "open" | "too_early" | "too_late" {
  const start = new Date(startTimeStr).getTime();
  const now = Date.now();
  if (now < start - INSTRUCTOR_OPEN_BEFORE_MS) return "too_early";
  if (now > start + INSTRUCTOR_CLOSE_AFTER_MS) return "too_late";
  return "open";
}

function minutesUntilOpen(startTimeStr: string): number {
  const start = new Date(startTimeStr).getTime();
  return Math.ceil((start - INSTRUCTOR_OPEN_BEFORE_MS - Date.now()) / 60000);
}

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  return format(d, "EEEE, MMM d");
}

function classStatusBadge(cls: ClassRow): { label: string; tone: "info" | "neutral" | "success" } {
  const now = new Date();
  const start = new Date(cls.startTime);
  const end = new Date(cls.endTime);
  if (isBefore(now, start)) return { label: "Upcoming", tone: "info" };
  if (isAfter(now, end)) return { label: "Completed", tone: "neutral" };
  return { label: "In Progress", tone: "success" };
}

function CapacityBar({ enrolled, capacity }: { enrolled: number; capacity: number }) {
  const pct = capacity > 0 ? Math.min(100, Math.round((enrolled / capacity) * 100)) : 0;
  const color = pct >= 90 ? "bg-[#a05e38]" : pct >= 60 ? "bg-terracotta" : "bg-sage";
  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs font-body text-charcoal/60 mb-1">
        <span>{enrolled} signed up</span>
        <span>{capacity} capacity</span>
      </div>
      <div className="h-1.5 bg-sage/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MemberAvatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    return (
      <Image
        src={url}
        alt={name}
        width={36}
        height={36}
        className="h-9 w-9 rounded-full object-cover border border-sage/20"
        unoptimized
      />
    );
  }
  const initials = name.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  return (
    <div className="h-9 w-9 rounded-full bg-sage/10 border border-sage/20 flex items-center justify-center shrink-0">
      <span className="font-body text-xs font-medium text-sage">{initials}</span>
    </div>
  );
}

export default function InstructorDashboard() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [instructorName, setInstructorName] = useState("");
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("today");

  // Check-in tab state
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [checkingIn, setCheckingIn] = useState<Record<string, boolean>>({});
  const [reminding, setReminding] = useState<Record<string, boolean>>({});
  const [instructorCheckingIn, setInstructorCheckingIn] = useState<Record<string, boolean>>({});
  const [instructorCheckInError, setInstructorCheckInError] = useState<Record<string, string>>({});

  // O(1) id → row lookup; replaces `classes.find()` per render and feeds the
  // groupedByDay memo below so we only walk `classes` once per data load.
  const classById = useMemo(() => {
    const m = new Map<string, ClassRow>();
    for (const c of classes) m.set(c.id, c);
    return m;
  }, [classes]);
  const selectedClass = selectedClassId ? classById.get(selectedClassId) ?? null : null;

  // Use a ref for `selectedClassId` inside loadData so the callback identity is
  // stable — otherwise picking a class refires the auth effect below (which
  // refetches the whole list).
  const selectedClassIdRef = useRef(selectedClassId);
  selectedClassIdRef.current = selectedClassId;
  const loadData = useCallback(async () => {
    try {
      const classesRes = await fetch("/api/instructor/today-classes");
      if (classesRes.status === 401) {
        router.replace("/login");
        return;
      }
      if (classesRes.ok) {
        const data: ClassRow[] = await classesRes.json();
        setClasses(data);
        const todayFirst = data.find((c) => isToday(new Date(c.startTime)));
        if (todayFirst && !selectedClassIdRef.current) setSelectedClassId(todayFirst.id);
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Auth + role enforced server-side (gSSP above). Just kick off the data
  // load once the client-side session hydrates.
  const userName = session?.user?.name;
  useEffect(() => {
    if (status !== "authenticated") return;
    setInstructorName(userName ?? "Instructor");
    void loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, userName]);


  async function handleCheckIn(bookingId: string) {
    setCheckingIn((prev) => ({ ...prev, [bookingId]: true }));
    try {
      const res = await fetch("/api/instructor/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Check-in failed");
        return;
      }
      // Optimistic update
      setClasses((prev) =>
        prev.map((cls) => ({
          ...cls,
          bookings: cls.bookings.map((b) =>
            b.id === bookingId
              ? { ...b, checkedIn: true, checkInTime: new Date().toISOString(), checkInOutcome: "on_time" }
              : b,
          ),
        })),
      );
    } finally {
      setCheckingIn((prev) => ({ ...prev, [bookingId]: false }));
    }
  }

  async function handleRemindPayment(bookingId: string) {
    setReminding((prev) => ({ ...prev, [bookingId]: true }));
    try {
      const res = await fetch("/api/instructor/remind-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed to send reminder");
        return;
      }
      toast.success("Reminder sent");
    } finally {
      setReminding((prev) => ({ ...prev, [bookingId]: false }));
    }
  }

  async function handleInstructorCheckIn(scheduleId: string) {
    setInstructorCheckingIn((prev) => ({ ...prev, [scheduleId]: true }));
    setInstructorCheckInError((prev) => ({ ...prev, [scheduleId]: "" }));
    try {
      const res = await fetch("/api/instructor/instructor-check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduleId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInstructorCheckInError((prev) => ({ ...prev, [scheduleId]: data.error ?? "Check-in failed" }));
        return;
      }
      const checkInTime: string = data.checkInTime ?? new Date().toISOString();
      setClasses((prev) =>
        prev.map((cls) =>
          cls.id === scheduleId
            ? { ...cls, instructorCheckedIn: true, instructorCheckInTime: checkInTime }
            : cls,
        ),
      );
    } finally {
      setInstructorCheckingIn((prev) => ({ ...prev, [scheduleId]: false }));
    }
  }

  // Single pass over `classes` produces totals + day-grouped buckets; both were
  // previously separate scans (3 total) executed every render.
  const { totalEnrolled, totalCheckedIn, classesByDay } = useMemo(() => {
    let enrolled = 0;
    let checkedIn = 0;
    const byDay = new Map<string, ClassRow[]>();
    for (const c of classes) {
      enrolled += c.enrolled;
      for (const b of c.bookings) if (b.checkedIn) checkedIn += 1;
      const key = dayLabel(c.startTime);
      const bucket = byDay.get(key);
      if (bucket) bucket.push(c);
      else byDay.set(key, [c]);
    }
    return { totalEnrolled: enrolled, totalCheckedIn: checkedIn, classesByDay: Array.from(byDay) };
  }, [classes]);

  if (loading) {
    return (
      <div className="min-h-screen bg-cream">
        <div className="mx-auto max-w-5xl px-4 py-6">
          <InstructorDashboardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <PageHeader
            title={`Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, ${instructorName.split(" ")[0]}`}
            subtitle={`${format(new Date(), "EEEE, MMMM d")} · ${classes.filter(c => isToday(new Date(c.startTime))).length} class${classes.filter(c => isToday(new Date(c.startTime))).length !== 1 ? "es" : ""} today · ${classes.length} this week`}
          />
        </div>

        <div className="mb-6">
          <InstructorCheckinBeacon classes={classes} />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6">
          {[
            { icon: Calendar, label: "This Week", value: classes.length },
            { icon: Users, label: "Total Enrolled", value: totalEnrolled },
            { icon: UserCheck, label: "Checked In Today", value: totalCheckedIn },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-white-warm rounded-2xl border border-sage/10 p-3 sm:p-4 flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-3">
              <div className="h-9 w-9 rounded-xl bg-sage/10 flex items-center justify-center shrink-0">
                <Icon className="h-4 w-4 text-sage" />
              </div>
              <div>
                <p className="font-display text-xl sm:text-2xl text-charcoal leading-none">{value}</p>
                <p className="font-body text-[11px] sm:text-xs text-charcoal/50 mt-0.5 leading-tight">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-5 bg-sage/10 p-1 rounded-xl">
            <TabsTrigger
              value="today"
              className="font-body data-[state=active]:bg-white-warm data-[state=active]:text-charcoal data-[state=active]:shadow-xs rounded-lg px-5"
            >
              My Schedule
            </TabsTrigger>
            <TabsTrigger
              value="checkin"
              className="font-body data-[state=active]:bg-white-warm data-[state=active]:text-charcoal data-[state=active]:shadow-xs rounded-lg px-5"
            >
              Check In
            </TabsTrigger>
          </TabsList>

          {/* === MY SCHEDULE === */}
          <TabsContent value="today">
            {classes.length === 0 ? (
              <div className="bg-white-warm rounded-2xl border border-sage/10 p-10 text-center">
                <Dumbbell className="h-10 w-10 text-sage/30 mx-auto mb-3" />
                <p className="font-display text-lg text-charcoal">No upcoming classes this week</p>
                <p className="font-body text-sm text-charcoal/50 mt-1">Check back when your schedule is updated.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Group by day — memoized above */}
                {classesByDay.map(([label, dayCls]) => (
                  <div key={label}>
                    <p className="font-body text-xs font-semibold text-charcoal/50 uppercase tracking-widest mb-2 px-1">{label}</p>
                    <div className="space-y-3">
                {dayCls.map((cls) => {
                  const statusInfo = classStatusBadge(cls);
                  const checkedInCount = cls.bookings.filter((b) => b.checkedIn).length;
                  const winStatus = instructorCheckInWindowStatus(cls.startTime);
                  const errMsg = instructorCheckInError[cls.id];
                  return (
                    <div
                      key={cls.id}
                      className="bg-white-warm rounded-2xl border border-sage/10 p-4 sm:p-5 hover:border-sage/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="font-display text-base sm:text-lg text-charcoal">{cls.className}</h2>
                            <Pill tone={statusInfo.tone} size="sm" className="font-body">
                              {statusInfo.label}
                            </Pill>
                            {cls.category && (
                              <span className="font-body text-xs text-charcoal/40 uppercase tracking-wider hidden sm:inline">
                                {cls.category}
                              </span>
                            )}
                            {/* Instructor check-in badge */}
                            {cls.instructorCheckedIn ? (
                              <Pill tone="success" size="sm" className="font-body" icon={<CheckCircle2 className="h-3 w-3" />}>
                                <span className="hidden xs:inline">You checked in {cls.instructorCheckInTime ? format(new Date(cls.instructorCheckInTime), "h:mm a") : ""}</span>
                                <span className="xs:hidden">Checked in</span>
                              </Pill>
                            ) : winStatus === "open" ? (
                              <Pill tone="warning" size="sm" className="font-body">
                                Window open
                              </Pill>
                            ) : winStatus === "too_early" ? (
                              <Pill tone="neutral" size="sm" className="font-body hidden sm:inline-flex">
                                Opens {minutesUntilOpen(cls.startTime)} min before class
                              </Pill>
                            ) : (
                              <Pill tone="neutral" size="sm" className="font-body hidden sm:inline-flex">
                                Window closed
                              </Pill>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-charcoal/60 font-body">
                            <span className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5" />
                              {format(new Date(cls.startTime), "h:mm a")} – {format(new Date(cls.endTime), "h:mm a")}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <UserCheck className="h-3.5 w-3.5 text-sage" />
                              {checkedInCount}/{cls.enrolled} checked in
                            </span>
                          </div>

                          <CapacityBar enrolled={cls.enrolled} capacity={cls.capacity} />
                        </div>

                        <div className="flex flex-col items-end gap-2 shrink-0">
                          {/* Instructor self check-in */}
                          {!cls.instructorCheckedIn && winStatus === "open" && (
                            <Button
                              variant="terracotta"
                              size="sm"
                              onClick={() => void handleInstructorCheckIn(cls.id)}
                              disabled={instructorCheckingIn[cls.id]}
                              className="rounded-full min-w-[80px]"
                            >
                              {instructorCheckingIn[cls.id] ? (
                                <Spinner className="size-4" />
                              ) : "I'm Here"}
                            </Button>
                          )}
                          {/* Member check-in shortcut */}
                          {cls.instructorCheckedIn && (
                            <Button
                              onClick={() => { setSelectedClassId(cls.id); setActiveTab("checkin"); }}
                              variant="sage-outline"
                              size="sm"
                            >
                              <span className="hidden sm:inline">Member Check-In</span>
                              <span className="sm:hidden">Check In</span>
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {errMsg && (
                        <p className="mt-2 font-body text-xs text-[#a05e38] bg-[#a05e38]/10 rounded-lg px-3 py-2">{errMsg}</p>
                      )}

                      {/* Member previews */}
                      {cls.bookings.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-sage/10">
                          <p className="font-body text-xs text-charcoal/50 uppercase tracking-wider mb-2">
                            Registered Members
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {cls.bookings.slice(0, 8).map((b) => (
                              <div key={b.id} className="flex items-center gap-1.5 bg-sage/5 rounded-full pl-1 pr-3 py-1">
                                <MemberAvatar name={b.memberName} url={b.avatarUrl} />
                                <span className="font-body text-xs text-charcoal">{b.memberName.split(" ")[0]}</span>
                                {b.checkedIn && <CheckCircle2 className="h-3 w-3 text-sage ml-0.5" />}
                                {b.extraGuests > 0 && (
                                  <span className="font-body text-[10px] text-terracotta">+{b.extraGuests}</span>
                                )}
                              </div>
                            ))}
                            {cls.bookings.length > 8 && (
                              <div className="flex items-center bg-sage/5 rounded-full px-3 py-1">
                                <span className="font-body text-xs text-charcoal/60">+{cls.bookings.length - 8} more</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* === CHECK IN TAB === */}
          <TabsContent value="checkin">
            {(() => {
              const todayClasses = classes.filter(c => isToday(new Date(c.startTime)));
              if (todayClasses.length === 0) return (
                <div className="bg-white-warm rounded-2xl border border-sage/10 p-10 text-center">
                  <AlertCircle className="h-10 w-10 text-sage/30 mx-auto mb-3" />
                  <p className="font-display text-lg text-charcoal">No classes today</p>
                  <p className="font-body text-sm text-charcoal/50 mt-1">Check-in is only available for today&apos;s classes.</p>
                </div>
              );
              return (
              <div className="space-y-4">
                {/* Class selector */}
                {todayClasses.length > 1 && (
                  <div className="flex gap-2 flex-wrap">
                    {todayClasses.map((cls) => (
                      <button
                        key={cls.id}
                        onClick={() => setSelectedClassId(cls.id)}
                        className={`font-body text-sm px-4 py-2 rounded-full border transition-colors ${
                          selectedClassId === cls.id
                            ? "bg-sage text-cream border-sage"
                            : "bg-white-warm text-charcoal border-sage/20 hover:border-sage/40"
                        }`}
                      >
                        {cls.className} · {format(new Date(cls.startTime), "h:mm a")}
                      </button>
                    ))}
                  </div>
                )}

                {selectedClass ? (
                  <div className="bg-white-warm rounded-2xl border border-sage/10 overflow-hidden">
                    {/* Class header */}
                    <div className="px-5 py-4 border-b border-sage/10 flex items-center justify-between">
                      <div>
                        <h2 className="font-display text-xl text-charcoal">{selectedClass.className}</h2>
                        <p className="font-body text-sm text-charcoal/60 mt-0.5">
                          {format(new Date(selectedClass.startTime), "h:mm a")} –{" "}
                          {format(new Date(selectedClass.endTime), "h:mm a")}
                          &nbsp;·&nbsp;
                          <span className="text-sage font-medium">
                            {selectedClass.bookings.filter((b) => b.checkedIn).length}/{selectedClass.enrolled} checked in
                          </span>
                        </p>
                        {/* Instructor check-in status */}
                        {selectedClass.instructorCheckedIn && (
                          <p className="font-body text-xs text-sage mt-1 flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            You checked in at {selectedClass.instructorCheckInTime ? format(new Date(selectedClass.instructorCheckInTime), "h:mm a") : "—"}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {!selectedClass.instructorCheckedIn && instructorCheckInWindowStatus(selectedClass.startTime) === "open" && (
                          <Button
                            variant="terracotta"
                            size="sm"
                            onClick={() => void handleInstructorCheckIn(selectedClass.id)}
                            disabled={instructorCheckingIn[selectedClass.id]}
                            className="rounded-full"
                          >
                            {instructorCheckingIn[selectedClass.id] ? (
                              <Spinner className="size-4" />
                            ) : "I'm Here"}
                          </Button>
                        )}
                        <Button
                          onClick={() => void loadData()}
                          variant="sage-outline"
                          size="icon-sm"
                          className="rounded-full"
                          title="Refresh"
                          aria-label="Refresh"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Booking list */}
                    {selectedClass.bookings.length === 0 ? (
                      <div className="p-10 text-center">
                        <Users className="h-8 w-8 text-sage/20 mx-auto mb-2" />
                        <p className="font-body text-sm text-charcoal/50">No one has booked this class yet</p>
                      </div>
                    ) : (
                      <ul className="divide-y divide-sage/10">
                        {selectedClass.bookings.map((b) => (
                          <li key={b.id} className="px-4 sm:px-5 py-3 flex items-center gap-3">
                            <MemberAvatar name={b.memberName} url={b.avatarUrl} />

                            <div className="flex-1 min-w-0">
                              <p className="font-body text-sm font-medium text-charcoal truncate flex items-center gap-1.5">
                                <span className="truncate">{b.memberName}</span>
                                {b.extraGuests > 0 && (
                                  <span className="font-body text-xs text-terracotta">
                                    +{b.extraGuests}
                                  </span>
                                )}
                                {b.status === "payment_pending" && (
                                  <Pill tone="warning" size="sm" className="font-body shrink-0">
                                    Payment pending
                                  </Pill>
                                )}
                              </p>
                              {b.checkedIn && b.checkInTime && (
                                <p className="font-body text-xs text-charcoal/40 mt-0.5">
                                  {format(new Date(b.checkInTime), "h:mm a")}
                                  {b.checkInOutcome === "late" && (
                                    <span className="ml-1 text-terracotta">(late)</span>
                                  )}
                                </p>
                              )}
                            </div>

                            {b.checkedIn ? (
                              <div className="flex items-center gap-1 text-sage font-body text-sm shrink-0">
                                <CheckCircle2 className="h-5 w-5" />
                              </div>
                            ) : b.status === "payment_pending" ? (
                              <Button
                                size="sm"
                                variant="terracotta"
                                onClick={() => void handleRemindPayment(b.id)}
                                disabled={reminding[b.id]}
                                className="rounded-full px-3 shrink-0 h-9"
                              >
                                {reminding[b.id] ? (
                                  <Spinner className="size-4" />
                                ) : (
                                  <>
                                    <Clock className="h-3.5 w-3.5 mr-1" />
                                    Remind
                                  </>
                                )}
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="sage"
                                onClick={() => void handleCheckIn(b.id)}
                                disabled={checkingIn[b.id]}
                                className="rounded-full px-3 shrink-0 h-9"
                              >
                                {checkingIn[b.id] ? (
                                  <Spinner className="size-4" />
                                ) : (
                                  <>
                                    <Circle className="h-3.5 w-3.5 mr-1" />
                                    Check In
                                  </>
                                )}
                              </Button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}

                <button
                  onClick={() => setActiveTab("today")}
                  className="flex items-center gap-1.5 font-body text-sm text-charcoal/50 hover:text-charcoal transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to overview
                </button>
              </div>
              );
            })()}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
