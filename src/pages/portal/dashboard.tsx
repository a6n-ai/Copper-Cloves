import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CloseButton } from "@/components/ui/quick-actions";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { StatCardRow, type StatCardProps } from "@/components/dashboard/StatCard";
import { ActivityTimeline } from "@/components/dashboard/ActivityTimeline";
import { UpcomingScheduleCard, type ScheduleEntry } from "@/components/dashboard/UpcomingScheduleCard";
import { OrderHistoryTable } from "@/components/dashboard/OrderHistoryTable";
import { PathToMastery } from "@/components/dashboard/PathToMastery";
import dynamic from "next/dynamic";
import { MemberDashboardSkeleton, MemberMobileDashboardSkeleton } from "@/components/dashboard/skeletons";
import { AnimatedIcon } from "@/components/dashboard/AnimatedIcon";
import { useIsMobile } from "@/hooks/use-mobile";

// Mobile-only chunk — desktop visitors never download this. `ssr: false` keeps
// it client-only (the skeleton renders during hydration on mobile).
const MemberMobileDashboard = dynamic(
  () => import("@/components/dashboard/mobile/MemberMobileDashboard").then((m) => ({ default: m.MemberMobileDashboard })),
  { ssr: false, loading: () => <MemberMobileDashboardSkeleton /> },
);

// recharts is heavy; keep it off the initial member-dashboard chunk. The fixed
// loading height matches the rendered chart so there is no layout shift.
const VitalityAreaChart = dynamic(
  () => import("@/components/dashboard/VitalityAreaChart").then((m) => ({ default: m.VitalityAreaChart })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[320px] w-full animate-pulse rounded-2xl bg-muted/40" />
    ),
  },
);
import { useSession } from "next-auth/react";
import { useStudioSWR } from "@/lib/swr";
import { requireSessionSSP } from "@/lib/requireSessionSSP";

// Server-side gate kills the flash-of-unauth; `useSession()` below still
// drives runtime checks that depend on the session id.
export const getServerSideProps = requireSessionSSP();
import {
  Calendar,
  CheckCircle,
  Leaf,
  Shield,
  Sun,
  Crown,
  Coffee,
  Target,
  Award,
  Package,
  X,
  Zap,
  History,
  Lock,
  Flame,
  Clock,
  AlertCircle,
} from "lucide-react";
import { CheckInScanButton } from "@/components/checkin/CheckInScanButton";

import { cdnUrl } from "@/lib/cdnUrl";
import { toast } from "sonner";
// Milestone tier definitions
const MILESTONES = [
  {
    id: "seeker",
    name: "The Seeker",
    classes: 5,
    icon: Leaf,
    description: "The start of your journey",
    color: "text-sage",
    bgColor: "bg-sage/10",
    borderColor: "border-sage/20"
  },
  {
    id: "warrior",
    name: "The Warrior",
    classes: 30,
    icon: Shield,
    description: "Strength and consistency",
    color: "text-terracotta",
    bgColor: "bg-terracotta/10",
    borderColor: "border-terracotta/20"
  },
  {
    id: "alchemist",
    name: "The Alchemist",
    classes: 75,
    icon: Sun,
    description: "Movement meets mindfulness",
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200"
  },
  {
    id: "immortal",
    name: "The Immortal",
    classes: 150,
    icon: Crown,
    description: "Legendary status achieved",
    color: "text-yellow-600",
    bgColor: "bg-linear-to-br from-yellow-50 to-amber-50",
    borderColor: "border-yellow-400"
  }
];

type CafeOrderRow = {
  id: string;
  order_date: string;
  quantity: number;
  payment_method: string;
  status: string;
  cafe_item?: { name?: string; price?: unknown; image_url?: string | null } | null;
};

type VitalityBookingRow = {
  checked_in?: boolean;
  booking_date: string;
  created_at?: string;
  class_schedule?: {
    start_time?: string;
    class_model?: { duration?: number | null } | null;
  } | null;
};

