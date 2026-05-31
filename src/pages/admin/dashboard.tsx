import { Fragment, useCallback, useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useRouter } from "next/router";
import { ListAvatar } from "@/components/admin/ListAvatar";
import { AdminDashboardSkeleton } from "@/components/dashboard/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users,
  Calendar,
  CreditCard,
  DollarSign,
  Download,
  Award,
  Target,
  BarChart3,
  Zap,
  Trophy,
  Plus,
  Edit,
  Mail,
  Upload,
  Save,
  Tag,
  ChefHat,
  Building2,
  UserPlus,
  ExternalLink,
} from "lucide-react";
import { SEO } from "@/components/SEO";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/responsive/ResponsiveDialog";
import { Label } from "@/components/ui/label";
import { CloseButton } from "@/components/ui/quick-actions";
import { useSession } from "next-auth/react";
import { requireSessionSSP } from "@/lib/requireSessionSSP";

// Server-side gate kills the flash-of-unauth on first paint. `useSession()`
// inside the component still returns the live session for downstream effects
// that key on `status`/`session?.user?.role`.
export const getServerSideProps = requireSessionSSP({ roles: ["admin"] });
import { passCategoryForPackageType } from "@/lib/couponHelpers";
import { usePagination } from "@/components/Pagination";
import { refreshInstructors } from "@/hooks/useInstructors";
import { toast } from "sonner";
import { ClassCheckinQr } from "@/components/checkin/ClassCheckinQr";
import { ClassCountdownPill } from "@/components/checkin/ClassCountdownPill";
import { MealWaitlistTab } from "@/components/admin/dashboard-tabs/MealWaitlistTab";
import { RentalInquiriesTab } from "@/components/admin/dashboard-tabs/RentalInquiriesTab";
import { PricingTab } from "@/components/admin/dashboard-tabs/PricingTab";
// Heavy chart-laden tabs — defer JS+recharts chunks until opened.
// `loading: () => <TabLoadingSkeleton />` prevents the production blink/
// scrollbar flash that happens when SSR renders empty body, then client
// hydrates and expands once the chunk arrives. Skeleton reserves the height.
function TabLoadingSkeleton() {
  return (
    <div className="space-y-6 min-h-[60vh]">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl border border-border bg-white-warm animate-pulse" />
        ))}
      </div>
      <div className="h-64 rounded-2xl border border-border bg-white-warm animate-pulse" />
      <div className="h-96 rounded-2xl border border-border bg-white-warm animate-pulse" />
    </div>
  );
}
const InstructorsTab = dynamic(
  () => import("@/components/admin/dashboard-tabs/InstructorsTab").then((m) => m.InstructorsTab),
  { ssr: false, loading: () => <TabLoadingSkeleton /> },
);
const ClassesTab = dynamic(
  () => import("@/components/admin/dashboard-tabs/ClassesTab").then((m) => m.ClassesTab),
  { ssr: false, loading: () => <TabLoadingSkeleton /> },
);
const MembersTab = dynamic(
  () => import("@/components/admin/dashboard-tabs/MembersTab").then((m) => m.MembersTab),
  { ssr: false, loading: () => <TabLoadingSkeleton /> },
);
// Self-fetching: pulls from the shared `useAdminFinanceData` hook (same source
// of truth as the standalone /admin/finances page), so this tab owns no finance
// state of its own.
const FinanceTabConnected = dynamic(
  () => import("@/components/admin/dashboard-tabs/FinanceTabConnected").then((m) => m.FinanceTabConnected),
  { ssr: false, loading: () => <TabLoadingSkeleton /> },
);
const OverviewTab = dynamic(
  () => import("@/components/admin/dashboard-tabs/OverviewTab").then((m) => m.OverviewTab),
  { ssr: false, loading: () => <TabLoadingSkeleton /> },
);
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const instructorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email").or(z.literal("")),
  phone: z.string().optional(),
  studio_payout_cut_percent: z.string().optional(),
  specialties: z.string().optional(),
  philosophy: z.string().optional(),
});

