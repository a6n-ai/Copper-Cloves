import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
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
import { StatCard, type StatCardProps } from "@/components/dashboard/StatCard";
import { ActivityTimeline, type ActivityItem } from "@/components/dashboard/ActivityTimeline";
import { UpcomingScheduleCard, type ScheduleEntry } from "@/components/dashboard/UpcomingScheduleCard";
import { MedalJourney } from "@/components/dashboard/MedalJourney";
import { PassCard } from "@/components/dashboard/PassCard";
import dynamic from "next/dynamic";
import { MemberDashboardSkeleton, MemberMobileDashboardSkeleton } from "@/components/dashboard/skeletons";
import { AnimatedIcon } from "@/components/dashboard/AnimatedIcon";
import { useIsMobile } from "@/hooks/use-mobile";

// Below-the-fold / drawer-only — kept off the initial chunk. OrderHistoryTable
// only renders inside the café drawer; FriendsCard fires its own 3 fetches, so
// deferring it trims both initial JS and on-mount network work.
// Loading fallbacks reserve the cell's height so the chunk arriving doesn't
// reflow the layout (FriendsCard sits in the in-flow badges grid). animate-pulse
// is a CSS-only pulse and respects prefers-reduced-motion via the global guard.
function FriendsCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-white-warm p-6 space-y-4">
      <div className="h-6 w-24 rounded-md bg-sage/10 animate-pulse" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="size-9 shrink-0 rounded-full bg-sage/10 animate-pulse" />
            <div className="h-4 w-32 rounded bg-sage/10 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
function OrderHistorySkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-16 rounded-xl border border-border bg-white-warm animate-pulse" />
      ))}
    </div>
  );
}
const OrderHistoryTable = dynamic(
  () => import("@/components/dashboard/OrderHistoryTable").then((m) => ({ default: m.OrderHistoryTable })),
  { ssr: false, loading: () => <OrderHistorySkeleton /> },
);
const FriendsCard = dynamic(
  () => import("@/components/portal/FriendsCard").then((m) => ({ default: m.FriendsCard })),
  { ssr: false, loading: () => <FriendsCardSkeleton /> },
);

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
  ArrowRight,
  CheckCircle,
  Leaf,
  Shield,
  Sun,
  Crown,
  Coffee,
  Target,
  Package,
  Zap,
  History,
  Lock,
  Flame,
  Clock,
  AlertCircle,
  CreditCard,
} from "lucide-react";
import { CheckInScanButton } from "@/components/checkin/CheckInScanButton";

import { cdnUrl } from "@/lib/cdnUrl";
import { Pill } from "@/components/ui/pill";
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
    color: "text-terracotta",
    bgColor: "bg-terracotta/10",
    borderColor: "border-terracotta/25"
  },
  {
    id: "immortal",
    name: "The Immortal",
    classes: 150,
    icon: Crown,
    description: "Legendary status achieved",
    color: "text-terracotta",
    bgColor: "bg-linear-to-br from-terracotta/12 to-terracotta/10",
    borderColor: "border-terracotta/30"
  }
];

// Staggered section enter — split + stagger (~70ms) per make-interfaces-feel-better.
// Hoisted so the literals aren't re-allocated each render; reduced-motion swaps to
// a no-op container at the call site.
const SECTION_CONTAINER: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};
const SECTION_ITEM: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.2, 0, 0, 1] } },
};

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

  let vsText: string;
  let vsTone: "neutral" | "up" | "down" = "neutral";
  if (currentWindowMinutes === 0 && prevWindowMinutes === 0) {
    vsText = "—";
  } else if (prevWindowMinutes === 0) {
    vsText = "New";
    vsTone = "up";
  } else {
    const pct = Math.round(((currentWindowMinutes - prevWindowMinutes) / prevWindowMinutes) * 100);
    vsText = `${pct > 0 ? "+" : ""}${pct}%`;
    if (pct > 0) vsTone = "up";
    else if (pct < 0) vsTone = "down";
  }

  return { dailyActivity, vsText, vsTone };
}

interface DashboardBooking {
  id: string;
  status?: string;
  class_name?: string;
  class_time?: string;
  confirmation_status?: string;
  checked_in?: boolean;
  invited_by_user_id?: string | null;
  cancel_cutoff_hours?: number | null;
  class_schedule?: {
    start_time?: string;
    instructor?: { name?: string } | null;
    class_model?: { name?: string; image_url?: string | null } | null;
  } | null;
}