/** Buckets last-30-day minutes (index 0 = 29 days ago, 29 = today) from check-ins only; compares to prior 30 calendar days. */
function computeMovementVitalityFromBookings(bookings: VitalityBookingRow[], now: Date) {
  const dailyActivity = new Array(30).fill(0);
  if (!Array.isArray(bookings)) {
    return { dailyActivity, vsText: "—" as const, vsTone: "neutral" as const };
  }
  let currentWindowMinutes = 0;
  let prevWindowMinutes = 0;

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayMs = 86400000;

  for (const b of bookings) {
    if (!b.checked_in) continue;
    const t = new Date(b.class_schedule?.start_time ?? b.booking_date);
    if (Number.isNaN(t.getTime()) || t.getTime() > now.getTime()) continue;

    const dk = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
    const daysAgo = Math.floor((todayStart - dk) / dayMs);
    const mins = Math.max(0, Number(b.class_schedule?.class_model?.duration) || 45);

    if (daysAgo >= 0 && daysAgo <= 29) {
      currentWindowMinutes += mins;
      dailyActivity[29 - daysAgo] += mins;
    } else if (daysAgo >= 30 && daysAgo <= 59) {
      prevWindowMinutes += mins;
    }
  }

  let vsText = "—";
  let vsTone: "neutral" | "up" | "down" = "neutral";
  if (currentWindowMinutes === 0 && prevWindowMinutes === 0) {
    vsText = "—";
  } else if (prevWindowMinutes === 0) {
    vsText = "New";
    vsTone = "up";
  } else {
    const pct = Math.round(((currentWindowMinutes - prevWindowMinutes) / prevWindowMinutes) * 100);
    vsText = `${pct > 0 ? "+" : ""}${pct}%`;
    vsTone = pct > 0 ? "up" : pct < 0 ? "down" : "neutral";
  }

  return { dailyActivity, vsText, vsTone };
}

