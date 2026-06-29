import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { requireSessionSSP } from "@/lib/requireSessionSSP";

// Server-side gate: instructors only. Unauthenticated / wrong-role callers
// never see the dashboard JS bundle.
export const getServerSideProps = requireSessionSSP({ roles: ["instructor"] });
import { format, isToday } from "date-fns";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { InstructorDashboardSkeleton } from "@/components/dashboard/skeletons";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { InstructorCheckinBeacon } from "@/components/checkin/InstructorCheckinBeacon";
import { ScheduleClassCard } from "@/components/instructor/ScheduleClassCard";
import { type ClassRow, dayLabel } from "@/components/instructor/shared";
import { toast } from "sonner";
import { Users, Dumbbell, Calendar, UserCheck } from "lucide-react";

// Check-in tab is below the fold (default tab = My Schedule) and is the heaviest
// interactive subtree. Defer its bundle until the instructor actually opens it.
const CheckInTab = dynamic(() => import("@/components/instructor/CheckInTab"), {
  ssr: false,
  loading: () => (
    <div className="flex justify-center py-16">
      <Spinner className="size-6 text-sage" />
    </div>
  ),
});

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


  const handleCheckIn = useCallback(async (bookingId: string) => {
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
      // Optimistic update — preserve refs for untouched classes/bookings so
      // memoized roster rows don't all re-render on a single check-in.
      setClasses((prev) =>
        prev.map((cls) => {
          let touched = false;
          const bookings = cls.bookings.map((b) => {
            if (b.id !== bookingId) return b;
            touched = true;
            return { ...b, checkedIn: true, checkInTime: new Date().toISOString(), checkInOutcome: "on_time" };
          });
          return touched ? { ...cls, bookings } : cls;
        }),
      );
    } finally {
      setCheckingIn((prev) => ({ ...prev, [bookingId]: false }));
    }
  }, []);

  const handleRemindPayment = useCallback(async (bookingId: string) => {
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
  }, []);

  const handleInstructorCheckIn = useCallback(async (scheduleId: string) => {
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
  }, []);

  // Member check-in shortcut from a schedule card → jump to the Check In tab.
  const handleMemberCheckInShortcut = useCallback((scheduleId: string) => {
    setSelectedClassId(scheduleId);
    setActiveTab("checkin");
  }, []);

  const handleBackToOverview = useCallback(() => setActiveTab("today"), []);

  // Single pass over `classes` produces totals + day-grouped buckets + today
  // count; all were previously separate scans executed every render.
  const { totalEnrolled, totalCheckedIn, classesByDay, todayCount } = useMemo(() => {
    let enrolled = 0;
    let checkedIn = 0;
    let today = 0;
    const byDay = new Map<string, ClassRow[]>();
    for (const c of classes) {
      enrolled += c.enrolled;
      for (const b of c.bookings) if (b.checkedIn) checkedIn += 1;
      if (isToday(new Date(c.startTime))) today += 1;
      const key = dayLabel(c.startTime);
      const bucket = byDay.get(key);
      if (bucket) bucket.push(c);
      else byDay.set(key, [c]);
    }
    return {
      totalEnrolled: enrolled,
      totalCheckedIn: checkedIn,
      classesByDay: Array.from(byDay),
      todayCount: today,
    };
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
            subtitle={`${format(new Date(), "EEEE, MMMM d")} · ${todayCount} class${todayCount !== 1 ? "es" : ""} today · ${classes.length} this week`}
          />
        </div>

        <div className="mb-6">
          <InstructorCheckinBeacon classes={classes} />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3 mb-6">
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
              className="font-body data-[state=active]:bg-white-warm data-[state=active]:text-charcoal rounded-lg px-5"
            >
              My Schedule
            </TabsTrigger>
            <TabsTrigger
              value="checkin"
              className="font-body data-[state=active]:bg-white-warm data-[state=active]:text-charcoal rounded-lg px-5"
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
                      {dayCls.map((cls) => (
                        <ScheduleClassCard
                          key={cls.id}
                          cls={cls}
                          busy={!!instructorCheckingIn[cls.id]}
                          errMsg={instructorCheckInError[cls.id]}
                          onInstructorCheckIn={handleInstructorCheckIn}
                          onMemberCheckIn={handleMemberCheckInShortcut}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* === CHECK IN TAB === */}
          <TabsContent value="checkin">
            <CheckInTab
              classes={classes}
              selectedClassId={selectedClassId}
              onSelectClass={setSelectedClassId}
              checkingIn={checkingIn}
              reminding={reminding}
              instructorCheckingIn={instructorCheckingIn}
              onCheckIn={handleCheckIn}
              onRemindPayment={handleRemindPayment}
              onInstructorCheckIn={handleInstructorCheckIn}
              onRefresh={loadData}
              onBack={handleBackToOverview}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