interface ActivePass {
  id: string;
  name: string;
  isUnlimited: boolean;
  classesRemaining: number | null;
  expiry: string | null;
  durationMonths: number | null;
  status: string;
}

/** Approximate validity span in months (purchase → expiry); drives the PassCard tier ramp. */
function monthsBetween(start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return null;
  return Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24 * 30)));
}

/** Pass status for memberStatusPill: paused | expired | expiring | active. */
function derivePassStatus(isActive: boolean, isPaused: boolean, expiry?: string | null): string {
  if (isPaused) return "paused";
  if (!isActive) return "expired";
  if (expiry) {
    const ms = new Date(expiry).getTime() - Date.now();
    if (!Number.isNaN(ms)) {
      if (ms <= 0) return "expired";
      if (ms <= 14 * 86400000) return "expiring";
    }
  }
  return "active";
}

export default function Dashboard() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const reduceMotion = useReducedMotion();
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [dailyIntention, setDailyIntention] = useState("Deep breathing and presence");
  const [isEditingIntention, setIsEditingIntention] = useState(false);
  const [showOrderHistory, setShowOrderHistory] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [selectedBookingForCheckIn, setSelectedBookingForCheckIn] = useState<DashboardBooking | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  
  // Real user data states
  const [userName, setUserName] = useState<string>("");
  const [userClassesCompleted, setUserClassesCompleted] = useState<number>(0);
  const [creditsRemaining, setCreditsRemaining] = useState<number>(0);
  const [packageDetails, setPackageDetails] = useState<{
    name: string;
    isUnlimited: boolean;
    classCount: number | null;
  } | null>(null);
  const [activePasses, setActivePasses] = useState<ActivePass[]>([]);
  const [upcomingBookings, setUpcomingBookings] = useState<DashboardBooking[]>([]);
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([]);
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
  const { data: badgeTplData } = useStudioSWR<{ path_to_mastery?: any[] }>("/api/admin/badges");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userBadgesData } = useStudioSWR<any[]>("/api/user/badges");
  const ptmDbTemplates = badgeTplData?.path_to_mastery ?? null;
  const userBadges = Array.isArray(userBadgesData) ? userBadgesData : [];

  // Profile shared across the member portal (one cached copy, deduped with
  // _app + ProfileSection). Display-only here, so re-seeding on revalidate is
  // harmless.
  const { data: profileData } = useStudioSWR<{ full_name?: string; email?: string }>("/api/user/profile");
  useEffect(() => {
    if (!profileData) return;
    setUserName((profileData.full_name || "Member").split(" ")[0]);
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

  // Auth enforced server-side via `getServerSideProps` → `requireSessionSSP`.
  // No client-side redirect needed; just kick off the data load once we have
  // the session id from the JWT.
  const sessionUserId = (session?.user as { id?: string } | undefined)?.id;
  useEffect(() => {
    if (status === "authenticated" && sessionUserId) {
      setCurrentUserId(sessionUserId);
      fetchUserData(sessionUserId).then(() => setLoading(false));
    }
  }, [status, sessionUserId]);

  async function fetchUserData(_userId: string) {
    // Badge templates + user badges now load via SWR hooks at component top.
    try {
      // Profile loads via the shared SWR key (see hook below) — deduped across
      // the member portal — so it's no longer fetched here.
      // The `?limit=500` history set is a superset of the active/upcoming set
      // (all statuses), so we derive "upcoming" from it instead of issuing a
      // separate `?status=active` request — one fewer round-trip on mount.
      const [statsRes, packagesRes, cafeOrdersRes, historyBookingsRes] =
        await Promise.all([
          fetch("/api/user-stats"),
          fetch("/api/user-packages?active=true"),
          fetch("/api/cafe/orders"),
          fetch("/api/bookings?limit=500"),
        ]);

      const stats = statsRes.ok ? await statsRes.json() : null;
      const packages = packagesRes.ok ? await packagesRes.json() : [];
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
        // Aggregate class credits across ALL active passes (a member can stack
        // several); unlimited on any active pass means no counter.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const activeNow = packages.filter((p: any) => new Date(p.expiration_date) > now);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyUnlimited = activeNow.some((p: any) => p.package_type?.is_unlimited);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const totalClasses = activeNow.reduce((s: number, p: any) => s + Math.max(0, p.credits_remaining || 0), 0);
        if (packageType) {
          setPackageDetails({
            name: packageType.name || "Package",
            isUnlimited: anyUnlimited,
            classCount: anyUnlimited ? null : totalClasses,
          });
          setCreditsRemaining(anyUnlimited ? 999 : totalClasses);
        }
        // Only surface genuinely-active passes — an expired/deactivated pass is
        // not "active" and shouldn't sit in the member's pass carousel.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const livePasses = packages.filter((p: any) => {
          const expMs = p.expiration_date ? new Date(p.expiration_date).getTime() : null;
          return !!p.is_active && (expMs == null || expMs > now.getTime());
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setActivePasses(livePasses.map((p: any) => {
          const pt = p.package_type ?? {};
          const exp = p.expiration_date ? String(p.expiration_date) : null;
          const isActive = !!p.is_active && (exp ? new Date(exp).getTime() > now.getTime() : true);
          return {
            id: String(p.id),
            name: pt.name || "Package",
            isUnlimited: !!pt.is_unlimited,
            classesRemaining: typeof p.credits_remaining === "number" ? p.credits_remaining : null,
            expiry: exp,
            durationMonths: monthsBetween(p.purchase_date ? String(p.purchase_date) : null, exp),
            status: derivePassStatus(isActive, !!p.is_paused, exp),
          };
        }));
      } else {
        setPackageDetails(null);
        setCreditsRemaining(0);
        setActivePasses([]);
      }

      // Upcoming = seat-holding statuses (confirmed / payment_pending / legacy
      // pending) with a future start time — derived from the history set above.
      const ACTIVE_BOOKING_STATUSES = new Set(["confirmed", "payment_pending", "pending"]);
      const upcoming = historyBookings
        .filter((b: { status?: string; class_schedule?: { start_time?: string }; class_time?: string }) => {
          if (b.status && !ACTIVE_BOOKING_STATUSES.has(b.status)) return false;
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
        const startISO = isScheduled ? booking.class_schedule?.start_time : booking.class_time;
        const cutoffH = booking.cancel_cutoff_hours;
        // Any live seat-holder (booker or invited guest) can self-cancel; "pending"
        // is a real occupying status. The API cancels just the invitee's own row.
        const cancellable = ["confirmed", "payment_pending", "pending"].includes(booking.status ?? "");
        const cancelByISO =
          cancellable && startISO && cutoffH != null
            ? new Date(new Date(startISO).getTime() - cutoffH * 3600_000).toISOString()
            : undefined;
        return {
          id: booking.id,
          title: isScheduled ? booking.class_schedule?.class_model?.name : booking.class_name || "Class",
          subtitle: isScheduled ? booking.class_schedule?.instructor?.name : "Instructor TBD",
          whenISO: startISO,
          imageUrl: isScheduled ? booking.class_schedule?.class_model?.image_url || undefined : undefined,
          status:
            booking.status === "payment_pending" || booking.confirmation_status === "pending"
              ? "pending"
              : "confirmed",
          onClick: () => {
            setSelectedBookingForCheckIn(booking);
            setShowCheckIn(true);
          },
          cancelByISO,
          // The full self-cancel / late-request dialog lives on the bookings page;
          // ponytail: deep-link there instead of duplicating ~80 lines of flow.
          onCancel: cancellable ? () => void router.push("/portal/bookings") : undefined,
        };
      }),
    [upcomingBookings, router],
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

  let packageSummary: string;
  if (!packageDetails) {
    packageSummary = "No active package";
  } else if (packageDetails.isUnlimited) {
    packageSummary = packageDetails.name;
  } else {
    packageSummary = `${packageDetails.classCount || 0} classes remaining`;
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
            activePasses={activePasses}
            dailyIntention={dailyIntention}
            isEditingIntention={isEditingIntention}
            onIntentionChange={setDailyIntention}
            onToggleEditIntention={setIsEditingIntention}
            statItems={statItems}
            milestones={activeMilestones}
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
        <motion.div
          className="max-w-7xl mx-auto px-4 py-5 sm:px-6 lg:px-8 lg:py-8 space-y-6 lg:space-y-8"
          variants={SECTION_CONTAINER}
          initial={reduceMotion ? false : "hidden"}
          animate={reduceMotion ? false : "show"}
        >

          {/* GREETING + Today's Intention */}
          <motion.div variants={SECTION_ITEM}>
            {/* Welcome Header + Today's Intention - Same Row */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 lg:gap-6">
              {/* Welcome Header */}
              <div>
                <h1 className="font-body font-semibold text-2xl md:text-4xl text-charcoal mb-1 leading-tight">
                  Welcome Home, {userName || "Member"}
                </h1>
                <p className="font-body text-sm text-charcoal/60">
                  <span className="tabular-nums">{userClassesCompleted}</span> classes completed
                  {currentStreak > 0 && (
                    <span className="inline-flex items-center gap-1 ml-2 text-terracotta">
                      <Flame size={13} /> <span className="tabular-nums">{currentStreak}</span>-day streak
                    </span>
                  )}
                  {" • "}
                  {packageSummary}
                </p>
              </div>

              {/* Today's Intention */}
              <div className="flex items-start gap-3 flex-1 lg:max-w-xl">
                <div className="w-10 h-10 rounded-full bg-sage/10 flex items-center justify-center shrink-0">
                  <AnimatedIcon icon={Target} size={20} className="text-sage" />
                </div>
                <div className="flex-1">
                  <h3 className="font-body font-semibold text-lg text-charcoal mb-2">Today's Intention</h3>
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
          </motion.div>

          {/* QUICK BOOK — primary booking actions */}
          <motion.div variants={SECTION_ITEM}>
            <Card className="rounded-2xl border-border bg-white-warm shadow-none">
              <CardContent className="p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sage/10">
                      <AnimatedIcon icon={Zap} size={18} className="text-sage" />
                    </span>
                    <div>
                      <h2 className="font-body font-semibold text-lg text-charcoal">Quick Book</h2>
                      <p className="font-body text-xs text-charcoal/55">Fast access to your favourites</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void router.push("/account#reset-password")}
                    className="hidden items-center gap-1.5 font-body text-xs text-charcoal/55 transition-colors hover:text-sage lg:inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-1"
                  >
                    <Lock className="h-3.5 w-3.5" /> Reset password
                  </button>
                </div>

                {/* Mobile icon grid — 4 tiles, no scroll, no Scan (bottom-nav FAB handles it) */}
                <div className="grid grid-cols-2 min-[360px]:grid-cols-4 gap-2 sm:hidden">
                  {mobileQuickActions.map(({ icon: Icon, label, action }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={action}
                      className="flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-lg border border-sage/15 bg-white-warm px-1 py-2 transition-transform active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-1"
                    >
                      <AnimatedIcon icon={Icon} size={20} className="text-sage" />
                      <span className="text-center font-body text-[10px] leading-tight text-charcoal/70">{label}</span>
                    </button>
                  ))}
                </div>

                {/* Desktop action tiles — primary CTA + secondary tiles */}
                <div className="hidden gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-4">
                  <button
                    type="button"
                    onClick={() => void router.push("/portal/book")}
                    className="group flex items-center gap-3 rounded-xl bg-sage px-4 py-3.5 text-left text-cream transition-[transform,background-color] duration-200 hover:-translate-y-0.5 hover:bg-sage/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cream/20">
                      <Calendar className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-body text-sm font-semibold leading-tight">Book a Class</span>
                      <span className="block font-body text-xs text-cream/75">Find your next session</span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => router.push("/portal/packages")}
                    className="group flex items-center gap-3 rounded-xl border border-border bg-white-warm px-4 py-3.5 text-left transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-[#c8c6be] hover:shadow-[0_4px_24px_rgba(51,51,51,0.08)] focus:outline-none focus-visible:ring-2 focus-visible:ring-sage"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sage/10 text-sage">
                      <Package className="h-4 w-4" />
                    </span>
                    <span className="font-body text-sm font-medium text-charcoal">Buy Packages</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowOrderHistory(true)}
                    className="group flex items-center gap-3 rounded-xl border border-border bg-white-warm px-4 py-3.5 text-left transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-[#c8c6be] hover:shadow-[0_4px_24px_rgba(51,51,51,0.08)] focus:outline-none focus-visible:ring-2 focus-visible:ring-sage"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sage/10 text-sage">
                      <History className="h-4 w-4" />
                    </span>
                    <span className="font-body text-sm font-medium text-charcoal">Order History</span>
                  </button>

                  <CheckInScanButton
                    label="Scan check-in"
                    variant="outline"
                    className="h-auto justify-start gap-3 rounded-xl border-border bg-white-warm px-4 py-3.5 font-body text-sm font-medium text-charcoal transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-[#c8c6be] hover:bg-white-warm hover:text-charcoal hover:shadow-[0_4px_24px_rgba(51,51,51,0.08)]"
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* TOP ROW — Passes + Path to Mastery as the two lead cards (symmetric) */}
          <motion.div variants={SECTION_ITEM} className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-8">
            {/* Your Passes */}
            <Card className="border-border bg-white-warm shadow-none transition-shadow hover:shadow-[0_4px_24px_rgba(51,51,51,0.08)]">
              <CardContent className="flex h-full flex-col p-5 sm:p-6">
                <div className="mb-4 flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sage/10">
                    <AnimatedIcon icon={CreditCard} size={18} className="text-sage" />
                  </span>
                  <div>
                    <h2 className="font-body font-semibold text-lg text-charcoal">Your Passes</h2>
                    <p className="font-body text-xs text-charcoal/55">Active packages on your account</p>
                  </div>
                </div>
                {activePasses.length > 0 ? (
                  <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
                    {activePasses.map((pass) => (
                      <PassCard
                        key={pass.id}
                        name={pass.name}
                        isUnlimited={pass.isUnlimited}
                        classesRemaining={pass.classesRemaining}
                        expiry={pass.expiry}
                        durationMonths={pass.durationMonths}
                        status={pass.status}
                        className="w-full"
                      />
                    ))}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => router.push("/portal/packages")}
                    className="flex min-h-[180px] flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-sage/30 bg-white-warm p-6 text-center transition-colors duration-200 hover:border-sage/50 hover:bg-sage/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-1"
                  >
                    <Package className="h-7 w-7 text-sage/60" />
                    <span className="font-body font-semibold text-lg text-charcoal">No active pass</span>
                    <span className="font-body text-sm text-charcoal/55">Buy a package to start booking</span>
                  </button>
                )}
              </CardContent>
            </Card>

            {/* Path to Mastery */}
            <MedalJourney
              className="h-full"
              milestones={activeMilestones}
              classesCompleted={userClassesCompleted}
              earnedCustom={userBadges.filter((b: { badge_type?: string }) => b.badge_type === "custom")}
            />
          </motion.div>

          {/* STATS — attendance + streak metrics */}
          <motion.div variants={SECTION_ITEM} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {statItems.map((s) => (
              <StatCard key={s.label} {...s} />
            ))}
          </motion.div>

          {/* SCHEDULE + Movement Vitality */}
          <motion.div variants={SECTION_ITEM} className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-8">
            <div className="lg:col-span-2">
              <VitalityAreaChart
                series={vitalityData}
                totalMinutes={totalMinutes}
                avgPerDay={avgPerDay}
                vsLabel={vitalityVsPrev.text}
                vsTone={vitalityVsPrev.tone}
              />
            </div>
            <div className="lg:col-span-1 flex flex-col gap-5 lg:gap-8">
              <UpcomingScheduleCard entries={upcomingEntries} />
              <FriendsCard />
            </div>
          </motion.div>

          {/* ACTIVITY + Nourish Café */}
          <motion.div variants={SECTION_ITEM} className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-8">

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
            <Card className="border-border bg-white-warm shadow-none transition-shadow hover:shadow-[0_4px_24px_rgba(51,51,51,0.08)]">
              <CardContent className="p-5 sm:p-8">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-14 h-14 rounded-full bg-sage/10 flex items-center justify-center shrink-0">
                    <AnimatedIcon icon={Coffee} size={28} className="text-sage" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-body font-semibold text-2xl text-charcoal mb-2">Nourish</h3>
                    <p className="font-body text-sm text-charcoal/70">
                      Refuel after your movement session
                    </p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {lastCafeOrder ? (
                    <>
                      <div className="p-4 rounded-xl bg-card/60 border border-sage/10">
                        <p className="font-body text-sm text-charcoal/70 mb-2">Last Order</p>
                        <p className="font-body font-semibold text-lg text-charcoal">{lastCafeOrder}</p>
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
                    <div className="p-4 rounded-xl bg-card/60 border border-sage/10">
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
          </motion.div>
        </motion.div>
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
                    <DrawerTitle className="font-body font-semibold text-3xl text-charcoal">Order History</DrawerTitle>
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
        <div className="fixed inset-0 bg-charcoal/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white-warm rounded-lg shadow-[0_8px_48px_rgba(51,51,51,0.14)] max-w-md w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-body font-semibold text-2xl text-charcoal">Check-In</h3>
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
                    <h4 className="font-body font-semibold text-xl text-charcoal mb-2">
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
                            timeZone: "Asia/Kolkata",
                          })}
                        </p>
                      </>
                    )}
                  </>
                );
              })()}
            </div>

            {selectedBookingForCheckIn.checked_in ? (
              <div className="flex justify-center mb-4">
                <Pill tone="success">You're already checked in!</Pill>
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
                <div className="flex justify-center">
                  <Pill tone="warning" className="text-center">
                    Check-in opens 10 minutes before class and closes 15 minutes after start time.
                  </Pill>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