const ADMIN_TABS = [
  { v: "overview", l: "Overview", I: BarChart3 },
  { v: "finance", l: "Finance", I: DollarSign },
  { v: "pricing", l: "Pricing", I: Tag },
  { v: "meal-waitlist", l: "Meal waitlist", I: ChefHat },
  { v: "rental-inquiries", l: "Rentals", I: Building2 },
  { v: "members", l: "Members", I: Users },
  { v: "instructors", l: "Instructors", I: Award },
  { v: "classes", l: "Classes", I: Target },
] as const;

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [dateRange, setDateRange] = useState("month");
  const [selectedMember, setSelectedMember] = useState("all");
  const [selectedInstructor, setSelectedInstructor] = useState("all");
  const [showMemberProfile, setShowMemberProfile] = useState(false);
  const [selectedMemberProfile, setSelectedMemberProfile] = useState<any>(null);

  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
  const [showEditUserDialog, setShowEditUserDialog] = useState(false);
  const [showAddClassDialog, setShowAddClassDialog] = useState(false);
  const [showClassDetailsDialog, setShowClassDetailsDialog] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<{ id: string; name: string; time: string; currentStatus?: string; newStatus: string } | null>(null);
  const [statusChangeBusy, setStatusChangeBusy] = useState(false);
  const [selectedClassQr, setSelectedClassQr] = useState<{
    memberQrUrl?: string | null;
    instructorQrUrl?: string | null;
    withinWindow?: boolean;
    windowOpensAt?: string | null;
    historical?: boolean;
  } | null>(null);
  const [selectedClassQrLoading, setSelectedClassQrLoading] = useState(false);
  const [showPayoutDialog, setShowPayoutDialog] = useState(false);
  const [showAddInstructorDialog, setShowAddInstructorDialog] = useState(false);
  const [showEditInstructorDialog, setShowEditInstructorDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [rosterCheckingIn, setRosterCheckingIn] = useState<Record<string, boolean>>({});
  const [instructorCheckingIn, setInstructorCheckingIn] = useState(false);
  const [selectedInstructorData, setSelectedInstructorData] = useState<any>(null);
  const instructorForm = useForm<z.infer<typeof instructorSchema>>({
    resolver: zodResolver(instructorSchema),
    defaultValues: { name: "", email: "", phone: "", studio_payout_cut_percent: "", specialties: "", philosophy: "" },
  });
  const [savingInstructor, setSavingInstructor] = useState(false);

  const [dashMemberQuery, setDashMemberQuery] = useState("");
  const [dashMemberResults, setDashMemberResults] = useState<{ id: string; full_name: string | null; email: string }[]>([]);
  const [dashMemberSearching, setDashMemberSearching] = useState(false);
  const [dashAddingMemberId, setDashAddingMemberId] = useState<string | null>(null);

  // Transaction filter states

  const [coupons, setCoupons] = useState<
    {
      id: string;
      code: string;
      applies_to: string;
      discount_type: string;
      discount_value: unknown;
      is_active: boolean;
      max_redemptions: number | null;
      redemption_count: number;
      max_uses_per_user: number | null;
      starts_at: Date | string | null;
      ends_at: Date | string | null;
    }[]
  >([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [couponSaving, setCouponSaving] = useState(false);
  const [editingCouponId, setEditingCouponId] = useState<string | null>(null);
  const [couponDraft, setCouponDraft] = useState({
    code: "",
    applies_to: "food",
    discount_type: "percent",
    discount_value: "10",
    is_active: true,
    max_redemptions: "",
    max_uses_per_user: "1",
    starts_at: "",
    ends_at: "",
  });

  const [mealInquiries, setMealInquiries] = useState<
    {
      id: string;
      full_name: string;
      email: string;
      phone: string;
      message: string | null;
      status: string;
      source: string;
      created_at: string;
    }[]
  >([]);
  const [mealInquiriesLoading, setMealInquiriesLoading] = useState(false);

  const [rentalInquiries, setRentalInquiries] = useState<
    {
      id: string;
      name: string;
      email: string;
      phone: string;
      event_type: string | null;
      event_date: string | null;
      guest_count: string | null;
      duration: string | null;
      message: string | null;
      status: string;
      created_at: string;
    }[]
  >([]);
  const [rentalInquiriesLoading, setRentalInquiriesLoading] = useState(false);

  const [overviewLoaded, setOverviewLoaded] = useState(false);
  const [peakHours, setPeakHours] = useState<{ slots: string[]; days: string[]; grid: number[][]; max: number }>({ slots: [], days: [], grid: [], max: 0 });
  const [classesLoaded, setClassesLoaded] = useState(false);
  const [overviewStats, setOverviewStats] = useState({
    totalMembers: 0,
    activeToday: 0,
    expiringWeek: 0,
    monthRevenue: 0,
    cafeOrders: 0,
    pendingWaivers: 0,
  });
  const [overviewMeta, setOverviewMeta] = useState({
    classesTodayCount: 0,
    newMembersThisMonth: 0,
  });
  const [upcomingClasses, setUpcomingClasses] = useState<
    { id: string | number; scheduleId?: string; name: string; time: string; instructor: string; spots: string; status: string }[]
  >([]);
  /** Day rosters with check-in details (from /api/admin/dashboard/today-classes). */
  const [todayClassesDetail, setTodayClassesDetail] = useState<any[]>([]);
  const [todayClassesLoading, setTodayClassesLoading] = useState<boolean>(true);
  /** ISO yyyy-mm-dd date for the schedule card; defaults to today. */
  const [scheduleDate, setScheduleDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [memberStats, setMemberStats] = useState({
    memberOfMonth: { name: "—", classes: 0, streak: 0 },
    topClass: { name: "—", bookings: 0 },
    weeklyStreak: { average: 0, top: 0 },
    onTimeCheckIns: 0,
    lateCheckIns: 0,
    checkInSample: 0,
    onTimeCheckInPct: 0,
    lateCheckInPct: 0,
    noShows: 0,
    expiring7Days: 0,
    expiring15Days: 0,
    expiring30Days: 0,
    premiumActive: 0,
    specialtyActive: 0,
    inactiveUsers: 0,
    totalMembers: 0,
    activeMembers: 0,
    studioPassActive: 0,
    classPassActive: 0,
    checkInsThisMonth: 0,
    memberGrowth: [] as { month: string; growth: number }[],
    streakDistribution: [] as { range: string; count: number }[],
  });
  const [instructorPerformance, setInstructorPerformance] = useState<
    {
      name: string;
      classes: number;
      avgAttendance: number;
      totalCheckIns: number;
      rating: number;
      specialties: string;
      photo?: string | null;
    }[]
  >([]);
  const [classPerformance, setClassPerformance] = useState<
    { name: string; bookings: number; capacity: number; utilization: number; discipline: string }[]
  >([]);
  const [disciplineSplit, setDisciplineSplit] = useState<{ name: string; count: number; percentage: number }[]>(
    []
  );
  const [memberList, setMemberList] = useState<any[]>([]);
  const [expiringMembers, setExpiringMembers] = useState<
    { id: string; name: string; email: string; package: string; expires: string; credits: number }[]
  >([]);
  const [dashboardInstructors, setDashboardInstructors] = useState<any[]>([]);
  const [instructorPayouts, setInstructorPayouts] = useState<any[]>([]);

  // Auth enforced server-side (see `getServerSideProps` above). Client-side
  // `useSession()` is kept so existing effects that key on `status`/`session`
  // for runtime decisions still work; the redirect dance + ~200ms flash that
  // used to live here is gone.
  const { data: session, status } = useSession();
  const userRole = (session?.user as { role?: string })?.role;
  useEffect(() => {
    if (status === "authenticated") setLoading(false);
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (userRole !== "admin") return;
    let cancelled = false;
    (async () => {
      const r = await fetch("/api/admin/overview");
      if (!r.ok || cancelled) return;
      const d = await r.json();
      if (cancelled) return;
      setOverviewStats(d.overviewStats);
      setOverviewMeta(d.meta ?? { classesTodayCount: 0, newMembersThisMonth: 0 });
      setUpcomingClasses(Array.isArray(d.upcomingClasses) ? d.upcomingClasses : []);
      setOverviewLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, userRole]);

  /**
   * Per-section lazy loader. Tracks which slices have been fetched so a tab
   * never re-fetches its data twice. Each tab effect calls `loadSection(name, fn)`
   * which becomes a no-op after the first successful load.
   */
  const loadedRef = useRef<Set<string>>(new Set());
  const inflightRef = useRef<Map<string, Promise<void>>>(new Map());
  const loadSection = (key: string, run: () => Promise<boolean | void>): Promise<void> => {
    if (loadedRef.current.has(key)) return Promise.resolve();
    const existing = inflightRef.current.get(key);
    if (existing) return existing;
    const p = (async () => {
      try {
        // Only mark loaded when the callback actually applied data. A callback
        // that bails (cancelled tab switch, !r.ok) returns false so the section
        // is retried on the next mount instead of being stuck on stale defaults.
        const applied = await run();
        if (applied !== false) loadedRef.current.add(key);
      } finally {
        inflightRef.current.delete(key);
      }
    })();
    inflightRef.current.set(key, p);
    return p;
  };

  /** Overview tab: today's classes, expiring members, member stats (for top-class card), instructor payouts. */
  useEffect(() => {
    if (status !== "authenticated") return;
    if (userRole !== "admin" || activeTab !== "overview") return;
    let cancelled = false;

    // Always refetch on date change — bypass loadSection cache. The cache +
    // StrictMode double-effect can leave loading stuck true on first mount:
    // mount-1 fills loadedRef, cleanup sets cancelled, mount-2's call short-
    // circuits, and mount-1's finally skips the setLoading(false) because
    // cancelled is now true.
    // Don't clear existing items — keeps the carousel mounted so only the
    // inner cards swap when the response arrives. A subtle opacity dim on the
    // wrapper signals the refetch without resizing the outer card.
    setTodayClassesLoading(true);
    void (async () => {
      try {
        const r = await fetch(`/api/admin/dashboard/today-classes?date=${encodeURIComponent(scheduleDate)}`);
        if (!r.ok || cancelled) return;
        const d = await r.json();
        if (cancelled) return;
        if (Array.isArray(d.todayClasses)) setTodayClassesDetail(d.todayClasses);
      } finally {
        if (!cancelled) setTodayClassesLoading(false);
      }
    })();
    void loadSection("expiring-members", async () => {
      const r = await fetch("/api/admin/dashboard/expiring-members");
      if (!r.ok) return false;
      const d = await r.json();
      if (Array.isArray(d.expiringMembers)) setExpiringMembers(d.expiringMembers);
      return true;
    });
    void loadSection("member-stats", async () => {
      const r = await fetch("/api/admin/dashboard/member-stats");
      if (!r.ok) return false;
      const d = await r.json();
      if (d.memberStats) setMemberStats(d.memberStats);
      return true;
    });
    void loadSection("instructor-payouts", async () => {
      const r = await fetch("/api/admin/instructor-payouts?window=month");
      if (!r.ok || cancelled) return;
      const pay = await r.json();
      if (cancelled) return;
      setInstructorPayouts(Array.isArray(pay.instructors) ? pay.instructors : []);
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, userRole, activeTab, scheduleDate]);

  /** Fetch check-in QR when the class-details dialog opens for a class. */
  useEffect(() => {
    if (!showClassDetailsDialog || !selectedClass?.id) {
      setSelectedClassQr(null);
      return;
    }
    let cancelled = false;
    setSelectedClassQrLoading(true);
    setSelectedClassQr(null);
    (async () => {
      try {
        const r = await fetch(`/api/admin/schedule-qr?scheduleId=${selectedClass.id}`);
        if (!r.ok || cancelled) return;
        const d = await r.json();
        if (!cancelled) setSelectedClassQr(d);
      } finally {
        if (!cancelled) setSelectedClassQrLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [showClassDetailsDialog, selectedClass?.id]);

  /** Members tab. */
  useEffect(() => {
    if (status !== "authenticated") return;
    if (userRole !== "admin" || activeTab !== "members") return;
    let cancelled = false;

    void loadSection("member-stats", async () => {
      const r = await fetch("/api/admin/dashboard/member-stats");
      if (!r.ok) return false;
      const d = await r.json();
      if (d.memberStats) setMemberStats(d.memberStats);
      return true;
    });
    void loadSection("member-list", async () => {
      const r = await fetch("/api/admin/dashboard/member-list");
      if (!r.ok) return false;
      const d = await r.json();
      if (Array.isArray(d.memberList)) setMemberList(d.memberList);
      return true;
    });
    void loadSection("expiring-members", async () => {
      const r = await fetch("/api/admin/dashboard/expiring-members");
      if (!r.ok) return false;
      const d = await r.json();
      if (Array.isArray(d.expiringMembers)) setExpiringMembers(d.expiringMembers);
      return true;
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, userRole, activeTab]);

  /** Instructors tab. */
  useEffect(() => {
    if (status !== "authenticated") return;
    if (userRole !== "admin" || activeTab !== "instructors") return;
    let cancelled = false;

    void loadSection("instructor-performance", async () => {
      const r = await fetch("/api/admin/dashboard/instructor-performance");
      if (!r.ok || cancelled) return;
      const d = await r.json();
      if (!cancelled && Array.isArray(d.instructorPerformance)) setInstructorPerformance(d.instructorPerformance);
    });
    void loadSection("instructors-summary", async () => {
      const r = await fetch("/api/admin/dashboard/instructors-summary");
      if (!r.ok || cancelled) return;
      const d = await r.json();
      if (!cancelled && Array.isArray(d.instructors)) setDashboardInstructors(d.instructors);
    });
    void loadSection("instructor-payouts", async () => {
      const r = await fetch("/api/admin/instructor-payouts?window=month");
      if (!r.ok || cancelled) return;
      const pay = await r.json();
      if (cancelled) return;
      const coachPayments = Number(pay.summary?.totalPayouts ?? 0);
      setInstructorPayouts(Array.isArray(pay.instructors) ? pay.instructors : []);
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, userRole, activeTab]);

  /** Classes tab. */
  useEffect(() => {
    if (status !== "authenticated") return;
    if (userRole !== "admin" || activeTab !== "classes") return;
    let cancelled = false;

    void loadSection("class-performance", async () => {
      const r = await fetch("/api/admin/dashboard/class-performance");
      if (!r.ok || cancelled) return;
      const d = await r.json();
      if (!cancelled) {
        if (Array.isArray(d.classPerformance)) setClassPerformance(d.classPerformance);
        if (Array.isArray(d.disciplineSplit)) setDisciplineSplit(d.disciplineSplit);
        setClassesLoaded(true);
      }
    });

    void loadSection("peak-hours", async () => {
      const r = await fetch("/api/admin/dashboard/peak-hours");
      if (!r.ok || cancelled) return;
      const d = await r.json();
      if (!cancelled && Array.isArray(d.grid)) {
        setPeakHours({ slots: d.slots ?? [], days: d.days ?? [], grid: d.grid, max: Number(d.max ?? 0) });
      }
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, userRole, activeTab]);

  // Finance tab data now lives in `FinanceTabConnected` via `useAdminFinanceData`
  // (shared with /admin/finances). The dashboard no longer fetches it here.

  useEffect(() => {
    if (status !== "authenticated") return;
    const role = (session?.user as { role?: string })?.role;
    if (role !== "admin" || activeTab !== "pricing") return;
    let cancelled = false;
    setCouponsLoading(true);
    void (async () => {
      try {
        const r = await fetch("/api/admin/coupons");
        if (cancelled) return;
        if (!r.ok) {
          setCoupons([]);
          return;
        }
        const d = await r.json();
        if (!cancelled) setCoupons(Array.isArray(d) ? d : []);
      } finally {
        if (!cancelled) setCouponsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, userRole, activeTab]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const role = (session?.user as { role?: string })?.role;
    if (role !== "admin" || activeTab !== "meal-waitlist") return;
    let cancelled = false;
    setMealInquiriesLoading(true);
    void (async () => {
      try {
        const r = await fetch("/api/admin/meal-subscription-inquiries");
        if (cancelled) return;
        if (!r.ok) {
          setMealInquiries([]);
          return;
        }
        const d = await r.json();
        if (!cancelled) setMealInquiries(Array.isArray(d) ? d : []);
      } finally {
        if (!cancelled) setMealInquiriesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, userRole, activeTab]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const role = (session?.user as { role?: string })?.role;
    if (role !== "admin" || activeTab !== "rental-inquiries") return;
    let cancelled = false;
    setRentalInquiriesLoading(true);
    void (async () => {
      try {
        const r = await fetch("/api/admin/rental-inquiries");
        if (cancelled) return;
        if (!r.ok) {
          setRentalInquiries([]);
          return;
        }
        const d = await r.json();
        if (!cancelled) setRentalInquiries(Array.isArray(d) ? d : []);
      } finally {
        if (!cancelled) setRentalInquiriesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, userRole, activeTab]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSelectOverviewClass = useCallback((cls: any) => {
    setSelectedClass(cls);
    setShowClassDetailsDialog(true);
    if (cls?.id) {
      fetch(`/api/admin/class-roster?scheduleId=${cls.id}`)
        .then((r) => (r.ok ? r.json() : null))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then((data: any) => {
          if (data) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setSelectedClass((prev: any) => ({
              ...prev,
              instructorCheckedIn: !!data.instructorCheckedIn,
              instructorCheckInTime: data.instructorCheckInTime ?? null,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              attendees: data.bookings.map((b: any) => ({
                id: b.id,
                bookingId: b.id,
                name: b.name,
                email: b.email,
                avatarUrl: b.avatarUrl,
                checkedIn: b.checkedIn,
                checkInTime: b.checkInTime ? new Date(b.checkInTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }) : null,
                checkInOutcome: b.checkInOutcome,
                confirmationStatus: b.confirmationStatus ?? null,
              })),
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              checkedIn: data.bookings.filter((b: any) => b.checkedIn).length,
              enrolled: data.bookings.length,
            }));
          }
        })
        .catch(() => {});
    }
  }, []);

  const EMPTY_COUPON_DRAFT = {
    code: "",
    applies_to: "food",
    discount_type: "percent",
    discount_value: "10",
    is_active: true,
    max_redemptions: "",
    max_uses_per_user: "1",
    starts_at: "",
    ends_at: "",
  };
  const saveCouponFromDraft = useCallback(async () => {
    setCouponSaving(true);
    try {
      const body = {
        code: couponDraft.code,
        applies_to: couponDraft.applies_to,
        discount_type: couponDraft.discount_type,
        discount_value: Number(couponDraft.discount_value),
        is_active: couponDraft.is_active,
        max_redemptions: couponDraft.max_redemptions.trim() === "" ? null : couponDraft.max_redemptions,
        max_uses_per_user: couponDraft.max_uses_per_user.trim() === "" ? null : couponDraft.max_uses_per_user,
        starts_at: couponDraft.starts_at.trim() === "" ? null : couponDraft.starts_at,
        ends_at: couponDraft.ends_at.trim() === "" ? null : couponDraft.ends_at,
      };
      const res = editingCouponId
        ? await fetch("/api/admin/coupons", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: editingCouponId, ...body }),
          })
        : await fetch("/api/admin/coupons", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(typeof err?.error === "string" ? err.error : "Could not save coupon");
        return;
      }
      setEditingCouponId(null);
      setCouponDraft(EMPTY_COUPON_DRAFT);
      const listRes = await fetch("/api/admin/coupons");
      if (listRes.ok) {
        const d = await listRes.json();
        setCoupons(Array.isArray(d) ? d : []);
      }
    } finally {
      setCouponSaving(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couponDraft, editingCouponId]);

  const deleteCouponById = useCallback(async (id: string) => {
    if (!confirm("Delete this coupon?")) return;
    const res = await fetch(`/api/admin/coupons?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Could not delete coupon");
      return;
    }
    setCoupons((prev) => prev.filter((c) => c.id !== id));
    setEditingCouponId((prev) => (prev === id ? null : prev));
    setCouponDraft((prev) => (editingCouponId === id ? EMPTY_COUPON_DRAFT : prev));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingCouponId]);

  const startEditCoupon = useCallback((c: (typeof coupons)[0]) => {
    setEditingCouponId(c.id);
    setCouponDraft({
      code: c.code,
      applies_to: c.applies_to,
      discount_type: c.discount_type,
      discount_value: String(c.discount_value),
      is_active: c.is_active,
      max_redemptions: c.max_redemptions == null ? "" : String(c.max_redemptions),
      max_uses_per_user: c.max_uses_per_user == null ? "" : String(c.max_uses_per_user),
      starts_at: c.starts_at ? new Date(c.starts_at).toISOString().slice(0, 16) : "",
      ends_at: c.ends_at ? new Date(c.ends_at).toISOString().slice(0, 16) : "",
    });
  }, []);

  const cancelCouponEdit = useCallback(() => {
    setEditingCouponId(null);
    setCouponDraft(EMPTY_COUPON_DRAFT);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateMealInquiryStatus = useCallback(async (id: string, status: string) => {
    const res = await fetch("/api/admin/meal-subscription-inquiries", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok) return;
    const updated = await res.json();
    setMealInquiries((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: String(updated.status ?? status) } : r))
    );
  }, []);

  async function handleCreateInstructor(data: z.infer<typeof instructorSchema>) {
    setSavingInstructor(true);
    try {
      const body: Record<string, unknown> = { name: data.name };
      if (data.email) body.email = data.email;
      if (data.phone?.trim()) body.phone = data.phone.trim();
      if (data.studio_payout_cut_percent?.trim())
        body.studio_payout_cut_percent = parseFloat(data.studio_payout_cut_percent);
      if (data.specialties?.trim())
        body.specialties = data.specialties.split(",").map((s) => s.trim()).filter(Boolean);
      if (data.philosophy?.trim()) body.philosophy = data.philosophy.trim();
      const res = await fetch("/api/admin/instructors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to create instructor");
      setShowAddInstructorDialog(false);
      instructorForm.reset();
      const updated = await fetch("/api/admin/instructors");
      if (updated.ok) setDashboardInstructors(await updated.json());
      // Revalidate the shared roster cache so other admin pages pick up the
      // newly-created instructor without their own refetch.
      void refreshInstructors();
    } catch {
      toast.error("Failed to save instructor.");
    } finally {
      setSavingInstructor(false);
    }
  }

  async function applyRosterOutcome(
    attendee: { id: string; bookingId?: string; checkInTime?: string | null },
    outcome: "on_time" | "late" | "no_show" | "not_checked_in",
  ) {
    const bookingId = attendee.bookingId ?? attendee.id;
    setRosterCheckingIn((prev) => ({ ...prev, [attendee.id]: true }));
    try {
      const res = await fetch("/api/admin/manual-check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, outcome }),
      });
      if (!res.ok) throw new Error();
      const checkedIn = outcome === "on_time" || outcome === "late";
      setSelectedClass((prev: any) => {
        if (!prev) return prev;
        const attendees = (prev.attendees ?? []).map((a: any) =>
          a.id === attendee.id
            ? {
                ...a,
                checkedIn,
                checkInOutcome: outcome === "not_checked_in" ? null : outcome,
                checkInTime: checkedIn
                  ? a.checkInTime ?? new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })
                  : null,
              }
            : a,
        );
        return { ...prev, attendees, checkedIn: attendees.filter((a: any) => a.checkedIn).length };
      });
    } catch {
      toast.error("Could not update status");
    } finally {
      setRosterCheckingIn((prev) => ({ ...prev, [attendee.id]: false }));
    }
  }

  async function handleInstructorCheckIn(checked: boolean) {
    if (!selectedClass?.id) return;
    setInstructorCheckingIn(true);
    try {
      const res = await fetch("/api/admin/instructor-check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduleId: selectedClass.id, checked }),
      });
      if (!res.ok) throw new Error();
      const d = await res.json();
      setSelectedClass((prev: any) =>
        prev ? { ...prev, instructorCheckedIn: !!d.instructorCheckedIn, instructorCheckInTime: d.instructorCheckInTime } : prev,
      );
    } catch {
      toast.error("Could not update instructor check-in");
    } finally {
      setInstructorCheckingIn(false);
    }
  }

  async function searchDashMembers(q: string) {
    setDashMemberQuery(q);
    if (q.length < 2) { setDashMemberResults([]); return; }
    setDashMemberSearching(true);
    try {
      const res = await fetch(`/api/admin/members-search?q=${encodeURIComponent(q)}`);
      if (res.ok) setDashMemberResults(await res.json());
    } finally {
      setDashMemberSearching(false);
    }
  }

  async function handleDashAddMember(userId: string) {
    if (!selectedClass?.id) return;
    setDashAddingMemberId(userId);
    try {
      const res = await fetch("/api/admin/add-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduleId: selectedClass.id, userId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error((body as { error?: string }).error ?? "Failed to add member");
        return;
      }
      const { booking } = await res.json();
      setSelectedClass((prev: any) => ({
        ...prev,
        enrolled: (prev.enrolled ?? 0) + 1,
        attendees: [
          ...(prev.attendees ?? []),
          { id: booking.userId, bookingId: booking.id, name: booking.name, email: booking.email, avatarUrl: booking.avatarUrl, checkedIn: false, checkInTime: null, checkInOutcome: null },
        ],
      }));
      setDashMemberQuery("");
      setDashMemberResults([]);
    } finally {
      setDashAddingMemberId(null);
    }
  }

  const handleViewProfile = useCallback((member: Record<string, unknown>) => {
    const uid = String(member.profileId ?? member.id ?? "");
    if (!uid) return;
    void (async () => {
      try {
        const [snapRes, ordersRes] = await Promise.all([
          fetch(`/api/admin/members?id=${encodeURIComponent(uid)}`),
          fetch("/api/cafe/orders"),
        ]);
        const orders = ordersRes.ok ? await ordersRes.json() : [];
        const snap = snapRes.ok ? await snapRes.json() : null;

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const bookings = Array.isArray(snap?.bookings) ? snap.bookings : [];

        const upcomingBookings = bookings
          .filter((b: { class_schedule?: { start_time?: string } }) => {
            const st = b.class_schedule?.start_time;
            return st ? new Date(st) >= startOfToday : false;
          })
          .sort(
            (
              a: { class_schedule?: { start_time?: string } },
              b: { class_schedule?: { start_time?: string } }
            ) =>
              new Date(a.class_schedule!.start_time!).getTime() -
              new Date(b.class_schedule!.start_time!).getTime()
          )
          .slice(0, 8)
          .map((b: Record<string, unknown>) => {
            const sch = b.class_schedule as { start_time?: string; class_model?: { name?: string } } | undefined;
            const st = sch?.start_time;
            return {
              class: sch?.class_model?.name || (b.class_name as string) || "Class",
              date: st || (b.booking_date as string),
              time: st
                ? new Date(st).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
                : ((b.class_time as string) ?? "—"),
            };
          });

        const pastChecked = bookings
          .filter(
            (b: Record<string, unknown>) =>
              b.checked_in &&
              (b.class_schedule as { start_time?: string } | undefined)?.start_time &&
              new Date((b.class_schedule as { start_time: string }).start_time) < now
          )
          .sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
            const ta = new Date(
              (a.check_in_time as string) || (a.class_schedule as { start_time: string }).start_time
            ).getTime();
            const tb = new Date(
              (b.check_in_time as string) || (b.class_schedule as { start_time: string }).start_time
            ).getTime();
            return tb - ta;
          });
        const lastB = pastChecked[0] as Record<string, unknown> | undefined;
        const schLast = lastB?.class_schedule as { class_model?: { name?: string }; start_time?: string } | undefined;
        const lastClass = lastB ? schLast?.class_model?.name || (lastB.class_name as string) || "Class" : "—";
        const lastAttendanceRaw = lastB
          ? String(lastB.check_in_time || schLast?.start_time || lastB.booking_date || "")
          : "";

        const orderHistory = (Array.isArray(orders) ? orders : [])
          .filter((o: { user_id?: string }) => o.user_id === uid)
          .slice(0, 24)
          .map((o: Record<string, unknown>) => {
            const item = o.cafe_item as { name?: string; price?: unknown } | undefined;
            return {
              item: item?.name ?? "Café item",
              date: o.order_date as string,
              amount: Math.round(Number(item?.price ?? 0) * Number(o.quantity ?? 1)),
            };
          });

        const badges = Array.isArray(snap?.user_badges)
          ? (snap.user_badges as { badge_name: string }[]).map((b) => b.badge_name)
          : [];

        // Every past class this member booked, with its attendance outcome.
        const attendanceHistory = bookings
          .filter((b: Record<string, unknown>) => {
            const st = (b.class_schedule as { start_time?: string } | undefined)?.start_time;
            const when = st ? new Date(st) : b.class_time ? new Date(b.class_time as string) : null;
            return when ? when < now : false;
          })
          .map((b: Record<string, unknown>) => {
            const sch = b.class_schedule as { start_time?: string; class_model?: { name?: string } } | undefined;
            const st = sch?.start_time;
            const outcomeRaw = (b.check_in_outcome as string | null) ?? null;
            const outcome = outcomeRaw ?? (b.checked_in ? "on_time" : "no_show");
            return {
              class: sch?.class_model?.name || (b.class_name as string) || "Class",
              date: st || (b.class_time as string) || (b.booking_date as string),
              outcome, // "on_time" | "late" | "no_show"
            };
          })
          .sort(
            (a: { date: string }, b: { date: string }) =>
              new Date(b.date).getTime() - new Date(a.date).getTime()
          );

        // Active pass summary: studio/unlimited → infinite credits; class pass → credits left. Both show expiry.
        const pkgs = Array.isArray(snap?.user_packages) ? (snap.user_packages as Record<string, unknown>[]) : [];
        const activePkg = pkgs.find((p) => p.is_active) ?? pkgs[0];
        const pt = activePkg?.package_type as { name?: string; is_unlimited?: boolean; type?: string } | undefined;
        const isUnlimited = activePkg ? passCategoryForPackageType(pt ?? {}) === "studio_pass" : false;
        const creditsLeft = Number(activePkg?.credits_remaining ?? 0);
        const creditsDisplay = activePkg ? (isUnlimited ? "∞" : String(creditsLeft)) : "—";
        const packageName = pt?.name || (member.package as string) || "—";
        const passExpiryISO = (activePkg?.expiration_date as string | undefined) ?? null;

        const profileData = {
          ...member,
          credits: creditsDisplay,
          package: packageName,
          isUnlimited,
          passExpiryISO,
          name: snap?.full_name ?? member.name,
          email: snap?.email ?? member.email,
          phone: snap?.phone ?? "—",
          joinDate: snap?.created_at ?? new Date().toISOString(),
          totalClasses: snap?.user_stats?.total_classes_attended ?? 0,
          weeklyStreak: snap?.user_stats?.current_streak ?? snap?.movement_streak ?? 0,
          lastClass,
          lastAttendance: lastAttendanceRaw,
          favoriteClass: "—",
          badges,
          upcomingBookings,
          orderHistory,
          attendanceHistory,
        };
        setSelectedMemberProfile(profileData);
        setShowMemberProfile(true);
      } catch {
        setSelectedMemberProfile({
          ...member,
          phone: "—",
          joinDate: new Date().toISOString(),
          totalClasses: 0,
          weeklyStreak: 0,
          lastClass: "—",
          lastAttendance: "",
          favoriteClass: "—",
          badges: [],
          upcomingBookings: [],
          orderHistory: [],
          attendanceHistory: [],
          isUnlimited: false,
          passExpiryISO: null,
        });
        setShowMemberProfile(true);
      }
    })();
  }, []);

  // Stable identities so the memoized OverviewTab isn't re-rendered on every
  // parent state change (the dashboard holds dozens of useState + timers).
  const handleManageClass = useCallback(
    (id: string) => router.push(`/admin/schedule/${id}`),
    [router],
  );
  const handleOpenCRM = useCallback(() => router.push("/admin/CRM"), [router]);
  const handleOpenCafe = useCallback(() => router.push("/admin/cafe"), [router]);

  // Pagination hooks for dashboard lists — resetKey resets page to 1 on filter change
  const expiringPg = usePagination(expiringMembers);

  if (loading) {
    return <AdminDashboardSkeleton />;
  }

  return (
    <>
      <SEO
        title="Admin Dashboard - The Studio"
        description="Manage classes, members, and operations"
      />
      
      {/* overflow-x-hidden: prevents horizontal page scrollbar during dynamic-tab
          chunk fetches in production (server-rendered empty → client expands → layout shift). */}
      <div className="min-h-screen overflow-x-hidden bg-linear-to-br from-cream via-cream to-sage/10">
        <main className="min-h-screen overflow-x-hidden">
          <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-8">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h1 className="font-display text-3xl md:text-4xl text-charcoal leading-tight">Dashboard</h1>
                <p className="font-body text-charcoal/60">Welcome back, {(session?.user?.name?.trim().split(" ")[0]) || "Admin"}. Here&apos;s what&apos;s happening today.</p>
              </div>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-36 border-sage/20 font-body">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="quarter">This Quarter</SelectItem>
                  <SelectItem value="year">This Year</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              {/* Mobile: dropdown picker (no horizontal scroll) */}
              <Select value={activeTab} onValueChange={setActiveTab}>
                <SelectTrigger className="md:hidden w-full border-sage/20 font-body">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADMIN_TABS.map((t) => (
                    <SelectItem key={t.v} value={t.v} className="font-body">
                      {t.l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Desktop: tab row */}
              <TabsList className="hidden md:flex bg-cream/50 border border-sage/15 p-1 flex-wrap gap-1 h-auto justify-start w-auto">
                {ADMIN_TABS.map((t) => (
                  <TabsTrigger
                    key={t.v}
                    value={t.v}
                    className="font-body gap-2 px-3 text-charcoal/60 data-[state=active]:bg-sage data-[state=active]:text-white data-[state=active]:shadow-xs"
                  >
                    <t.I className="h-4 w-4" />
                    {t.l}
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* OVERVIEW TAB */}
              <TabsContent value="overview" className="space-y-6">
                <OverviewTab
                  overviewStats={overviewStats}
                  overviewMeta={overviewMeta}
                  overviewLoaded={overviewLoaded}
                  scheduleDate={scheduleDate}
                  onScheduleDateChange={setScheduleDate}
                  todayClassesDetail={todayClassesDetail}
                  todayClassesLoading={todayClassesLoading}
                  upcomingClasses={upcomingClasses}
                  expiringMembers={expiringMembers}
                  expiringPg={expiringPg}
                  onManageClass={handleManageClass}
                  onStatusChange={setPendingStatusChange}
                  onSelectClass={handleSelectOverviewClass}
                  onViewProfile={handleViewProfile}
                  onOpenCRM={handleOpenCRM}
                  onOpenCafe={handleOpenCafe}
                />
              </TabsContent>

              {/* FINANCE TAB */}
              <TabsContent value="finance" className="space-y-6">
                <FinanceTabConnected />
              </TabsContent>

              {/* PRICING & COUPONS */}
              <TabsContent value="pricing" className="space-y-6">
                <PricingTab
                  coupons={coupons}
                  loading={couponsLoading}
                  saving={couponSaving}
                  editingId={editingCouponId}
                  draft={couponDraft}
                  onDraftChange={setCouponDraft}
                  onSave={saveCouponFromDraft}
                  onCancelEdit={cancelCouponEdit}
                  onEdit={startEditCoupon}
                  onDelete={deleteCouponById}
                />
              </TabsContent>


              {/* MEAL SUBSCRIPTION WAITLIST */}
              <TabsContent value="meal-waitlist" className="space-y-6">
                <MealWaitlistTab
                  inquiries={mealInquiries}
                  loading={mealInquiriesLoading}
                  onUpdateStatus={updateMealInquiryStatus}
                />
              </TabsContent>

              <TabsContent value="rental-inquiries" className="space-y-6">
                <RentalInquiriesTab
                  inquiries={rentalInquiries}
                  loading={rentalInquiriesLoading}
                />
              </TabsContent>

              {/* MEMBERS TAB */}
              <TabsContent value="members" className="space-y-6">
                <MembersTab
                  memberList={memberList}
                  memberStats={memberStats}
                  selectedMember={selectedMember}
                  onSelectMember={setSelectedMember}
                  onViewProfile={handleViewProfile}
                />
              </TabsContent>

              {/* INSTRUCTORS TAB */}
              <TabsContent value="instructors" className="space-y-6">
                <InstructorsTab
                  dashboardInstructors={dashboardInstructors}
                  instructorPerformance={instructorPerformance}
                  selectedInstructor={selectedInstructor}
                  onSelectInstructor={setSelectedInstructor}
                />
              </TabsContent>

              {/* CLASSES TAB */}
              <TabsContent value="classes" className="space-y-6">
                <ClassesTab
                  classPerformance={classPerformance}
                  disciplineSplit={disciplineSplit}
                  peakHours={peakHours}
                  classesLoaded={classesLoaded}
                />
              </TabsContent>
            </Tabs>

          </div>
        </main>
      </div>

      {/* Add User Dialog */}
      <ResponsiveDialog open={showAddUserDialog} onOpenChange={setShowAddUserDialog}>
        <ResponsiveDialogContent className="max-w-2xl bg-white-warm border-sage/20">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="font-display text-2xl text-charcoal">Add New User</ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="font-body text-charcoal/60">
              Create a new member account with package and credits
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="font-body text-charcoal">Full Name</Label>
              <Input id="name" placeholder="John Doe" className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="font-body text-charcoal">Email</Label>
              <Input id="email" type="email" placeholder="john@email.com" className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className="font-body text-charcoal">Phone Number</Label>
              <Input id="phone" placeholder="+91 98765 43210" className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="package" className="font-body text-charcoal">Package Type</Label>
              <Select defaultValue="premium">
                <SelectTrigger className="border-sage/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="premium">Premium Pass</SelectItem>
                  <SelectItem value="specialty">Aerial Specialty Pass</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="credits" className="font-body text-charcoal">Initial Classes</Label>
              <Input id="credits" type="number" placeholder="12" className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiry" className="font-body text-charcoal">Expiry Date</Label>
              <Input id="expiry" type="date" className="border-sage/20 focus:ring-sage" />
            </div>
            <div className="col-span-2 space-y-2">
              <Label htmlFor="address" className="font-body text-charcoal">Address (Optional)</Label>
              <Textarea id="address" placeholder="Enter full address..." className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40" />
            </div>
          </div>
          <ResponsiveDialogFooter>
            <Button variant="outline" onClick={() => setShowAddUserDialog(false)} className="border-sage/20 font-body">
              Cancel
            </Button>
            <Button variant="sage">
              <Save className="h-4 w-4 mr-2" />
              Create User
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {/* Edit User Dialog */}
      <ResponsiveDialog open={showEditUserDialog} onOpenChange={setShowEditUserDialog}>
        <ResponsiveDialogContent className="max-w-2xl bg-white-warm border-sage/20">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="font-display text-2xl text-charcoal">Edit User</ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="font-body text-charcoal/60">
              Update member information, package, or classes
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          {selectedUser && (
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name" className="font-body text-charcoal">Full Name</Label>
                <Input id="edit-name" defaultValue={selectedUser.name} className="border-sage/20 focus:ring-sage" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email" className="font-body text-charcoal">Email</Label>
                <Input id="edit-email" type="email" defaultValue={selectedUser.email} className="border-sage/20 focus:ring-sage" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone" className="font-body text-charcoal">Phone Number</Label>
                <Input id="edit-phone" defaultValue={selectedUser.phone} className="border-sage/20 focus:ring-sage" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-package" className="font-body text-charcoal">Package Type</Label>
                <Select defaultValue={selectedUser.package.toLowerCase()}>
                  <SelectTrigger className="border-sage/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="premium">Premium Pass</SelectItem>
                    <SelectItem value="specialty">Aerial Specialty Pass</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-credits" className="font-body text-charcoal">Classes</Label>
                <div className="flex gap-2">
                  <Input id="edit-credits" type="number" defaultValue={selectedUser.credits} className="border-sage/20 focus:ring-sage" />
                  <Button variant="sage-outline" size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-expiry" className="font-body text-charcoal">Expiry Date</Label>
                <Input id="edit-expiry" type="date" defaultValue={selectedUser.expiry} className="border-sage/20 focus:ring-sage" />
              </div>
            </div>
          )}
          <ResponsiveDialogFooter>
            <Button variant="outline" onClick={() => setShowEditUserDialog(false)} className="border-sage/20 font-body">
              Cancel
            </Button>
            <Button variant="sage">
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {/* Add Class Dialog */}
      <ResponsiveDialog open={showAddClassDialog} onOpenChange={setShowAddClassDialog}>
        <ResponsiveDialogContent className="max-w-2xl bg-white-warm border-sage/20">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="font-display text-2xl text-charcoal">Create New Class</ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="font-body text-charcoal/60">
              Schedule a one-time or recurring class
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="class-name" className="font-body text-charcoal">Class Name</Label>
              <Select>
                <SelectTrigger className="border-sage/20">
                  <SelectValue placeholder="Select class type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="muay-thai">Muay Thai Circuit</SelectItem>
                  <SelectItem value="aerial-yoga">Aerial Yoga</SelectItem>
                  <SelectItem value="warrior-rhythm">Warrior Rhythm</SelectItem>
                  <SelectItem value="warrior-strength">Warrior Strength</SelectItem>
                  <SelectItem value="hatha-yoga">Hatha Yoga</SelectItem>
                  <SelectItem value="mat-pilates">Mat Pilates</SelectItem>
                  <SelectItem value="animal-flow">Animal Flow</SelectItem>
                  <SelectItem value="barre-57">Barre 57</SelectItem>
                  <SelectItem value="physique-57">Physique 57</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="instructor" className="font-body text-charcoal">Instructor</Label>
              <Select>
                <SelectTrigger className="border-sage/20">
                  <SelectValue placeholder="Select instructor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vivek">Vivek</SelectItem>
                  <SelectItem value="usha">Usha</SelectItem>
                  <SelectItem value="akshata">Akshata</SelectItem>
                  <SelectItem value="prachi">Prachi</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="class-date" className="font-body text-charcoal">Date</Label>
              <Input id="class-date" type="date" className="border-sage/20 focus:ring-sage" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="class-time" className="font-body text-charcoal">Time</Label>
              <Input id="class-time" type="time" className="border-sage/20 focus:ring-sage" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="capacity" className="font-body text-charcoal">Capacity</Label>
              <Input id="capacity" type="number" placeholder="12" className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration" className="font-body text-charcoal">Duration (minutes)</Label>
              <Input id="duration" type="number" placeholder="60" className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40" />
            </div>
            <div className="col-span-2 space-y-2">
              <div className="flex items-center space-x-2">
                <input type="checkbox" id="recurring" className="rounded border-sage/20 text-sage focus:ring-sage" />
                <Label htmlFor="recurring" className="font-body text-charcoal">Make this a recurring class</Label>
              </div>
            </div>
          </div>
          <ResponsiveDialogFooter>
            <Button variant="outline" onClick={() => setShowAddClassDialog(false)} className="border-sage/20 font-body">
              Cancel
            </Button>
            <Button variant="sage">
              <Save className="h-4 w-4 mr-2" />
              Create Class
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {/* Confirm class status change */}
      <AlertDialog
        open={!!pendingStatusChange}
        onOpenChange={(open) => { if (!open && !statusChangeBusy) setPendingStatusChange(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">
              {pendingStatusChange?.newStatus === "available"
                ? "Reactivate this class?"
                : pendingStatusChange?.newStatus === "inactive"
                ? "Set this class to inactive?"
                : pendingStatusChange?.newStatus === "cancelled"
                ? "Cancel this class?"
                : "Change class status?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="font-body">
              {pendingStatusChange?.name} at {pendingStatusChange?.time} — status will change from{" "}
              <span className="capitalize font-medium">{pendingStatusChange?.currentStatus ?? "available"}</span>
              {" "}to{" "}
              <span className="capitalize font-medium">{pendingStatusChange?.newStatus}</span>.
              {pendingStatusChange?.newStatus === "cancelled" && " Bookings will be blocked."}
              {pendingStatusChange?.newStatus === "inactive" && " The class will be hidden from members."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={statusChangeBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={statusChangeBusy}
              onClick={async (e) => {
                e.preventDefault();
                if (!pendingStatusChange) return;
                const { id, newStatus } = pendingStatusChange;
                setStatusChangeBusy(true);
                try {
                  const res = await fetch(`/api/class-schedules`, {
                    method: "PUT",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id, status: newStatus }),
                  });
                  if (!res.ok) throw new Error(`HTTP ${res.status}`);
                  setTodayClassesDetail((prev) =>
                    prev.map((c: any) => (c.id === id ? { ...c, status: newStatus } : c)),
                  );
                  toast.success(
                    newStatus === "available"
                      ? "Class reactivated"
                      : newStatus === "inactive"
                      ? "Class set to inactive"
                      : newStatus === "cancelled"
                      ? "Class cancelled"
                      : "Status updated",
                  );
                  setPendingStatusChange(null);
                } catch (err) {
                  toast.error(`Could not change status: ${(err as Error).message}`);
                } finally {
                  setStatusChangeBusy(false);
                }
              }}
            >
              {statusChangeBusy ? "Saving…" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Class Details Dialog */}
      <ResponsiveDialog open={showClassDetailsDialog} onOpenChange={(open) => { setShowClassDetailsDialog(open); if (!open) { setRosterCheckingIn({}); setDashMemberQuery(""); setDashMemberResults([]); } }}>
        <ResponsiveDialogContent className="max-w-3xl bg-white-warm border-sage/20">
          <ResponsiveDialogHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <ResponsiveDialogTitle className="font-display text-2xl text-charcoal">
                  {selectedClass?.name} - Class Details
                </ResponsiveDialogTitle>
                <ResponsiveDialogDescription className="font-body text-charcoal/60">
                  {selectedClass?.time} with {selectedClass?.instructor}
                </ResponsiveDialogDescription>
              </div>
              {selectedClass?.id && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push(`/admin/schedule/${selectedClass.id}`)}
                  className="shrink-0 mr-8 border-sage/40 text-sage bg-white hover:!bg-sage hover:!text-white hover:!border-sage font-body"
                >
                  <ExternalLink className="h-4 w-4 mr-1.5" />
                  Open full page
                </Button>
              )}
            </div>
          </ResponsiveDialogHeader>
          {selectedClass && (
            <div className="space-y-4 py-4">
              {/* Check-in QR codes */}
              <div className="rounded-xl border border-sage/15 bg-cream/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="font-body font-medium text-charcoal">Check-in QR codes</div>
                  <ClassCountdownPill
                    startIso={selectedClass.startIso}
                    endIso={selectedClass.endIso}
                    fallbackTime={selectedClass.time}
                    size="sm"
                  />
                </div>
                {selectedClassQrLoading ? (
                  <div className="grid grid-cols-2 gap-4">
                    <Skeleton className="h-44 w-full rounded-lg" />
                    <Skeleton className="h-44 w-full rounded-lg" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(["instructor", "member"] as const).map((kind) => (
                      <div key={kind} className="rounded-lg border border-sage/15 bg-white p-4">
                        <ClassCheckinQr kind={kind} qr={selectedClassQr} size={160} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Instructor check-in */}
              <div className="rounded-xl border border-sage/15 bg-cream/20 p-4 flex items-center gap-3">
                {selectedClass.instructorAvatarUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={selectedClass.instructorAvatarUrl}
                    alt={selectedClass.instructor}
                    className="h-10 w-10 rounded-full object-cover border border-sage/20"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-sage/10 flex items-center justify-center font-display text-sage text-sm">
                    {(selectedClass.instructor ?? "I").slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-body text-xs uppercase tracking-wider text-charcoal/45">Instructor</p>
                  <p className="font-body font-medium text-charcoal truncate">{selectedClass.instructor}</p>
                  {selectedClass.instructorCheckedIn ? (
                    <p className="font-body text-xs text-sage">
                      Checked in
                      {selectedClass.instructorCheckInTime
                        ? ` at ${new Date(selectedClass.instructorCheckInTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}`
                        : ""}
                    </p>
                  ) : (
                    <p className="font-body text-xs text-charcoal/45">Not checked in</p>
                  )}
                </div>
                {selectedClass.instructorCheckedIn ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={instructorCheckingIn}
                    onClick={() => handleInstructorCheckIn(false)}
                    className="border-charcoal/20 text-charcoal/70 hover:bg-charcoal/5 font-body"
                  >
                    Undo
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    disabled={instructorCheckingIn}
                    onClick={() => handleInstructorCheckIn(true)}
                    variant="sage"
                  >
                    Check In
                  </Button>
                )}
              </div>

              {/* Attendee List */}
              <div>
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                  <div className="font-body font-medium text-charcoal">Enrolled Members</div>
                  <div className="flex items-center gap-3 font-body text-xs">
                    <span className="text-sage">
                      <span className="font-display text-base mr-1">{selectedClass.checkedIn}</span>checked in
                    </span>
                    <span className="text-charcoal/60">
                      <span className="font-display text-base mr-1">{selectedClass.enrolled}</span>enrolled
                    </span>
                    <span className="text-charcoal/45">
                      <span className="font-display text-base mr-1">{selectedClass.capacity}</span>capacity
                    </span>
                  </div>
                </div>
                {(selectedClass.attendees ?? []).length === 0 ? (
                  <div className="text-center py-8 rounded-lg border border-dashed border-sage/20 bg-cream/20">
                    <p className="font-body text-sm text-charcoal/50">
                      Roster details aren&apos;t available for this class yet.
                    </p>
                  </div>
                ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {(selectedClass.attendees ?? []).map((attendee: any) => {
                    const outcome = attendee.checkInOutcome as string | null | undefined;
                    return (
                    <div key={attendee.id} className="flex items-center justify-between p-3 rounded-lg border border-sage/15 bg-white">
                      <div className="flex items-center gap-3 min-w-0">
                        <ListAvatar
                          name={attendee.name || "Member"}
                          src={attendee.avatarUrl}
                          size="md"
                          ringClassName="ring-sage/20"
                        />
                        <div className="min-w-0">
                          <div className="font-body font-medium text-charcoal truncate flex items-center gap-2">
                            {attendee.name}
                            {attendee.confirmationStatus === "pending" && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-body bg-terracotta/10 text-terracotta whitespace-nowrap">
                                Pending confirmation
                              </span>
                            )}
                          </div>
                          {attendee.email ? (
                            <div className="font-body text-xs text-charcoal/50 truncate">
                              {attendee.email}
                            </div>
                          ) : null}
                          {attendee.checkedIn && attendee.checkInTime ? (
                            <div className="font-body text-xs text-charcoal/60">
                              Checked in at {attendee.checkInTime}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {rosterCheckingIn[attendee.id] && (
                          <Spinner className="size-3 text-sage" />
                        )}
                        <Select
                          value={
                            attendee.checkedIn
                              ? outcome === "late"
                                ? "late"
                                : "on_time"
                              : outcome === "no_show"
                                ? "no_show"
                                : "not_checked_in"
                          }
                          onValueChange={(v) =>
                            applyRosterOutcome(attendee, v as "on_time" | "late" | "no_show" | "not_checked_in")
                          }
                          disabled={rosterCheckingIn[attendee.id]}
                        >
                          <SelectTrigger className="h-8 w-[150px] border-sage/20 font-body text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="on_time">On time</SelectItem>
                            <SelectItem value="late">Late</SelectItem>
                            <SelectItem value="no_show">No-show</SelectItem>
                            <SelectItem value="not_checked_in">Not checked in</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    );
                  })}
                </div>
                )}
              </div>

              {/* Add Member */}
              <div className="border-t border-sage/15 pt-4">
                <div className="font-body font-medium text-charcoal mb-2 flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-sage" />
                  Add Member
                </div>
                <div className="relative">
                  <Input
                    placeholder="Search by name or email…"
                    value={dashMemberQuery}
                    onChange={e => searchDashMembers(e.target.value)}
                    className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40"
                  />
                  {dashMemberSearching && (
                    <Spinner className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-sage" />
                  )}
                </div>
                {dashMemberResults.length > 0 && (
                  <div className="mt-1 rounded-lg border border-sage/20 bg-white shadow-sm overflow-hidden max-h-40 overflow-y-auto">
                    {dashMemberResults.map(m => {
                      const alreadyIn = (selectedClass?.attendees ?? []).some((a: any) => a.id === m.id);
                      return (
                        <div key={m.id} className="flex items-center justify-between px-3 py-2 hover:bg-cream/30 transition-colors">
                          <div className="min-w-0">
                            <div className="font-body text-sm text-charcoal truncate">{m.full_name || "—"}</div>
                            <div className="font-body text-xs text-charcoal/50 truncate">{m.email}</div>
                          </div>
                          {alreadyIn ? (
                            <span className="text-xs text-charcoal/40 font-body ml-2 shrink-0">Booked</span>
                          ) : (
                            <Button
                              size="sm"
                              disabled={dashAddingMemberId === m.id}
                              onClick={() => handleDashAddMember(m.id)}
                              variant="sage"
                              className="ml-2 shrink-0 h-7 px-3 text-xs rounded-full"
                            >
                              {dashAddingMemberId === m.id ? (
                                <Spinner className="size-3" />
                              ) : "Add"}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
          <ResponsiveDialogFooter>
            <Button variant="outline" onClick={() => setShowClassDetailsDialog(false)} className="border-sage/20 font-body">
              Close
            </Button>
            <Button variant="sage">
              <Download className="h-4 w-4 mr-2" />
              Export Attendance
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {/* Payout Dialog */}
      <ResponsiveDialog open={showPayoutDialog} onOpenChange={setShowPayoutDialog}>
        <ResponsiveDialogContent className="max-w-lg bg-white-warm border-sage/20">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="font-display text-2xl text-charcoal">Process Payment</ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="font-body text-charcoal/60">
              Confirm instructor payout details
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          {selectedInstructorData && (
            <div className="space-y-4 py-4">
              <div className="p-4 rounded-lg bg-sage/5 border border-sage/20">
                <div className="font-body font-medium text-charcoal mb-2">
                  {selectedInstructorData.name}
                </div>
                <div className="font-body text-sm text-charcoal/60 mb-4">
                  {selectedInstructorData.specialties}
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="font-body text-xs text-charcoal/50 mb-1">Check-ins</div>
                    <div className="font-display text-2xl text-charcoal">
                      {selectedInstructorData.checkIns}
                    </div>
                  </div>
                  <div>
                    <div className="font-body text-xs text-charcoal/50 mb-1">Rate per Check-in</div>
                    <div className="font-display text-2xl text-charcoal">
                      ₹{selectedInstructorData.rate}
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-sage/20">
                  <div className="flex items-center justify-between">
                    <div className="font-body font-medium text-charcoal">
                      Total Payout:
                    </div>
                    <div className="font-display text-4xl text-sage">
                      ₹{selectedInstructorData.total.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment-method" className="font-body text-charcoal">Payment Method</Label>
                <Select defaultValue="transfer">
                  <SelectTrigger className="border-sage/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transfer">Bank Transfer</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment-notes" className="font-body text-charcoal">Notes (Optional)</Label>
                <Textarea 
                  id="payment-notes" 
                  placeholder="Add any payment notes..."
                  className="border-sage/20 focus:ring-sage"
                />
              </div>
            </div>
          )}
          <ResponsiveDialogFooter>
            <Button variant="outline" onClick={() => setShowPayoutDialog(false)} className="border-sage/20 font-body">
              Cancel
            </Button>
            <Button variant="sage">
              <DollarSign className="h-4 w-4 mr-2" />
              Confirm Payment
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {/* Add Instructor Dialog */}
      <ResponsiveDialog open={showAddInstructorDialog} onOpenChange={(open) => { setShowAddInstructorDialog(open); if (!open) instructorForm.reset(); }}>
        <ResponsiveDialogContent className="max-w-2xl bg-white-warm border-sage/20">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="font-display text-2xl text-charcoal">Add New Instructor</ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="font-body text-charcoal/60">
              Create instructor profile and set payment percentage
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <Form {...instructorForm}>
            <form id="add-instructor-form" onSubmit={instructorForm.handleSubmit(handleCreateInstructor)}>
              <div className="grid grid-cols-2 gap-4 py-4">
                <FormField control={instructorForm.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-body text-charcoal">Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Instructor name" className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={instructorForm.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-body text-charcoal">Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="instructor@email.com" className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={instructorForm.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-body text-charcoal">Phone Number</FormLabel>
                    <FormControl>
                      <Input placeholder="+91 98765 43210" className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={instructorForm.control} name="studio_payout_cut_percent" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-body text-charcoal">Payment Share (%)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="60" className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={instructorForm.control} name="specialties" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel className="font-body text-charcoal">Specialties (comma-separated)</FormLabel>
                    <FormControl>
                      <Input placeholder="Muay Thai, Warrior Strength" className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={instructorForm.control} name="philosophy" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel className="font-body text-charcoal">Philosophy/Bio</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Instructor's teaching philosophy and approach..." className="border-sage/20 focus:ring-sage" rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </form>
          </Form>
          <ResponsiveDialogFooter>
            <Button variant="outline" onClick={() => setShowAddInstructorDialog(false)} className="border-sage/20 font-body">
              Cancel
            </Button>
            <Button type="submit" form="add-instructor-form" disabled={savingInstructor} variant="sage">
              <Save className="h-4 w-4 mr-2" />
              {savingInstructor ? "Saving…" : "Create Instructor"}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {/* Edit Instructor Dialog */}
      <ResponsiveDialog open={showEditInstructorDialog} onOpenChange={setShowEditInstructorDialog}>
        <ResponsiveDialogContent className="max-w-2xl bg-white-warm border-sage/20">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="font-display text-2xl text-charcoal">Edit Instructor</ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="font-body text-charcoal/60">
              Update instructor profile and payment settings
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          {selectedInstructorData && (
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-instructor-name" className="font-body text-charcoal">Full Name</Label>
                <Input id="edit-instructor-name" defaultValue={selectedInstructorData.name} className="border-sage/20 focus:ring-sage" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-instructor-email" className="font-body text-charcoal">Email</Label>
                <Input id="edit-instructor-email" type="email" defaultValue={selectedInstructorData.email} className="border-sage/20 focus:ring-sage" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-instructor-phone" className="font-body text-charcoal">Phone Number</Label>
                <Input id="edit-instructor-phone" defaultValue={selectedInstructorData.phone} className="border-sage/20 focus:ring-sage" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-payment-percentage" className="font-body text-charcoal">Payment Share (%)</Label>
                <Input id="edit-payment-percentage" type="number" defaultValue={selectedInstructorData.paymentPercentage} className="border-sage/20 focus:ring-sage" />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="edit-specialties" className="font-body text-charcoal">Specialties (comma-separated)</Label>
                <Input id="edit-specialties" defaultValue={selectedInstructorData.specialties.join(", ")} className="border-sage/20 focus:ring-sage" />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="edit-philosophy" className="font-body text-charcoal">Philosophy/Bio</Label>
                <Textarea 
                  id="edit-philosophy" 
                  defaultValue={selectedInstructorData.philosophy}
                  className="border-sage/20 focus:ring-sage"
                  rows={3}
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="edit-photo-upload" className="font-body text-charcoal">Update Profile Photo</Label>
                <div className="flex items-center gap-3">
                  <Input id="edit-photo-upload" type="file" accept="image/*" className="border-sage/20 focus:ring-sage" />
                  <Button variant="sage-outline">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload
                  </Button>
                </div>
              </div>
              <div className="col-span-2">
                <div className="flex items-center space-x-2">
                  <input 
                    type="checkbox" 
                    id="update-landing" 
                    defaultChecked
                    className="rounded border-sage/20 text-sage focus:ring-sage" 
                  />
                  <Label htmlFor="update-landing" className="font-body text-charcoal">
                    Sync changes to landing page instructor section
                  </Label>
                </div>
              </div>
            </div>
          )}
          <ResponsiveDialogFooter>
            <Button variant="outline" onClick={() => setShowEditInstructorDialog(false)} className="border-sage/20 font-body">
              Cancel
            </Button>
            <Button variant="sage">
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {/* Member Profile Modal */}
      <Drawer
        direction="right"
        open={showMemberProfile}
        onOpenChange={(o) => { if (!o) setShowMemberProfile(false); }}
      >
        <DrawerContent direction="right" className="max-w-3xl overflow-y-auto">
          {selectedMemberProfile && (
            <>
            <div className="sticky top-0 bg-white-warm border-b border-sage/10 p-6 z-10">
              <div className="flex items-center justify-between">
                <div>
                  <DrawerTitle className="font-display text-3xl text-charcoal mb-1">
                    {selectedMemberProfile.name}
                  </DrawerTitle>
                  <DrawerDescription className="font-body text-sm text-charcoal/60">
                    {selectedMemberProfile.email} • {selectedMemberProfile.phone}
                  </DrawerDescription>
                </div>
                <CloseButton onClick={() => setShowMemberProfile(false)} className="rounded-full" />
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="border border-border bg-white-warm shadow-none ring-0">
                  <CardContent className="p-4 text-center">
                    <p className="font-display text-3xl text-sage mb-1">
                      {selectedMemberProfile.totalClasses}
                    </p>
                    <p className="font-body text-xs text-charcoal/60">Total Classes</p>
                  </CardContent>
                </Card>
                <Card className="border border-border bg-white-warm shadow-none ring-0">
                  <CardContent className="p-4 text-center">
                    <p className="font-display text-3xl text-charcoal mb-1">
                      {selectedMemberProfile.weeklyStreak}
                    </p>
                    <p className="font-body text-xs text-charcoal/60">Week Streak</p>
                  </CardContent>
                </Card>
                <Card className="border border-border bg-white-warm shadow-none ring-0">
                  <CardContent className="p-4 text-center">
                    <p className="font-display text-3xl text-charcoal mb-1">
                      {selectedMemberProfile.credits}
                    </p>
                    <p className="font-body text-xs text-charcoal/60">
                      {selectedMemberProfile.isUnlimited ? "Unlimited Pass" : "Classes Left"}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Membership Info */}
              <Card className="border border-border bg-white-warm shadow-none ring-0">
                <CardHeader className="border-b border-sage/10">
                  <CardTitle className="font-display text-xl text-charcoal">Membership Details</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-3">
                  <div className="flex justify-between">
                    <span className="font-body text-sm text-charcoal/60">Package</span>
                    <Badge className="bg-sage text-white">{selectedMemberProfile.package}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-body text-sm text-charcoal/60">Expires</span>
                    <span className="font-body text-sm font-medium text-terracotta">
                      {selectedMemberProfile.passExpiryISO
                        ? new Date(selectedMemberProfile.passExpiryISO).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-body text-sm text-charcoal/60">Member Since</span>
                    <span className="font-body text-sm text-charcoal">
                      {new Date(selectedMemberProfile.joinDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-body text-sm text-charcoal/60">Favorite Class</span>
                    <span className="font-body text-sm text-charcoal">{selectedMemberProfile.favoriteClass}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Achievements */}
              <Card className="border border-border bg-white-warm shadow-none ring-0">
                <CardHeader className="border-b border-sage/10">
                  <CardTitle className="font-display text-xl text-charcoal">Achievements</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="flex flex-wrap gap-2">
                    {selectedMemberProfile.badges.length === 0 ? (
                      <p className="font-body text-sm text-charcoal/50">No badges yet</p>
                    ) : (
                      selectedMemberProfile.badges.map((badge: string, idx: number) => (
                        <Badge key={idx} className="bg-sage/10 text-sage border border-sage/20">
                          <Trophy size={12} className="mr-1" />
                          {badge}
                        </Badge>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card className="border border-border bg-white-warm shadow-none ring-0">
                <CardHeader className="border-b border-sage/10">
                  <CardTitle className="font-display text-xl text-charcoal">Recent Activity</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-cream/30">
                    <Calendar className="text-sage" size={20} />
                    <div className="flex-1">
                      <p className="font-body text-sm text-charcoal">Last Class Attended</p>
                      <p className="font-body text-xs text-charcoal/60">
                        {selectedMemberProfile.lastClass}
                        {selectedMemberProfile.lastAttendance
                          ? ` • ${new Date(selectedMemberProfile.lastAttendance).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                          : ""}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Upcoming Bookings */}
              <Card className="border border-border bg-white-warm shadow-none ring-0">
                <CardHeader className="border-b border-sage/10">
                  <CardTitle className="font-display text-xl text-charcoal">Upcoming Bookings</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-3">
                  {selectedMemberProfile.upcomingBookings.length === 0 ? (
                    <p className="font-body text-sm text-charcoal/50">No upcoming bookings</p>
                  ) : (
                    selectedMemberProfile.upcomingBookings.map((booking: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-cream/30">
                        <div>
                          <p className="font-body text-sm font-medium text-charcoal">{booking.class}</p>
                          <p className="font-body text-xs text-charcoal/60">
                            {new Date(booking.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} at{" "}
                            {booking.time}
                          </p>
                        </div>
                        <Badge variant="outline" className="border-sage/20 text-sage">
                          Confirmed
                        </Badge>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Attendance History */}
              <Card className="border border-border bg-white-warm shadow-none ring-0">
                <CardHeader className="border-b border-sage/10">
                  <CardTitle className="font-display text-xl text-charcoal">Attendance History</CardTitle>
                  <CardDescription className="font-body text-charcoal/60">
                    {(selectedMemberProfile.attendanceHistory?.length ?? 0)} past class{(selectedMemberProfile.attendanceHistory?.length ?? 0) !== 1 ? "es" : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-3 max-h-80 overflow-y-auto">
                  {(selectedMemberProfile.attendanceHistory?.length ?? 0) === 0 ? (
                    <p className="font-body text-sm text-charcoal/50">No past classes yet</p>
                  ) : (
                    selectedMemberProfile.attendanceHistory.map((a: { class: string; date: string; outcome: string }, idx: number) => {
                      const meta =
                        a.outcome === "on_time"
                          ? { label: "On time", cls: "border-sage/20 bg-sage/10 text-sage" }
                          : a.outcome === "late"
                            ? { label: "Late", cls: "border-terracotta/20 bg-terracotta/10 text-terracotta" }
                            : { label: "No-show", cls: "border-[#a05e38]/25 bg-[#a05e38]/10 text-[#a05e38]" };
                      return (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-cream/30">
                          <div className="min-w-0">
                            <p className="font-body text-sm font-medium text-charcoal truncate">{a.class}</p>
                            <p className="font-body text-xs text-charcoal/60">
                              {new Date(a.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                            </p>
                          </div>
                          <Badge variant="outline" className={`font-body whitespace-nowrap ${meta.cls}`}>
                            {meta.label}
                          </Badge>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              {/* Order History */}
              <Card className="border border-border bg-white-warm shadow-none ring-0">
                <CardHeader className="border-b border-sage/10">
                  <CardTitle className="font-display text-xl text-charcoal">Café Orders</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-3">
                  {selectedMemberProfile.orderHistory.length === 0 ? (
                    <p className="font-body text-sm text-charcoal/50">No café orders yet</p>
                  ) : (
                    selectedMemberProfile.orderHistory.map((order: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-cream/30">
                        <div>
                          <p className="font-body text-sm font-medium text-charcoal">{order.item}</p>
                          <p className="font-body text-xs text-charcoal/60">
                            {new Date(order.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </p>
                        </div>
                        <p className="font-display text-lg text-sage">₹{order.amount}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-4 pt-4">
                <Button variant="sage" className="h-12">
                  <Zap size={16} className="mr-2" />
                  Send Nudge
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const pid = String(selectedMemberProfile.profileId ?? selectedMemberProfile.id ?? "");
                    if (pid) void router.push(`/admin/control?editUser=${encodeURIComponent(pid)}`);
                  }}
                  className="border-sage/30 text-charcoal hover:bg-sage/5 font-body h-12"
                >
                  <CreditCard size={16} className="mr-2" />
                  Manage Packages
                </Button>
                <Button variant="sage-outline" className="h-12">
                  <Mail size={16} className="mr-2" />
                  Send Email
                </Button>
                <Button variant="sage-outline" className="h-12">
                  <Edit size={16} className="mr-2" />
                  Edit Profile
                </Button>
              </div>
            </div>
            </>
          )}
        </DrawerContent>
      </Drawer>
    </>
  );
}