export default function Dashboard() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [dailyIntention, setDailyIntention] = useState("Deep breathing and presence");
  const [isEditingIntention, setIsEditingIntention] = useState(false);
  const [showOrderHistory, setShowOrderHistory] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [selectedBookingForCheckIn, setSelectedBookingForCheckIn] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  
  // Real user data states
  const [userName, setUserName] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [userClassesCompleted, setUserClassesCompleted] = useState<number>(0);
  const [creditsRemaining, setCreditsRemaining] = useState<number>(0);
  const [packageDetails, setPackageDetails] = useState<{
    name: string;
    isUnlimited: boolean;
    classCount: number | null;
  } | null>(null);
  const [currentBadge, setCurrentBadge] = useState<string>("The Seeker");
  const [nextBadge, setNextBadge] = useState<string>("The Warrior");
  const [classesUntilNext, setClassesUntilNext] = useState<number>(25);
  const [upcomingClasses, setUpcomingClasses] = useState<any[]>([]);
  const [userIntention, setUserIntention] = useState<string>("Deep breathing and presence");
  const [upcomingBookings, setUpcomingBookings] = useState<any[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [lastCafeOrder, setLastCafeOrder] = useState<string | null>(null);
  const [movementVitalityData, setMovementVitalityData] = useState<number[]>([]);
  const [cafeOrdersHistory, setCafeOrdersHistory] = useState<CafeOrderRow[]>([]);
  const [vitalityVsPrev, setVitalityVsPrev] = useState<{
    text: string;
    tone: "neutral" | "up" | "down";
  }>({ text: "—", tone: "neutral" });
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [attendanceCounts, setAttendanceCounts] = useState({ on_time: 0, late: 0, no_show: 0 });
  // Badge template + user-badge reads go through SWR so they share one cached
  // copy app-wide (the templates are global/static) instead of refetching on
  // every dashboard mount. `/api/admin/badges` is also read by admin/badges.tsx.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: badgeTplData, isLoading: ptmIsLoading } = useStudioSWR<{ path_to_mastery?: any[] }>("/api/admin/badges");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userBadgesData } = useStudioSWR<any[]>("/api/user/badges");
  const ptmDbTemplates = badgeTplData?.path_to_mastery ?? null;
  const ptmLoading = ptmIsLoading && !badgeTplData;
  const userBadges = Array.isArray(userBadgesData) ? userBadgesData : [];

  // Profile shared across the member portal (one cached copy, deduped with
  // _app + ProfileSection). Display-only here, so re-seeding on revalidate is
  // harmless.
  const { data: profileData } = useStudioSWR<{ full_name?: string; email?: string }>("/api/user/profile");
  useEffect(() => {
    if (!profileData) return;
    setUserName((profileData.full_name || "Member").split(" ")[0]);
    setUserEmail(profileData.email || "");
  }, [profileData]);

  /** Always length 30 for chart; zeros until hydrated from API check-ins */
  const vitalityData =
    movementVitalityData.length === 30 ? movementVitalityData : new Array(30).fill(0);
  const vitSeriesReady = movementVitalityData.length === 30;

  const totalMinutes = vitSeriesReady ? Math.round(vitalityData.reduce((sum, val) => sum + val, 0)) : 0;
  const avgPerDay = vitSeriesReady ? Math.round(totalMinutes / 30) : 0;
  // Use DB templates if loaded, otherwise fall back to hardcoded MILESTONES.
  // Memoized so this filter/sort/map only runs when ptmDbTemplates changes.
  const activeMilestones = useMemo(
    () =>
      ptmDbTemplates && ptmDbTemplates.length > 0
        ? ptmDbTemplates
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .filter((t: any) => t.threshold_classes !== null)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .sort((a: any, b: any) => (a.threshold_classes ?? 0) - (b.threshold_classes ?? 0))
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((t: any) => ({
              id: t.id,
              name: t.name,
              classes: t.threshold_classes as number,
              icon: Leaf,
              description: t.description ?? "",
              color: "text-sage",
              bgColor: "bg-sage/10",
              borderColor: "border-sage/20",
              dbIcon: t.icon,
              dbColor: t.color,
            }))
        : MILESTONES,
    [ptmDbTemplates],
  );

  // Walk milestones in reverse once to find earned + next. Avoids two scans per render.
  const { currentMilestone, nextMilestone } = useMemo(() => {
    let earned: typeof activeMilestones[number] | undefined;
    let next: typeof activeMilestones[number] | undefined;
    for (let i = activeMilestones.length - 1; i >= 0; i--) {
      const m = activeMilestones[i];
      if (!earned && userClassesCompleted >= m.classes) earned = m;
    }
    for (const m of activeMilestones) {
      if (m.classes > userClassesCompleted) { next = m; break; }
    }
    return {
      currentMilestone: earned ?? activeMilestones[0],
      nextMilestone: next,
    };
  }, [activeMilestones, userClassesCompleted]);

  // Auth enforced server-side via `getServerSideProps` → `requireSessionSSP`.
  // No client-side redirect needed; just kick off the data load once we have
  // the session id from the JWT.
  const sessionUserId = (session?.user as { id?: string } | undefined)?.id;
  useEffect(() => {
    if (status === "authenticated" && sessionUserId) {
      setCurrentUserId(sessionUserId);
      fetchUserData(sessionUserId).then(() => setLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, sessionUserId]);

  async function fetchUserData(_userId: string) {
    // Badge templates + user badges now load via SWR hooks at component top.
    try {
      // Profile loads via the shared SWR key (see hook below) — deduped across
      // the member portal — so it's no longer fetched here.
      const [statsRes, packagesRes, bookingsRes, cafeOrdersRes, historyBookingsRes] =
        await Promise.all([
          fetch("/api/user-stats"),
          fetch("/api/user-packages?active=true"),
          fetch("/api/bookings?status=confirmed"),
          fetch("/api/cafe/orders"),
          fetch("/api/bookings?limit=500"),
        ]);

      const stats = statsRes.ok ? await statsRes.json() : null;
      const packages = packagesRes.ok ? await packagesRes.json() : [];
      const bookings = bookingsRes.ok ? await bookingsRes.json() : [];
      const cafeOrders = cafeOrdersRes.ok ? await cafeOrdersRes.json() : [];
      const historyBookingsRaw = historyBookingsRes.ok ? await historyBookingsRes.json() : [];
      const historyBookings = Array.isArray(historyBookingsRaw) ? historyBookingsRaw : [];

      const recentBookingsSlice = Array.isArray(historyBookings) ? historyBookings.slice(0, 15) : [];

      const cafeSorted = [...cafeOrders].sort(
        (a: CafeOrderRow, b: CafeOrderRow) =>
          new Date(b.order_date).getTime() - new Date(a.order_date).getTime()
      );
      setCafeOrdersHistory(cafeSorted);

      if (stats) {
        setUserClassesCompleted(stats.total_classes_attended || 0);
        setCurrentStreak(stats.current_streak || 0);
        setLongestStreak(stats.longest_streak || 0);
      }

      const now = new Date();
      if (packages.length > 0) {
        const activePackage = packages.find(
          (p: { expiration_date: string }) => new Date(p.expiration_date) > now
        ) || packages[0];
        const packageType = activePackage.package_type;
        if (packageType) {
          setPackageDetails({
            name: packageType.name || "Package",
            isUnlimited: packageType.is_unlimited || false,
            classCount: activePackage.credits_remaining,
          });
          setCreditsRemaining(packageType.is_unlimited ? 999 : activePackage.credits_remaining || 0);
        }
      } else {
        setPackageDetails(null);
        setCreditsRemaining(0);
      }

      const upcoming = bookings
        .filter((b: { class_schedule?: { start_time: string }; class_time?: string }) => {
          const startTime = b.class_schedule?.start_time || b.class_time;
          return startTime && new Date(startTime) >= now;
        })
        .slice(0, 3);
      setUpcomingBookings(upcoming);

      const activities: {
        id: string;
        type: string;
        text: string;
        date: string;
        icon: typeof CheckCircle | typeof Calendar | typeof Package;
        color: string;
      }[] = recentBookingsSlice.map(
        (b: { id: string; status: string; created_at: string }) => ({
        id: b.id,
        type: b.status === "completed" ? "completed" : "booked",
        text: b.status === "completed" ? "Completed a class session" : "Booked a class session",
        date: new Date(b.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        icon: b.status === "completed" ? CheckCircle : Calendar,
        color: "text-sage",
      }));
      setRecentActivities(activities.slice(0, 5));

      if (cafeSorted.length > 0) {
        setLastCafeOrder(cafeSorted[0].cafe_item?.name || "Café item");
      } else {
        setLastCafeOrder(null);
      }

      // Attendance outcome counts from all bookings
      const counts = { on_time: 0, late: 0, no_show: 0 };
      for (const b of historyBookings) {
        const outcome = (b as { check_in_outcome?: string }).check_in_outcome;
        if (outcome === "on_time") counts.on_time++;
        else if (outcome === "late") counts.late++;
        else if (outcome === "no_show") counts.no_show++;
      }
      setAttendanceCounts(counts);

      // Movement Vitality: real check-in minutes from class durations (never random mock data)
      const { dailyActivity: vitalityDaily, vsText, vsTone } =
        computeMovementVitalityFromBookings(historyBookings, now);
      setMovementVitalityData(vitalityDaily);
      setVitalityVsPrev({ text: vsText, tone: vsTone });

    } catch (error) {
      console.error("Error fetching user data:", error);
      setMovementVitalityData(new Array(30).fill(0));
      setVitalityVsPrev({ text: "—", tone: "neutral" });
    }
  }

  const handleCheckIn = async (bookingId: string) => {
    try {
      const res = await fetch("/api/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: bookingId, checked_in: true }),
      });
      if (!res.ok) throw new Error("Check-in failed");
      toast.success("Checked in successfully!");
      setShowCheckIn(false);
      if (currentUserId) fetchUserData(currentUserId);
    } catch (err) {
      console.error("Check-in error:", err);
      toast.error("Failed to check in. Please try again.");
    }
  };

  const canCheckIn = (startTime: string) => {
    const now = new Date();
    const classStart = new Date(startTime);
    const tenMinBefore = new Date(classStart.getTime() - 10 * 60 * 1000);
    const fifteenMinAfter = new Date(classStart.getTime() + 15 * 60 * 1000);
    
    return now >= tenMinBefore && now <= fifteenMinAfter;
  };

  // Memoized so child components (StatCardRow, UpcomingScheduleCard,
  // OrderHistoryTable) get stable array refs and can skip rerenders when
  // unrelated state on this page changes.
  const statItems: StatCardProps[] = useMemo(
    () => [
      {
        label: "Day streak",
        value: currentStreak,
        icon: Flame,
        tone: "warn",
        hint: longestStreak > 0 ? `Best: ${longestStreak}` : undefined,
      },
      { label: "On time", value: attendanceCounts.on_time, icon: CheckCircle, tone: "up" },
      { label: "Late", value: attendanceCounts.late, icon: Clock, tone: "warn" },
      { label: "No-shows", value: attendanceCounts.no_show, icon: AlertCircle, tone: "down" },
    ],
    [currentStreak, longestStreak, attendanceCounts.on_time, attendanceCounts.late, attendanceCounts.no_show],
  );

  const upcomingEntries: ScheduleEntry[] = useMemo(
    () =>
      upcomingBookings.slice(0, 3).map((booking) => {
        const isScheduled = !!booking.class_schedule;
        return {
          id: booking.id,
          title: isScheduled ? booking.class_schedule?.class_model?.name : booking.class_name || "Class",
          subtitle: isScheduled ? booking.class_schedule?.instructor?.name : "Instructor TBD",
          whenISO: isScheduled ? booking.class_schedule?.start_time : booking.class_time,
          imageUrl: isScheduled ? booking.class_schedule?.class_model?.image_url || undefined : undefined,
          status: booking.confirmation_status === "pending" ? "pending" : "confirmed",
          onClick: () => {
            setSelectedBookingForCheckIn(booking);
            setShowCheckIn(true);
          },
        };
      }),
    [upcomingBookings],
  );

  const orderRows = useMemo(
    () =>
      cafeOrdersHistory.map((order) => ({
        id: order.id,
        item: order.cafe_item?.name || "Café item",
        dateISO: order.order_date,
        amount: Math.round(Number(order.cafe_item?.price ?? 0) * order.quantity * 100) / 100,
        status: order.status,
        method: order.payment_method,
      })),
    [cafeOrdersHistory],
  );

  // Mobile quick-action tiles. Hoisted into a memo so the inline array literal
  // doesn't re-allocate 4 fresh closures per render of the dashboard.
  const mobileQuickActions = useMemo(
    () => [
      { icon: Calendar, label: "Book", action: () => void router.push("/portal/book") },
      { icon: Package, label: "Packages", action: () => void router.push("/portal/packages") },
      { icon: History, label: "History", action: () => setShowOrderHistory(true) },
      { icon: Lock, label: "Password", action: () => void router.push("/account#reset-password") },
    ],
    [router],
  );

  if (loading) {
    return isMobile ? <MemberMobileDashboardSkeleton /> : <MemberDashboardSkeleton />;
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-cream via-cream to-sage/5">
      {/* Main Content */}
      <main className="min-h-screen">
        {isMobile ? (
          <MemberMobileDashboard
            userName={userName}
            userClassesCompleted={userClassesCompleted}
            currentStreak={currentStreak}
            packageDetails={packageDetails}
            creditsRemaining={creditsRemaining}
            dailyIntention={dailyIntention}
            isEditingIntention={isEditingIntention}
            onIntentionChange={setDailyIntention}
            onToggleEditIntention={setIsEditingIntention}
            statItems={statItems}
            milestones={activeMilestones}
            currentMilestoneId={currentMilestone.id}
            nextMilestone={nextMilestone}
            ptmLoading={ptmLoading}
            upcomingEntries={upcomingEntries}
            userBadges={userBadges}
            recentActivities={recentActivities}
            lastCafeOrder={lastCafeOrder}
            vitality={{
              series: vitalityData,
              totalMinutes,
              avgPerDay,
              vsLabel: vitalityVsPrev.text,
              vsTone: vitalityVsPrev.tone,
            }}
            onShowOrderHistory={() => setShowOrderHistory(true)}
          />
        ) : (
        <div className="max-w-7xl mx-auto px-4 py-5 sm:px-6 lg:px-8 lg:py-8">

          {/* TOP SECTION: Greeting & Path to Mastery */}
          <div className="mb-6 lg:mb-12">
            {/* Welcome Header + Today's Intention - Same Row */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 lg:gap-6 mb-6 lg:mb-8">
              {/* Welcome Header */}
              <div>
                <h1 className="font-display text-2xl md:text-4xl text-charcoal mb-1 leading-tight">
                  Welcome Home, {userName || "Member"}
                </h1>
                <p className="font-body text-sm text-charcoal/60">
                  {userClassesCompleted} classes completed
                  {currentStreak > 0 && (
                    <span className="inline-flex items-center gap-1 ml-2 text-orange-500">
                      <Flame size={13} /> {currentStreak}-day streak
                    </span>
                  )}
                  {" • "}
                  {packageDetails
                    ? packageDetails.isUnlimited
                      ? packageDetails.name
                      : `${packageDetails.classCount || 0} classes remaining`
                    : "No active package"}
                </p>
              </div>

              {/* Today's Intention */}
              <div className="flex items-start gap-3 flex-1 lg:max-w-xl">
                <div className="w-10 h-10 rounded-full bg-sage/10 flex items-center justify-center shrink-0">
                  <AnimatedIcon icon={Target} size={20} className="text-sage" />
                </div>
                <div className="flex-1">
                  <h3 className="font-display text-lg text-charcoal mb-2">Today's Intention</h3>
                  {isEditingIntention ? (
                    <div className="flex gap-2">
                      <Input
                        value={dailyIntention}
                        onChange={(e) => setDailyIntention(e.target.value)}
                        className="flex-1 border-charcoal/20 focus:border-sage font-body text-sm"
                        placeholder="Set your focus for today..."
                      />
                      <Button
                        onClick={() => setIsEditingIntention(false)}
                        size="sm"
                        variant="sage"
                      >
                        Save
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-body text-sm text-charcoal/70 italic">{dailyIntention}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsEditingIntention(true)}
                        className="text-sage hover:text-sage/80 font-body shrink-0"
                      >
                        Edit
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Book — primary actions, kept up top for fast access */}
            <Card className="mb-6 rounded-2xl shadow-xs">
              <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <AnimatedIcon icon={Zap} size={20} className="text-primary" />
                  <div>
                    <h2 className="font-display text-lg text-card-foreground">Quick Book</h2>
                    <p className="text-xs text-muted-foreground">Fast access to your favorites</p>
                  </div>
                </div>
                {/* Mobile icon grid — 4 tiles, no scroll, no Scan (bottom-nav FAB handles it) */}
                <div className="grid grid-cols-4 gap-2 sm:hidden w-full">
                  {mobileQuickActions.map(({ icon: Icon, label, action }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={action}
                      className="flex flex-col items-center justify-center gap-1.5 min-h-16 rounded-xl border border-sage/15 bg-white active:scale-95 transition-transform px-1 py-2"
                    >
                      <AnimatedIcon icon={Icon} size={20} className="text-sage" />
                      <span className="text-[10px] font-body text-charcoal/70 leading-tight text-center">{label}</span>
                    </button>
                  ))}
                </div>

                {/* Desktop button row — unchanged */}
                <div className="hidden sm:flex sm:flex-wrap sm:justify-end w-full sm:w-auto gap-2">
                  <Button
                    type="button"
                    onClick={() => void router.push("/portal/book")}
                    variant="sage"
                    className="justify-start"
                  >
                    <span className="mr-2"><AnimatedIcon icon={Calendar} size={16} /></span>
                    Book a Class
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push("/portal/packages")}
                    className="border-sage/20 text-charcoal hover:bg-cream font-body justify-start"
                  >
                    <span className="mr-2"><AnimatedIcon icon={Package} size={16} /></span>
                    Buy Packages
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowOrderHistory(true)}
                    className="border-sage/20 text-charcoal hover:bg-cream font-body justify-start"
                  >
                    <span className="mr-2"><AnimatedIcon icon={History} size={16} /></span>
                    Order History
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void router.push("/account#reset-password")}
                    className="border-sage/20 text-charcoal hover:bg-cream font-body justify-start"
                  >
                    <span className="mr-2"><AnimatedIcon icon={Lock} size={16} /></span>
                    Reset password
                  </Button>
                  <CheckInScanButton
                    label="Scan check-in"
                    variant="outline"
                    className="border-sage/20 text-charcoal hover:bg-cream font-body justify-start"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Streak & Attendance Strip */}
            <StatCardRow items={statItems} className="mb-6" />

            {/* Path to Mastery - Horizontal Milestone Track */}
            <PathToMastery
              milestones={activeMilestones}
              classesCompleted={userClassesCompleted}
              currentId={currentMilestone.id}
              nextMilestone={nextMilestone}
              loading={ptmLoading}
            />
          </div>

          {/* Achievements */}
          {userBadges.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-terracotta/10 flex items-center justify-center">
                  <AnimatedIcon icon={Award} size={20} className="text-terracotta" />
                </div>
                <h2 className="font-display text-2xl text-charcoal">Achievements</h2>
              </div>

              <div className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth snap-x snap-mandatory scroll-px-1 pb-2">
                {userBadges.map((badge) => {
                  const isCustom = badge.badge_type === "custom";
                  const badgeColor = badge.color ?? "#7C9070";
                  if (isCustom) {
                    return (
                      <div
                        key={badge.id}
                        className="shrink-0 snap-start w-44 rounded-2xl p-4 border shadow-md text-center transition-transform hover:scale-105"
                        style={{
                          background: `linear-gradient(135deg, ${badgeColor}18, ${badgeColor}08)`,
                          borderColor: badgeColor + "44",
                          boxShadow: `0 0 16px ${badgeColor}22`,
                        }}
                      >
                        <div className="text-4xl mb-2">{badge.icon ?? "🏆"}</div>
                        <p className="font-display text-sm text-charcoal leading-tight">
                          {badge.badge_name}
                        </p>
                        {badge.badge_description && (
                          <p className="font-body text-xs text-charcoal/50 mt-1 leading-tight">
                            {badge.badge_description}
                          </p>
                        )}
                        <p className="font-body text-xs mt-2" style={{ color: badgeColor }}>
                          Special Award
                        </p>
                      </div>
                    );
                  }
                  // PTM badge as a compact chip
                  return (
                    <div
                      key={badge.id}
                      className="shrink-0 snap-start flex items-center gap-2 px-4 py-2.5 rounded-full border bg-white/80 shadow-xs transition-transform hover:scale-105"
                      style={{ borderColor: (badge.color ?? "#7C9070") + "55" }}
                    >
                      <span className="text-xl">{badge.icon ?? "🏆"}</span>
                      <div>
                        <p className="font-body text-sm font-medium text-charcoal leading-tight">
                          {badge.badge_name}
                        </p>
                        {badge.milestone_value && (
                          <p className="font-body text-xs text-charcoal/40">
                            {badge.milestone_value} classes
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* MIDDLE ROW: Movement Vitality (2/3) + Sidebar (1/3) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-8 mb-5 lg:mb-8">
            
            {/* LEFT COLUMN (2/3) - Movement Vitality Graph */}
            <div className="lg:col-span-2">
              <VitalityAreaChart
                series={vitalityData}
                totalMinutes={totalMinutes}
                avgPerDay={avgPerDay}
                vsLabel={vitalityVsPrev.text}
                vsTone={vitalityVsPrev.tone}
              />
            </div>

            {/* RIGHT COLUMN (1/3) - Upcoming */}
            <div className="lg:col-span-1 space-y-6">
              {/* Upcoming Classes */}
              <UpcomingScheduleCard entries={upcomingEntries} />
            </div>
          </div>

          {/* BOTTOM ROW: Recent Activity + Nourish Café */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-8">
            
            {/* Recent Activity Feed */}
            <ActivityTimeline
              items={recentActivities}
              emptyCta={
                <Button
                  onClick={() => router.push("/portal/book")}
                  size="sm"
                  variant="sage"
                >
                  Book Your First Class
                </Button>
              }
            />

            {/* Nourish Quick-Order Café Widget */}
            <Card className="border-0 bg-linear-to-br from-sage/5 to-white/80 backdrop-blur-xl shadow-lg">
              <CardContent className="p-5 sm:p-8">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-14 h-14 rounded-full bg-sage/10 flex items-center justify-center shrink-0">
                    <AnimatedIcon icon={Coffee} size={28} className="text-sage" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-display text-2xl text-charcoal mb-2">Nourish</h3>
                    <p className="font-body text-sm text-charcoal/70">
                      Refuel after your movement session
                    </p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {lastCafeOrder ? (
                    <>
                      <div className="p-4 rounded-xl bg-white/60 border border-sage/10">
                        <p className="font-body text-sm text-charcoal/70 mb-2">Last Order</p>
                        <p className="font-display text-lg text-charcoal">{lastCafeOrder}</p>
                      </div>
                      
                      <Button
                        onClick={() => router.push("/cafe")}
                        variant="sage-outline"
                        className="w-full"
                      >
                        Re-order for tomorrow's class
                      </Button>
                    </>
                  ) : (
                    <div className="p-4 rounded-xl bg-white/60 border border-sage/10">
                      <p className="font-body text-sm text-charcoal/70 mb-2">No orders yet</p>
                      <p className="font-body text-xs text-charcoal/60">
                        Try our nourishing café items after your next class
                      </p>
                    </div>
                  )}
                  
                  <Button
                    onClick={() => router.push("/portal/menu")}
                    variant="sage"
                    className="w-full"
                  >
                    Browse Full Menu
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        )}
      </main>

      {/* Order History Modal — member café orders */}
      <Drawer
        direction="right"
        open={showOrderHistory}
        onOpenChange={(o) => { if (!o) setShowOrderHistory(false); }}
      >
        <DrawerContent direction="right" className="max-w-2xl">
            {/* Header */}
            <div className="shrink-0 border-b border-sage/10 bg-white-warm p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-sage/10 flex items-center justify-center">
                    <AnimatedIcon icon={Coffee} size={24} className="text-sage" />
                  </div>
                  <div>
                    <DrawerTitle className="font-display text-3xl text-charcoal">Order History</DrawerTitle>
                    <DrawerDescription className="font-body text-sm text-charcoal/60">Your Nourish café orders</DrawerDescription>
                  </div>
                </div>
                <CloseButton onClick={() => setShowOrderHistory(false)} className="rounded-full" />
              </div>
            </div>

            {/* Orders List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {cafeOrdersHistory.length === 0 ? (
                <div className="text-center py-12">
                  <Coffee className="mx-auto mb-4 text-charcoal/20" size={48} />
                  <p className="font-body text-charcoal/60">No café orders yet</p>
                  <p className="font-body text-sm text-charcoal/50 mt-2 max-w-sm mx-auto">
                    When you order from the menu, each item will show up here with status and payment.
                  </p>
                  <Button
                    onClick={() => {
                      setShowOrderHistory(false);
                      router.push("/portal/menu");
                    }}
                    variant="sage"
                    className="mt-4"
                  >
                    Browse café menu
                  </Button>
                </div>
              ) : (
                <OrderHistoryTable rows={orderRows} />
              )}
            </div>

            {/* Footer CTA */}
            <div className="shrink-0 border-t border-sage/10 bg-white-warm p-6">
              <Button
                onClick={() => {
                  setShowOrderHistory(false);
                  router.push("/portal/menu");
                }}
                variant="sage"
                className="w-full"
              >
                Browse café menu
              </Button>
            </div>
        </DrawerContent>
      </Drawer>

      {/* Check-In Modal */}
      {showCheckIn && selectedBookingForCheckIn && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-display text-2xl text-charcoal">Check-In</h3>
              <CloseButton
                onClick={() => {
                  setShowCheckIn(false);
                  setSelectedBookingForCheckIn(null);
                }}
              />
            </div>

            <div className="mb-6">
              {(() => {
                const isScheduled = !!selectedBookingForCheckIn.class_schedule;
                const className = isScheduled
                  ? selectedBookingForCheckIn.class_schedule?.class_model?.name
                  : selectedBookingForCheckIn.class_name || "Class";
                const instructor = isScheduled
                  ? selectedBookingForCheckIn.class_schedule?.instructor?.name
                  : "Instructor TBD";
                const imageUrl = isScheduled
                  ? selectedBookingForCheckIn.class_schedule?.class_model?.image_url ||
                    cdnUrl("/placeholder.jpg")
                  : cdnUrl("/placeholder.jpg");
                const startTime = isScheduled
                  ? selectedBookingForCheckIn.class_schedule?.start_time
                  : selectedBookingForCheckIn.class_time;

                return (
                  <>
                    <Image
                      src={imageUrl}
                      alt={className}
                      width={640}
                      height={384}
                      unoptimized
                      className="w-full h-48 object-cover rounded-lg mb-4"
                    />
                    <h4 className="font-display text-xl text-charcoal mb-2">
                      {className}
                    </h4>
                    <p className="font-body text-sm text-charcoal/60 mb-1">
                      <strong>Instructor:</strong> {instructor}
                    </p>
                    {startTime && (
                      <>
                        <p className="font-body text-sm text-charcoal/60 mb-1">
                          <strong>Date:</strong>{" "}
                          {new Date(startTime).toLocaleDateString("en-US", {
                            weekday: "long",
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                        <p className="font-body text-sm text-charcoal/60">
                          <strong>Time:</strong>{" "}
                          {new Date(startTime).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </>
                    )}
                  </>
                );
              })()}
            </div>

            {selectedBookingForCheckIn.checked_in ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <p className="font-body text-sm text-green-800 text-center">
                  ✅ You're already checked in!
                </p>
              </div>
            ) : (() => {
              const isScheduled = !!selectedBookingForCheckIn.class_schedule;
              const startTime = isScheduled
                ? selectedBookingForCheckIn.class_schedule?.start_time
                : selectedBookingForCheckIn.class_time;
              
              return startTime && canCheckIn(startTime) ? (
                <Button
                  onClick={() => handleCheckIn(selectedBookingForCheckIn.id)}
                  variant="sage"
                  className="w-full"
                >
                  Check In Now
                </Button>
              ) : (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <p className="font-body text-sm text-orange-800 text-center">
                    Check-in opens 10 minutes before class and closes 15 minutes after start time.
                  </p>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
