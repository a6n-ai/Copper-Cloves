import { Fragment, useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/router";
import { ListAvatar } from "@/components/admin/ListAvatar";
import { DayScheduleList } from "@/components/admin/DayScheduleList";
import { MetricCard } from "@/components/admin/MetricCard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Label as RechartsLabel,
  Line,
  Pie,
  PieChart as RechartsPieChart,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { 
  Users, 
  Calendar, 
  TrendingUp, 
  Coffee, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  CreditCard,
  Flame,
  DollarSign,
  TrendingDown,
  Download,
  Filter,
  Award,
  Target,
  Activity,
  BarChart3,
  PieChart,
  FileText,
  UserCheck,
  UserX,
  Zap,
  Trophy,
  Star,
  ChevronRight,
  ChevronLeft,
  Plus,
  Edit,
  Trash2,
  Search,
  X,
  Mail,
  Phone,
  MapPin,
  Upload,
  Save,
  Ban,
  Eye,
  Tag,
  ChefHat,
  Building2,
} from "lucide-react";
import { SEO } from "@/components/SEO";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSession } from "next-auth/react";
import { financeDemoTransactionsForUi } from "@/lib/adminFinanceDemoTransactions";
import {
  downloadFinanceReportExcel,
  transactionInExportPeriod,
  type FinanceReportPeriod,
} from "@/lib/financeReportExport";
import { COUPON_CONTEXTS } from "@/lib/couponHelpers";
import { Pagination, usePagination } from "@/components/Pagination";

type FinanceBreakdownDetail = {
  packageListInr?: number;
  couponDiscountInr?: number;
  classOrStudioPassInr?: number;
  cafeNetInr?: number;
  taxInr?: number;
  totalInr?: number;
};

type FinanceDetailLine = {
  role: string;
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
};

type DashboardFinanceDetail = {
  finance1?: boolean;
  source: "package" | "booking";
  memberName?: string;
  memberEmail?: string;
  memberPhone?: string;
  purchasedAtISO?: string;
  bookedAtISO?: string;
  transactionKinds?: string[];
  razorpayOrderId?: string | null;
  razorpayPaymentIds?: string[];
  breakdown?: FinanceBreakdownDetail;
  attendeeLines?: FinanceDetailLine[];
  cafeLines?: { name: string; quantity: number }[];
  paymentMethodSummary?: string;
  classSummary?: string;
  groupHeadcount?: number;
};

type DashboardTxn = {
  id: string;
  rawId?: string;
  sortKey?: string;
  memberPlusLabel?: string;
  foodOrderedLabel?: string;
  finance1Tag?: boolean;
  isFinanceDemo?: boolean;
  financeDetail?: DashboardFinanceDetail;
  date: string;
  member?: string;
  memberFull?: string;
  instructor?: string;
  type: string;
  amount: number;
  category: string;
  method: string;
};

function parseYYYYMMDDLocal(dateStr: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const da = Number(m[3]);
  const d = new Date(y, mo, da);
  if (d.getFullYear() !== y || d.getMonth() !== mo || d.getDate() !== da) return null;
  return d;
}

/** Display date from API (`dt`) is INR-local calendar day — compare in local TZ. */
function txnPassesDateRange(displayDateYYYYMMDD: string, range: string): boolean {
  if (range === "all" || range === "custom") return true;
  const txnDay = parseYYYYMMDDLocal(displayDateYYYYMMDD);
  if (!txnDay) return true;
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endToday = new Date(startToday);
  endToday.setDate(endToday.getDate() + 1);
  if (range === "today") return txnDay >= startToday && txnDay < endToday;

  if (range === "week") {
    const cutoff = new Date(startToday);
    cutoff.setDate(cutoff.getDate() - 7);
    return txnDay >= cutoff && txnDay < endToday;
  }
  if (range === "month") {
    return txnDay.getFullYear() === now.getFullYear() && txnDay.getMonth() === now.getMonth();
  }
  return true;
}

function formatTxnAmountRupee(amount: number, type: string): string {
  const rounded = Math.round(amount);
  const abs = Math.abs(rounded);
  const prefix = type === "revenue" ? "+" : type === "expense" ? "-" : "";
  let body: string;
  if (abs >= 100000) body = `₹${(abs / 100000).toFixed(2)} L`;
  else if (abs >= 10000) body = `₹${(abs / 1000).toFixed(1)}k`;
  else body = `₹${abs.toLocaleString("en-IN")}`;
  return `${prefix}${body}`;
}

function formatInrDetail(n?: number): string {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return `₹${Math.round(Number(n)).toLocaleString("en-IN")}`;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [dateRange, setDateRange] = useState("month");
  const [selectedMember, setSelectedMember] = useState("all");
  const [selectedInstructor, setSelectedInstructor] = useState("all");
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [showMemberProfile, setShowMemberProfile] = useState(false);
  const [selectedMemberProfile, setSelectedMemberProfile] = useState<any>(null);

  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
  const [showEditUserDialog, setShowEditUserDialog] = useState(false);
  const [showAddClassDialog, setShowAddClassDialog] = useState(false);
  const [showClassDetailsDialog, setShowClassDetailsDialog] = useState(false);
  const [showPayoutDialog, setShowPayoutDialog] = useState(false);
  const [showAddInstructorDialog, setShowAddInstructorDialog] = useState(false);
  const [showEditInstructorDialog, setShowEditInstructorDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [selectedInstructorData, setSelectedInstructorData] = useState<any>(null);
  const [newInstructorForm, setNewInstructorForm] = useState({
    name: "", email: "", phone: "", studio_payout_cut_percent: "", specialties: "", philosophy: "",
  });
  const [savingInstructor, setSavingInstructor] = useState(false);

  // Transaction filter states
  const [transactionFilter, setTransactionFilter] = useState("all"); // all, credit, debit
  const [transactionDateRange, setTransactionDateRange] = useState("all"); // all, today, week, month, custom
  const [transactionType, setTransactionType] = useState("all"); // all, revenue, expense
  const [transactionSearch, setTransactionSearch] = useState("");
  const [financeDetailOpen, setFinanceDetailOpen] = useState(false);
  const [selectedFinanceDetail, setSelectedFinanceDetail] = useState<DashboardFinanceDetail | null>(
    null,
  );

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
  const [financeTrend, setFinanceTrend] = useState<Array<{ month: string; monthIso: string; revenue: number; expenses: number; profit: number }>>([]);
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
  /** ISO yyyy-mm-dd date for the schedule card; defaults to today. */
  const [scheduleDate, setScheduleDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [financeStats, setFinanceStats] = useState({
    totalRevenue: 0,
    totalExpenses: 0,
    profit: 0,
    coachPayments: 0,
    studioExpenses: 0,
    memberPayments: 0,
    growthRate: 0,
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
  const [transactions, setTransactions] = useState<DashboardTxn[]>([]);
  const [memberList, setMemberList] = useState<any[]>([]);
  const [expiringMembers, setExpiringMembers] = useState<
    { id: string; name: string; email: string; package: string; expires: string; credits: number }[]
  >([]);
  const [dashboardInstructors, setDashboardInstructors] = useState<any[]>([]);
  const [instructorPayouts, setInstructorPayouts] = useState<any[]>([]);

  /** Dev-only sample rows; production uses live API data only. */
  const financeLedgerTransactions = useMemo(() => {
    const demos = financeDemoTransactionsForUi() as DashboardTxn[];
    const byId = new Map<string, DashboardTxn>();
    for (const row of demos) byId.set(row.id, row);
    for (const row of transactions) byId.set(row.id, row);
    return Array.from(byId.values()).sort((a, b) => {
      const ak = a.sortKey ?? a.date;
      const bk = b.sortKey ?? b.date;
      return ak < bk ? 1 : ak > bk ? -1 : 0;
    });
  }, [transactions]);

  const filteredFinanceTransactions = useMemo(() => {
    const q = transactionSearch.trim().toLowerCase();
    return financeLedgerTransactions.filter((txn) => {
      if (!txnPassesDateRange(txn.date, transactionDateRange)) return false;
      if (transactionFilter === "credit" && txn.type !== "revenue") return false;
      if (transactionFilter === "debit" && txn.type !== "expense") return false;

      const catLow = txn.category.toLowerCase();
      if (transactionType === "packages" && !catLow.includes("(package)")) return false;
      if (transactionType === "coach" && txn.category !== "Coach Payment") return false;
      if (transactionType === "studio" && txn.category !== "Studio Rent") return false;
      if (
        transactionType === "class_bookings" &&
        !String(txn.id).startsWith("booking-") &&
        !String(txn.id).startsWith("demo-finance-booking")
      ) {
        return false;
      }

      if (transactionType === "cafe") {
        const foodLbl = txn.foodOrderedLabel?.toLowerCase() ?? "";
        const hasCafe =
          foodLbl.includes("food ordered") || catLow.includes("café") || catLow.includes("cafe");
        if (!hasCafe) return false;
      }

      if (q) {
        const hay = `${txn.member ?? ""} ${txn.memberFull ?? ""} ${txn.instructor ?? ""} ${txn.category} ${txn.method} ${txn.foodOrderedLabel ?? ""} ${txn.memberPlusLabel ?? ""} ${txn.id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [
    financeLedgerTransactions,
    transactionFilter,
    transactionDateRange,
    transactionType,
    transactionSearch,
  ]);

  const exportFinanceReport = (mode: FinanceReportPeriod) => {
    let rows: DashboardTxn[];
    if (mode === "filtered") {
      rows = filteredFinanceTransactions;
    } else if (mode === "all") {
      rows = financeLedgerTransactions;
    } else {
      rows = financeLedgerTransactions.filter((t) =>
        transactionInExportPeriod(t.date, mode),
      );
    }
    if (rows.length === 0) {
      window.alert("No transactions to export for this selection.");
      return;
    }
    downloadFinanceReportExcel(rows, `copper-cloves-finance-${mode}`);
  };

  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      router.push("/admin/login");
      return;
    }
    const role = (session?.user as { role?: string })?.role;
    if (status === "authenticated" && role !== "admin") {
      router.push("/admin/login");
      return;
    }
    if (status === "authenticated") setLoading(false);
  }, [status, session, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const role = (session?.user as { role?: string })?.role;
    if (role !== "admin") return;
    let cancelled = false;
    (async () => {
      const r = await fetch("/api/admin/overview");
      if (!r.ok || cancelled) return;
      const d = await r.json();
      if (cancelled) return;
      setOverviewStats(d.overviewStats);
      setOverviewMeta(d.meta ?? { classesTodayCount: 0, newMembersThisMonth: 0 });
      setUpcomingClasses(Array.isArray(d.upcomingClasses) ? d.upcomingClasses : []);
      const mr = Number(d.overviewStats?.monthRevenue ?? 0);
      setFinanceStats((prev) => ({
        ...prev,
        totalRevenue: mr,
        memberPayments: mr,
        profit: mr - prev.coachPayments,
      }));
      setOverviewLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [status, session]);

  /**
   * Per-section lazy loader. Tracks which slices have been fetched so a tab
   * never re-fetches its data twice. Each tab effect calls `loadSection(name, fn)`
   * which becomes a no-op after the first successful load.
   */
  const loadedRef = useRef<Set<string>>(new Set());
  const inflightRef = useRef<Map<string, Promise<void>>>(new Map());
  const loadSection = (key: string, run: () => Promise<void>): Promise<void> => {
    if (loadedRef.current.has(key)) return Promise.resolve();
    const existing = inflightRef.current.get(key);
    if (existing) return existing;
    const p = (async () => {
      try {
        await run();
        loadedRef.current.add(key);
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
    const role = (session?.user as { role?: string })?.role;
    if (role !== "admin" || activeTab !== "overview") return;
    let cancelled = false;

    void loadSection("today-classes", async () => {
      const r = await fetch(`/api/admin/dashboard/today-classes?date=${encodeURIComponent(scheduleDate)}`);
      if (!r.ok || cancelled) return;
      const d = await r.json();
      if (!cancelled && Array.isArray(d.todayClasses)) setTodayClassesDetail(d.todayClasses);
    });
    void loadSection("expiring-members", async () => {
      const r = await fetch("/api/admin/dashboard/expiring-members");
      if (!r.ok || cancelled) return;
      const d = await r.json();
      if (!cancelled && Array.isArray(d.expiringMembers)) setExpiringMembers(d.expiringMembers);
    });
    void loadSection("member-stats", async () => {
      const r = await fetch("/api/admin/dashboard/member-stats");
      if (!r.ok || cancelled) return;
      const d = await r.json();
      if (!cancelled && d.memberStats) setMemberStats(d.memberStats);
    });
    void loadSection("instructor-payouts", async () => {
      const r = await fetch("/api/admin/instructor-payouts?window=month");
      if (!r.ok || cancelled) return;
      const pay = await r.json();
      if (cancelled) return;
      const coachPayments = Number(pay.summary?.totalPayouts ?? 0);
      setInstructorPayouts(Array.isArray(pay.instructors) ? pay.instructors : []);
      setFinanceStats((prev) => {
        const totalExpenses = coachPayments + prev.studioExpenses;
        return { ...prev, coachPayments, totalExpenses, profit: prev.totalRevenue - totalExpenses };
      });
    });

    return () => { cancelled = true; };
  }, [status, session, activeTab, scheduleDate]);

  /** Members tab. */
  useEffect(() => {
    if (status !== "authenticated") return;
    const role = (session?.user as { role?: string })?.role;
    if (role !== "admin" || activeTab !== "members") return;
    let cancelled = false;

    void loadSection("member-stats", async () => {
      const r = await fetch("/api/admin/dashboard/member-stats");
      if (!r.ok || cancelled) return;
      const d = await r.json();
      if (!cancelled && d.memberStats) setMemberStats(d.memberStats);
    });
    void loadSection("member-list", async () => {
      const r = await fetch("/api/admin/dashboard/member-list");
      if (!r.ok || cancelled) return;
      const d = await r.json();
      if (!cancelled && Array.isArray(d.memberList)) setMemberList(d.memberList);
    });
    void loadSection("expiring-members", async () => {
      const r = await fetch("/api/admin/dashboard/expiring-members");
      if (!r.ok || cancelled) return;
      const d = await r.json();
      if (!cancelled && Array.isArray(d.expiringMembers)) setExpiringMembers(d.expiringMembers);
    });

    return () => { cancelled = true; };
  }, [status, session, activeTab]);

  /** Instructors tab. */
  useEffect(() => {
    if (status !== "authenticated") return;
    const role = (session?.user as { role?: string })?.role;
    if (role !== "admin" || activeTab !== "instructors") return;
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
  }, [status, session, activeTab]);

  /** Classes tab. */
  useEffect(() => {
    if (status !== "authenticated") return;
    const role = (session?.user as { role?: string })?.role;
    if (role !== "admin" || activeTab !== "classes") return;
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
  }, [status, session, activeTab]);

  /** Finance tab. */
  useEffect(() => {
    if (status !== "authenticated") return;
    const role = (session?.user as { role?: string })?.role;
    if (role !== "admin" || activeTab !== "finance") return;
    let cancelled = false;

    void loadSection("transactions", async () => {
      const r = await fetch("/api/admin/dashboard/transactions");
      if (!r.ok || cancelled) return;
      const d = await r.json();
      if (!cancelled && Array.isArray(d.transactions)) setTransactions(d.transactions);
    });

    void loadSection("finance-trend", async () => {
      const r = await fetch("/api/admin/dashboard/finance-trend");
      if (!r.ok || cancelled) return;
      const d = await r.json();
      if (!cancelled && Array.isArray(d.trend)) setFinanceTrend(d.trend);
    });

    return () => { cancelled = true; };
  }, [status, session, activeTab]);

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
  }, [status, session, activeTab]);

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
  }, [status, session, activeTab]);

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
  }, [status, session, activeTab]);

  const handleToggleMember = (memberId: string) => {
    const newSelected = new Set(selectedMembers);
    if (newSelected.has(memberId)) {
      newSelected.delete(memberId);
    } else {
      newSelected.add(memberId);
    }
    setSelectedMembers(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedMembers.size === expiringMembers.length) {
      setSelectedMembers(new Set());
    } else {
      setSelectedMembers(new Set(expiringMembers.map(m => m.id)));
    }
  };

  const handleBulkNudge = () => {
    const count = selectedMembers.size;
    alert(`"The Ritual Renewal" template queued for ${count} members via WhatsApp/Email!`);
    setSelectedMembers(new Set());
  };

  async function saveCouponFromDraft() {
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
        alert(typeof err?.error === "string" ? err.error : "Could not save coupon");
        return;
      }
      setEditingCouponId(null);
      setCouponDraft({
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
      const listRes = await fetch("/api/admin/coupons");
      if (listRes.ok) {
        const d = await listRes.json();
        setCoupons(Array.isArray(d) ? d : []);
      }
    } finally {
      setCouponSaving(false);
    }
  }

  async function deleteCouponById(id: string) {
    if (!confirm("Delete this coupon?")) return;
    const res = await fetch(`/api/admin/coupons?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Could not delete coupon");
      return;
    }
    setCoupons((prev) => prev.filter((c) => c.id !== id));
    if (editingCouponId === id) {
      setEditingCouponId(null);
      setCouponDraft({
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
    }
  }

  function startEditCoupon(c: (typeof coupons)[0]) {
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
  }

  async function updateMealInquiryStatus(id: string, status: string) {
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
  }

  async function handleCreateInstructor() {
    setSavingInstructor(true);
    try {
      const body: Record<string, unknown> = {};
      if (newInstructorForm.name.trim()) body.name = newInstructorForm.name.trim();
      else body.name = "New Instructor";
      if (newInstructorForm.email.trim()) body.email = newInstructorForm.email.trim();
      if (newInstructorForm.phone.trim()) body.phone = newInstructorForm.phone.trim();
      if (newInstructorForm.studio_payout_cut_percent.trim())
        body.studio_payout_cut_percent = parseFloat(newInstructorForm.studio_payout_cut_percent);
      if (newInstructorForm.specialties.trim())
        body.specialties = newInstructorForm.specialties.split(",").map((s) => s.trim()).filter(Boolean);
      if (newInstructorForm.philosophy.trim()) body.philosophy = newInstructorForm.philosophy.trim();
      const res = await fetch("/api/admin/instructors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to create instructor");
      setShowAddInstructorDialog(false);
      setNewInstructorForm({ name: "", email: "", phone: "", studio_payout_cut_percent: "", specialties: "", philosophy: "" });
      const updated = await fetch("/api/admin/instructors");
      if (updated.ok) setDashboardInstructors(await updated.json());
    } catch {
      alert("Failed to save instructor.");
    } finally {
      setSavingInstructor(false);
    }
  }

  const handleViewProfile = (member: Record<string, unknown>) => {
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

        const profileData = {
          ...member,
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
        });
        setShowMemberProfile(true);
      }
    })();
  };

  const filteredInstructorPerformance =
    selectedInstructor === "all"
      ? instructorPerformance
      : instructorPerformance.filter((i) => i.name === selectedInstructor);

  const instructorClassTotal =
    filteredInstructorPerformance.reduce((s, i) => s + i.classes, 0) || 1;
  const maxInstructorCheckIns = Math.max(
    ...filteredInstructorPerformance.map((i) => i.totalCheckIns),
    1
  );
  const maxInstructorEarnings = maxInstructorCheckIns * 150;
  const instructorPieColors = ["#8F9779", "#D4A574", "#C4B8A8", "#B8A99A", "#6B7280", "#9CA3AF"];

  const filteredMemberList = memberList.filter((m) => {
    if (selectedMember === "all") return true;
    const pkg = String(m.package ?? "").toLowerCase();
    if (selectedMember === "premium") return pkg.includes("premium");
    if (selectedMember === "specialty")
      return pkg.includes("aerial") || pkg.includes("special") || pkg.includes("unlimited");
    if (selectedMember === "active") return (m.credits ?? 0) > 0;
    if (selectedMember === "inactive") return (m.credits ?? 0) <= 0;
    return true;
  });

  /** Aggregates derived from the visible (filtered) member list. */
  const filteredMemberStats = useMemo(() => {
    const sum = (k: string) => filteredMemberList.reduce((s, m) => s + (Number((m as Record<string, unknown>)[k]) || 0), 0);
    const onTime = sum("onTime");
    const late = sum("late");
    const noShows = sum("noShow");
    const sample = onTime + late;
    const isPremium = (pkg: string) => pkg.includes("premium");
    const isSpecialty = (pkg: string) =>
      pkg.includes("aerial") || pkg.includes("special") || pkg.includes("unlimited");
    let premiumActive = 0,
      specialtyActive = 0,
      inactive = 0;
    for (const m of filteredMemberList) {
      const pkg = String((m as { package?: string }).package ?? "").toLowerCase();
      const credits = Number((m as { credits?: number }).credits ?? 0);
      if (credits <= 0) inactive += 1;
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
    };
  }, [filteredMemberList]);

  /** Stats actually rendered in the Members tab — filter drives scope. 'all' = global; specific filter = aggregates from filtered list. */
  const displayedMemberStats = selectedMember !== "all"
    ? { ...memberStats, ...filteredMemberStats }
    : memberStats;

  const activeMemberTierTotal = displayedMemberStats.premiumActive + displayedMemberStats.specialtyActive;

  // Pagination hooks for dashboard lists — resetKey resets page to 1 on filter change
  const membersPg = usePagination(filteredMemberList, 10, selectedMember);
  const instructorsPerfPg = usePagination(filteredInstructorPerformance, 10, selectedInstructor);
  const expiringPg = usePagination(expiringMembers);
  const financeTxnPg = usePagination(
    filteredFinanceTransactions,
    10,
    `${transactionFilter}|${transactionDateRange}|${transactionType}|${transactionSearch}`,
  );
  const classesPerfPg = usePagination(classPerformance);
  const couponsPg = usePagination(coupons);
  const mealInquiriesPg = usePagination(mealInquiries);
  const rentalInquiriesPg = usePagination(rentalInquiries);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cream via-cream to-sage/10 flex items-center justify-center">
        <div className="h-12 w-12 border-4 border-sage/20 border-t-sage rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <SEO
        title="Admin Dashboard - The Studio"
        description="Manage classes, members, and operations"
      />
      
      <div className="min-h-screen bg-gradient-to-br from-cream via-cream to-sage/10">
        {/* Decorative Elements */}
        <div className="fixed top-20 right-20 w-72 h-72 bg-sage/10 rounded-full blur-3xl pointer-events-none" />
        <div className="fixed bottom-20 left-20 w-96 h-96 bg-cream/50 rounded-full blur-3xl pointer-events-none" />
        
        
        <main className="min-h-screen">
          <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-8">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h1 className="font-display text-3xl md:text-4xl text-charcoal leading-tight">Dashboard</h1>
                <p className="font-body text-charcoal/60">Welcome back, Admin. Here&apos;s what&apos;s happening today.</p>
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
              <TabsList className="bg-cream/50 border border-sage/15 p-1 flex flex-wrap gap-1 h-auto justify-start w-full sm:w-auto">
                {[
                  { v: "overview", l: "Overview", I: BarChart3 },
                  { v: "finance", l: "Finance", I: DollarSign },
                  { v: "pricing", l: "Pricing", I: Tag },
                  { v: "meal-waitlist", l: "Meal waitlist", I: ChefHat },
                  { v: "rental-inquiries", l: "Rentals", I: Building2 },
                  { v: "members", l: "Members", I: Users },
                  { v: "instructors", l: "Instructors", I: Award },
                  { v: "classes", l: "Classes", I: Target },
                ].map((t) => (
                  <TabsTrigger
                    key={t.v}
                    value={t.v}
                    className="font-body gap-2 px-3 text-charcoal/60 data-[state=active]:bg-sage data-[state=active]:text-white data-[state=active]:shadow-sm"
                  >
                    <t.I className="h-4 w-4" />
                    {t.l}
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* OVERVIEW TAB */}
              <TabsContent value="overview" className="space-y-6">
                {/* Key Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <MetricCard
                    label="Total Members"
                    value={overviewStats.totalMembers}
                    icon={Users}
                    tone="sage"
                    loading={!overviewLoaded}
                    hint={`+${overviewMeta.newMembersThisMonth} this month`}
                  />
                  <MetricCard
                    label="Active Today"
                    value={overviewStats.activeToday}
                    icon={Flame}
                    tone="terracotta"
                    loading={!overviewLoaded}
                    hint={`${overviewMeta.classesTodayCount} classes today`}
                  />
                  <MetricCard
                    label="Expiring This Week"
                    value={overviewStats.expiringWeek}
                    icon={AlertTriangle}
                    tone="amber"
                    loading={!overviewLoaded}
                  />
                  <MetricCard
                    label="Month Revenue"
                    value={Math.round(overviewStats.monthRevenue)}
                    prefix="₹"
                    icon={CreditCard}
                    tone="sage"
                    loading={!overviewLoaded}
                    hint="+23% vs last month"
                  />
                  <MetricCard
                    label="Café Orders"
                    value={overviewStats.cafeOrders}
                    icon={Coffee}
                    tone="sage"
                    loading={!overviewLoaded}
                    footer={
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-sage/20 text-sage hover:bg-sage/5 h-7 text-xs font-body"
                        onClick={() => router.push("/admin/cafe")}
                      >
                        View Queue
                      </Button>
                    }
                  />
                  <MetricCard
                    label="Pending Waivers"
                    value={overviewStats.pendingWaivers}
                    icon={AlertTriangle}
                    tone="amber"
                    loading={!overviewLoaded}
                  />
                </div>

                {/* Upcoming Classes */}
                <Card className="border-sage/20 bg-white/95 backdrop-blur-xl">
                    <CardHeader>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <CardTitle className="font-display text-2xl text-charcoal">
                            {(() => {
                              const today = new Date();
                              const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
                              if (scheduleDate === todayIso) return "Today's schedule";
                              const [y, m, d] = scheduleDate.split("-").map(Number);
                              const dt = new Date(y, m - 1, d);
                              return dt.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
                            })()}
                          </CardTitle>
                          <CardDescription className="font-body text-charcoal/60">
                            {todayClassesDetail.length > 0
                              ? "Tap a class to see who checked in. Check-in opens for members 15 minutes before start."
                              : "No classes scheduled for this day."}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-sage/20 text-sage hover:bg-sage/5 h-9 px-2"
                            onClick={() => {
                              const [y, m, d] = scheduleDate.split("-").map(Number);
                              const dt = new Date(y, m - 1, d - 1);
                              setScheduleDate(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`);
                            }}
                            aria-label="Previous day"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Input
                            type="date"
                            value={scheduleDate}
                            onChange={(e) => setScheduleDate(e.target.value)}
                            className="h-9 w-40 border-sage/20 font-body"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-sage/20 text-sage hover:bg-sage/5 h-9 px-2"
                            onClick={() => {
                              const [y, m, d] = scheduleDate.split("-").map(Number);
                              const dt = new Date(y, m - 1, d + 1);
                              setScheduleDate(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`);
                            }}
                            aria-label="Next day"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-sage/20 text-sage hover:bg-sage/5 h-9 font-body"
                            onClick={() => {
                              const t = new Date();
                              setScheduleDate(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`);
                            }}
                          >
                            Today
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <DayScheduleList
                        items={(todayClassesDetail.length > 0
                          ? todayClassesDetail
                          : upcomingClasses
                        )
                          .slice(0, 8)
                          .map((cls: any) => ({
                            id: cls.id,
                            name: cls.name,
                            time: cls.time,
                            instructor: cls.instructor ?? "—",
                            instructorAvatarUrl: cls.instructorAvatarUrl ?? null,
                            enrolled: cls.enrolled ?? 0,
                            capacity: cls.capacity ?? (cls.enrolled ?? 0),
                            recurring: cls.recurring,
                            _raw: cls,
                          } as any))}
                        onSelect={(row: any) => {
                          setSelectedClass(row._raw);
                          setShowClassDetailsDialog(true);
                        }}
                      />
                    </CardContent>
                  </Card>

                {/* Expiring Members Alert */}
                <Card className="border-amber-500/20 bg-gradient-to-br from-amber-50 to-white backdrop-blur-xl">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="font-display text-2xl text-charcoal flex items-center gap-2">
                          <AlertTriangle className="h-6 w-6 text-amber-500" />
                          Members Expiring Soon
                        </CardTitle>
                        <CardDescription className="font-body text-charcoal/60 mt-1">
                          {expiringMembers.length} memberships expiring in the next 14 days
                        </CardDescription>
                      </div>
                      <Button 
                        onClick={() => router.push("/admin/CRM")}
                        className="bg-amber-500 hover:bg-amber-600 text-white font-body"
                      >
                        Open CRM
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Bulk Actions Bar */}
                    {selectedMembers.size > 0 && (
                      <div className="mb-4 p-4 rounded-xl bg-sage/10 border border-sage/30 flex items-center justify-between">
                        <p className="font-body text-sm text-charcoal">
                          {selectedMembers.size} member{selectedMembers.size > 1 ? 's' : ''} selected
                        </p>
                        <div className="flex gap-2">
                          <Button
                            onClick={handleBulkNudge}
                            size="sm"
                            className="bg-sage hover:bg-sage/90 text-white font-body"
                          >
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

                    {/* Select All Option */}
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
                          className="flex items-center justify-between p-4 rounded-xl border border-amber-500/20 bg-white hover:shadow-md transition-all duration-600"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <input
                              type="checkbox"
                              checked={selectedMembers.has(member.id)}
                              onChange={() => handleToggleMember(member.id)}
                              className="w-4 h-4 accent-sage cursor-pointer"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="flex-1">
                              <div className="font-body font-medium text-charcoal mb-1">
                                {member.name}
                              </div>
                              <div className="font-body text-sm text-charcoal/60">
                                {member.email} • {member.package} Package
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="font-body text-sm font-medium text-amber-600">
                                Expires in {member.expires}
                              </div>
                              <div className="font-body text-xs text-charcoal/50">
                                {member.credits} credits remaining
                              </div>
                            </div>
                            <Button
                              onClick={() => handleViewProfile(member)}
                              variant="outline"
                              size="sm"
                              className="border-sage/30 text-sage hover:bg-sage/5 font-body"
                            >
                              <Eye size={14} className="mr-1" />
                              View
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="border-amber-500/20 text-amber-600 hover:bg-amber-50 font-body transition-all"
                              onClick={() => {
                                alert(`"The Ritual Renewal" CRM template instantly queued for ${member.name} via WhatsApp/Email!`);
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
              </TabsContent>

              {/* FINANCE TAB */}
              <TabsContent value="finance" className="space-y-6">
                {/* Finance Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <MetricCard
                    label="Total Revenue"
                    value={Math.round(financeStats.totalRevenue)}
                    prefix="₹"
                    icon={TrendingUp}
                    tone="sage"
                    loading={!overviewLoaded}
                    hint={`+${financeStats.growthRate}% growth`}
                  />
                  <MetricCard
                    label="Total Expenses"
                    value={Math.round(financeStats.totalExpenses)}
                    prefix="₹"
                    icon={TrendingDown}
                    tone="terracotta"
                    loading={!overviewLoaded}
                    hint={`Coach ₹${Math.round(financeStats.coachPayments).toLocaleString("en-IN")} · Studio ₹${Math.round(financeStats.studioExpenses).toLocaleString("en-IN")}`}
                  />
                  <MetricCard
                    label="Net Profit"
                    value={Math.round(financeStats.profit)}
                    prefix="₹"
                    icon={DollarSign}
                    tone="sage"
                    loading={!overviewLoaded}
                    hint={
                      financeStats.totalRevenue > 0
                        ? `${((financeStats.profit / financeStats.totalRevenue) * 100).toFixed(0)}% margin`
                        : "—"
                    }
                  />
                </div>

                {/* Report Generation */}
                <Card className="border-sage/20 bg-white/95 backdrop-blur-xl">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="font-display text-2xl text-charcoal">
                          Generate Reports
                        </CardTitle>
                        <CardDescription className="font-body text-charcoal/60 mt-1">
                          Download financial reports for any time period
                        </CardDescription>
                      </div>
                      <FileText className="h-8 w-8 text-sage/40" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <Button
                        type="button"
                        className="bg-sage hover:bg-sage/90 text-white font-body h-12"
                        onClick={() => exportFinanceReport("week")}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Weekly Report
                      </Button>
                      <Button
                        type="button"
                        className="bg-sage hover:bg-sage/90 text-white font-body h-12"
                        onClick={() => exportFinanceReport("month")}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Monthly Report
                      </Button>
                      <Button
                        type="button"
                        className="bg-sage hover:bg-sage/90 text-white font-body h-12"
                        onClick={() => exportFinanceReport("quarter")}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Quarterly Report
                      </Button>
                      <Button
                        type="button"
                        className="bg-sage hover:bg-sage/90 text-white font-body h-12"
                        onClick={() => exportFinanceReport("year")}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Annual Report
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Transaction History */}
                <Card className="border-sage/20 bg-white/95 backdrop-blur-xl">
                  <CardHeader>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <CardTitle className="font-display text-2xl text-charcoal">
                          Recent Transactions
                        </CardTitle>
                        <CardDescription className="font-body text-charcoal/60">
                          All financial activities tracked
                        </CardDescription>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="border-sage/20 text-sage hover:bg-sage/5 font-body"
                        onClick={() => exportFinanceReport("filtered")}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export All
                      </Button>
                    </div>
                    
                    {/* Transaction Filters */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 rounded-xl bg-cream/30 border border-sage/20">
                      <div className="space-y-2">
                        <Label className="font-body text-xs text-charcoal/60">Filter by Type</Label>
                        <Select value={transactionFilter} onValueChange={setTransactionFilter}>
                          <SelectTrigger className="border-sage/20 bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Transactions</SelectItem>
                            <SelectItem value="credit">💰 Credits Only</SelectItem>
                            <SelectItem value="debit">💸 Debits Only</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="font-body text-xs text-charcoal/60">Date Range</Label>
                        <Select value={transactionDateRange} onValueChange={setTransactionDateRange}>
                          <SelectTrigger className="border-sage/20 bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Time</SelectItem>
                            <SelectItem value="today">Today</SelectItem>
                            <SelectItem value="week">This Week</SelectItem>
                            <SelectItem value="month">This Month</SelectItem>
                            <SelectItem value="custom">Custom Range</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="font-body text-xs text-charcoal/60">Category</Label>
                        <Select value={transactionType} onValueChange={setTransactionType}>
                          <SelectTrigger className="border-sage/20 bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Categories</SelectItem>
                            <SelectItem value="packages">Package Purchases</SelectItem>
                            <SelectItem value="coach">Coach Payments</SelectItem>
                            <SelectItem value="studio">Studio Expenses</SelectItem>
                            <SelectItem value="class_bookings">Class checkouts</SelectItem>
                            <SelectItem value="cafe">Café Revenue</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="font-body text-xs text-charcoal/60">Search</Label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-charcoal/40" />
                          <Input 
                            placeholder="Search transactions..." 
                            value={transactionSearch}
                            onChange={(e) => setTransactionSearch(e.target.value)}
                            className="border-sage/20 bg-white pl-9"
                          />
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {financeLedgerTransactions.some((t) => t.isFinanceDemo) ? (
                      <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 font-body text-sm text-amber-950">
                        Rows marked <strong>Sample</strong> are preview data so you can see Finance-1 layout
                        (+N guests, food labels, detail dialog). Real payments appear without that badge.
                      </p>
                    ) : null}
                    <div className="rounded-xl border border-sage/15 bg-white overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-sage/5 hover:bg-sage/5 border-sage/10">
                            <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3 w-[40px]" />
                            <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3">Category</TableHead>
                            <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3">Member</TableHead>
                            <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3 w-[120px]">Date</TableHead>
                            <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3 w-[120px]">Method</TableHead>
                            <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3 w-[140px] text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {financeTxnPg.pageItems.map((txn) => {
                            const openFinance = txn.finance1Tag === true && txn.financeDetail != null;
                            const displayMember = txn.memberFull ?? txn.member ?? txn.instructor ?? "Studio";
                            const plus = txn.memberPlusLabel?.trim() ? ` ${txn.memberPlusLabel.trim()}` : "";
                            return (
                              <TableRow
                                key={txn.id}
                                className={`border-sage/10 ${openFinance ? "cursor-pointer hover:bg-sage/5" : ""}`}
                                onClick={openFinance
                                  ? () => {
                                      if (txn.financeDetail) setSelectedFinanceDetail(txn.financeDetail);
                                      setFinanceDetailOpen(true);
                                    }
                                  : undefined}
                              >
                                <TableCell className="px-5 py-3">
                                  <div className={`p-2 rounded-lg w-fit ${txn.type === "revenue" ? "bg-sage/10" : "bg-red-50"}`}>
                                    {txn.type === "revenue" ? (
                                      <TrendingUp className="h-4 w-4 text-sage" />
                                    ) : (
                                      <TrendingDown className="h-4 w-4 text-red-500" />
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="px-5 py-3">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-body font-medium text-charcoal">{txn.category}</span>
                                    {txn.isFinanceDemo && (
                                      <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900 text-[10px] uppercase tracking-wide font-body">
                                        Sample
                                      </Badge>
                                    )}
                                  </div>
                                  {txn.foodOrderedLabel && txn.foodOrderedLabel !== "—" && (
                                    <div className="font-body text-xs text-charcoal/50 mt-0.5 truncate" title={txn.foodOrderedLabel}>
                                      {txn.foodOrderedLabel}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="px-5 py-3">
                                  <div className="font-body text-sm text-charcoal truncate">
                                    {displayMember}
                                    {plus && <span className="text-sage font-medium">{plus}</span>}
                                  </div>
                                </TableCell>
                                <TableCell className="px-5 py-3 font-body text-sm text-charcoal/60 whitespace-nowrap">
                                  {txn.date}
                                </TableCell>
                                <TableCell className="px-5 py-3">
                                  <Badge variant="outline" className="border-charcoal/15 text-charcoal/60 font-body whitespace-nowrap">
                                    {txn.method}
                                  </Badge>
                                </TableCell>
                                <TableCell className="px-5 py-3 text-right">
                                  <span className={`font-display text-base tabular-nums ${txn.type === "revenue" ? "text-sage" : "text-red-500"}`}>
                                    {formatTxnAmountRupee(txn.amount, txn.type)}
                                  </span>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    <Pagination page={financeTxnPg.page} total={financeTxnPg.total} onChange={financeTxnPg.setPage} />

                    {/* Show message if no transactions match filters */}
                    {filteredFinanceTransactions.length === 0 && (
                      <div className="text-center py-12">
                        <Filter className="h-12 w-12 text-charcoal/20 mx-auto mb-3" />
                        <div className="font-body text-charcoal/60">
                          No transactions match your filters
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="mt-4 border-sage/20 text-sage hover:bg-sage/5"
                          onClick={() => {
                            setTransactionFilter("all");
                            setTransactionDateRange("all");
                            setTransactionType("all");
                            setTransactionSearch("");
                          }}
                        >
                          Clear Filters
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Dialog
                  open={financeDetailOpen}
                  onOpenChange={(open) => {
                    setFinanceDetailOpen(open);
                    if (!open) setSelectedFinanceDetail(null);
                  }}
                >
                  <DialogContent className="max-h-[85vh] overflow-y-auto border-sage/20 bg-white sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle className="font-display text-charcoal">Finance-1 — transaction detail</DialogTitle>
                      <DialogDescription className="font-body text-charcoal/70">
                        Full breakdown (Razorpay, package vs café amounts, and attendees). Shown only when you open this dialog.
                      </DialogDescription>
                    </DialogHeader>

                    {selectedFinanceDetail ? (
                      <div className="space-y-4 font-body text-sm text-charcoal">
                        <div>
                          <div className="text-xs uppercase tracking-wide text-charcoal/50 mb-1">
                            Transaction type
                          </div>
                          <ul className="list-disc pl-5 space-y-1">
                            {(selectedFinanceDetail.transactionKinds ?? ["—"]).map((k, i) => (
                              <li key={i}>{k}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <div className="text-xs uppercase tracking-wide text-charcoal/50 mb-0.5">
                              When
                            </div>
                            <div>
                              {selectedFinanceDetail.source === "package"
                                ? selectedFinanceDetail.purchasedAtISO
                                  ? new Date(selectedFinanceDetail.purchasedAtISO).toLocaleString("en-IN", {
                                      dateStyle: "medium",
                                      timeStyle: "short",
                                    })
                                  : "—"
                                : selectedFinanceDetail.bookedAtISO
                                  ? new Date(selectedFinanceDetail.bookedAtISO).toLocaleString("en-IN", {
                                      dateStyle: "medium",
                                      timeStyle: "short",
                                    })
                                  : "—"}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-wide text-charcoal/50 mb-0.5">
                              Payment
                            </div>
                            <div>{selectedFinanceDetail.paymentMethodSummary ?? "—"}</div>
                          </div>
                        </div>

                        <div className="rounded-xl border border-charcoal/10 bg-sage/5 p-3 space-y-2">
                          <div className="font-medium text-charcoal">Billing member</div>
                          <div>Name: {selectedFinanceDetail.memberName ?? "—"}</div>
                          <div>Email: {selectedFinanceDetail.memberEmail ?? "—"}</div>
                          <div>Phone: {selectedFinanceDetail.memberPhone ?? "—"}</div>
                          {selectedFinanceDetail.classSummary ? (
                            <div className="pt-1 text-charcoal/80">{selectedFinanceDetail.classSummary}</div>
                          ) : null}
                          {selectedFinanceDetail.groupHeadcount != null ? (
                            <div className="text-charcoal/70">
                              Seats (member + guests): {selectedFinanceDetail.groupHeadcount}
                            </div>
                          ) : null}
                        </div>

                        <div>
                          <div className="font-medium text-charcoal mb-2">Razorpay</div>
                          <div className="space-y-1 text-charcoal/80">
                            <div>
                              Order ID:{" "}
                              <span className="font-mono text-xs text-charcoal">
                                {selectedFinanceDetail.razorpayOrderId ?? "—"}
                              </span>
                            </div>
                            <div>
                              Payment ID(s):{" "}
                              {(selectedFinanceDetail.razorpayPaymentIds?.length ?? 0) > 0
                                ? selectedFinanceDetail.razorpayPaymentIds!.map((pid) => (
                                    <span key={pid} className="font-mono text-xs block">
                                      {pid}
                                    </span>
                                  ))
                                : "—"}
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className="font-medium text-charcoal mb-2">Amounts (INR)</div>
                          <div className="rounded-xl border border-charcoal/10 divide-y divide-charcoal/10">
                            {selectedFinanceDetail.breakdown?.packageListInr != null ? (
                              <div className="flex justify-between px-3 py-2">
                                <span className="text-charcoal/70">Package list</span>
                                <span>{formatInrDetail(selectedFinanceDetail.breakdown.packageListInr)}</span>
                              </div>
                            ) : null}
                            {selectedFinanceDetail.breakdown?.couponDiscountInr != null &&
                            selectedFinanceDetail.breakdown.couponDiscountInr > 0 ? (
                              <div className="flex justify-between px-3 py-2">
                                <span className="text-charcoal/70">Coupon / discount</span>
                                <span>−{formatInrDetail(selectedFinanceDetail.breakdown.couponDiscountInr)}</span>
                              </div>
                            ) : null}
                            <div className="flex justify-between px-3 py-2">
                              <span className="text-charcoal/70">
                                {selectedFinanceDetail.source === "package"
                                  ? "Studio pass / package"
                                  : "Class / pass (checkout)"}
                              </span>
                              <span>{formatInrDetail(selectedFinanceDetail.breakdown?.classOrStudioPassInr)}</span>
                            </div>
                            <div className="flex justify-between px-3 py-2">
                              <span className="text-charcoal/70">Café (food &amp; add-ons, net)</span>
                              <span>{formatInrDetail(selectedFinanceDetail.breakdown?.cafeNetInr)}</span>
                            </div>
                            <div className="flex justify-between px-3 py-2">
                              <span className="text-charcoal/70">Tax</span>
                              <span>{formatInrDetail(selectedFinanceDetail.breakdown?.taxInr)}</span>
                            </div>
                            <div className="flex justify-between px-3 py-2 font-semibold">
                              <span>Total charged</span>
                              <span>{formatInrDetail(selectedFinanceDetail.breakdown?.totalInr)}</span>
                            </div>
                          </div>
                        </div>

                        {(selectedFinanceDetail.cafeLines?.length ?? 0) > 0 ? (
                          <div>
                            <div className="font-medium text-charcoal mb-2">Café items</div>
                            <ul className="list-disc pl-5 space-y-1 text-charcoal/80">
                              {selectedFinanceDetail.cafeLines!.map((ln, idx) => (
                                <li key={idx}>
                                  {ln.name} × {ln.quantity}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        <div>
                          <div className="font-medium text-charcoal mb-2">
                            Members &amp; guests (same checkout)
                          </div>
                          <div className="space-y-3">
                            {(selectedFinanceDetail.attendeeLines ?? []).map((row, idx) => (
                              <div
                                key={`${row.role}-${row.name}-${idx}`}
                                className="rounded-lg border border-charcoal/10 p-3 text-charcoal/80 space-y-1"
                              >
                                <div className="text-xs uppercase tracking-wide text-charcoal/50">{row.role}</div>
                                <div className="font-medium text-charcoal">{row.name}</div>
                                {row.email ? <div>Email: {row.email}</div> : null}
                                {row.phone ? <div>Phone: {row.phone}</div> : null}
                                {row.notes ? <div className="text-xs italic text-charcoal/60">{row.notes}</div> : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </DialogContent>
                </Dialog>

                {/* Analytics Graphs */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Revenue Trend Graph */}
                  <Card className="border-sage/20 bg-white/95 backdrop-blur-xl">
                    <CardHeader>
                      <CardTitle className="font-display text-xl text-charcoal">
                        Revenue Trend
                      </CardTitle>
                      <CardDescription className="font-body text-charcoal/60">
                        Daily revenue over the past 30 days
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Mock line graph visualization */}
                        <div className="h-64 flex items-end justify-between gap-2">
                          {[45, 52, 48, 61, 55, 58, 63, 59, 67, 64, 71, 68, 75, 72, 78, 82, 79, 85, 88, 84, 91, 87, 94, 92, 98, 99].map((value, idx) => (
                            <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                              <div 
                                className="w-full bg-gradient-to-t from-sage to-sage/40 rounded-t-sm hover:from-sage/90 hover:to-sage/60 transition-all duration-300 cursor-pointer relative group"
                                style={{ height: `${value}%` }}
                              >
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-charcoal text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                  ₹{(15 + idx * 2).toFixed(1)}k
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center justify-between text-xs text-charcoal/50 font-body">
                          <span>30 days ago</span>
                          <span>Today</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Revenue Source Pie Chart */}
                  <Card className="border-sage/20 bg-white/95 backdrop-blur-xl">
                    <CardHeader>
                      <CardTitle className="font-display text-xl text-charcoal">
                        Revenue Sources
                      </CardTitle>
                      <CardDescription className="font-body text-charcoal/60">
                        Breakdown by revenue type
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-center py-8">
                        <div className="relative w-48 h-48">
                          {/* Pie chart visualization */}
                          <svg viewBox="0 0 100 100" className="transform -rotate-90">
                            {/* Premium Packages - 85% */}
                            <circle
                              cx="50"
                              cy="50"
                              r="40"
                              fill="transparent"
                              stroke="#8F9779"
                              strokeWidth="20"
                              strokeDasharray="213 251"
                              className="hover:opacity-80 transition-opacity cursor-pointer"
                            />
                            {/* Aerial Specialty - 15% */}
                            <circle
                              cx="50"
                              cy="50"
                              r="40"
                              fill="transparent"
                              stroke="#D4A574"
                              strokeWidth="20"
                              strokeDasharray="38 226"
                              strokeDashoffset="-213"
                              className="hover:opacity-80 transition-opacity cursor-pointer"
                            />
                          </svg>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-2 mt-4">
                        <div className="flex items-center justify-between p-2 rounded-lg hover:bg-sage/5 transition-colors">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-sage" />
                            <span className="font-body text-sm text-charcoal">Premium Packages</span>
                          </div>
                          <span className="font-body font-medium text-charcoal">85%</span>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg hover:bg-sage/5 transition-colors">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-[#D4A574]" />
                            <span className="font-body text-sm text-charcoal">Aerial Specialty</span>
                          </div>
                          <span className="font-body font-medium text-charcoal">15%</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Profit/Loss Comparison */}
                  <Card className="border-sage/20 bg-white/95 backdrop-blur-xl lg:col-span-2">
                    <CardHeader>
                      <CardTitle className="font-display text-xl text-charcoal">
                        Monthly P&amp;L
                      </CardTitle>
                      <CardDescription className="font-body text-charcoal/60">
                        Revenue vs expenses over the past 6 months
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {financeTrend.length === 0 ? (
                        <div className="h-[280px] flex items-center justify-center font-body text-sm text-charcoal/40">
                          No data yet.
                        </div>
                      ) : (
                        <ChartContainer
                          config={{
                            revenue: { label: "Revenue", color: "#8F9779" },
                            expenses: { label: "Expenses", color: "#C17856" },
                            profit: { label: "Profit", color: "#6B8E73" },
                          }}
                          className="h-[300px] w-full"
                        >
                          <ComposedChart data={financeTrend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E5E5E0" />
                            <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#6B6B6B" }} />
                            <YAxis
                              tickLine={false}
                              axisLine={false}
                              tick={{ fontSize: 12, fill: "#6B6B6B" }}
                              tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`}
                              width={48}
                            />
                            <ChartTooltip
                              cursor={{ fill: "rgba(143,151,121,0.05)" }}
                              content={
                                <ChartTooltipContent
                                  formatter={(v) => `₹${Number(v).toLocaleString("en-IN")}`}
                                />
                              }
                            />
                            <ChartLegend content={<ChartLegendContent />} />
                            <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[6, 6, 0, 0]} maxBarSize={36} />
                            <Bar dataKey="expenses" fill="var(--color-expenses)" radius={[6, 6, 0, 0]} maxBarSize={36} />
                            <Line
                              type="monotone"
                              dataKey="profit"
                              stroke="var(--color-profit)"
                              strokeWidth={2.5}
                              dot={{ r: 4, fill: "var(--color-profit)" }}
                              activeDot={{ r: 6 }}
                            />
                          </ComposedChart>
                        </ChartContainer>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* PRICING & COUPONS */}
              <TabsContent value="pricing" className="space-y-6">
                {(() => {
                  const totalCoupons = coupons.length;
                  const activeCoupons = coupons.filter((c) => c.is_active).length;
                  const totalRedemptions = coupons.reduce((s, c) => s + (c.redemption_count ?? 0), 0);
                  const scopeTally: Record<string, number> = {};
                  for (const c of coupons) scopeTally[c.applies_to] = (scopeTally[c.applies_to] ?? 0) + 1;
                  const topScope = Object.entries(scopeTally).sort((a, b) => b[1] - a[1])[0];
                  const topLabel = topScope
                    ? COUPON_CONTEXTS.find((x) => x.value === topScope[0])?.label ?? topScope[0]
                    : "—";
                  return (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <MetricCard label="Total Coupons" value={totalCoupons} icon={Tag} tone="sage" loading={couponsLoading} />
                      <MetricCard label="Active" value={activeCoupons} icon={CheckCircle2} tone="sage" loading={couponsLoading} hint="Live for checkout" />
                      <MetricCard label="Redemptions" value={totalRedemptions} icon={TrendingUp} tone="terracotta" loading={couponsLoading} />
                      <MetricCard label="Top scope" value={topLabel} icon={BarChart3} tone="charcoal" loading={couponsLoading} hint={topScope ? `${topScope[1]} coupons` : ""} />
                    </div>
                  );
                })()}
                <Card className="border-sage/20 bg-white/95 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="font-display text-2xl text-charcoal">Coupons & discounts</CardTitle>
                    <CardDescription className="font-body text-charcoal/60">
                      Create codes for Food (café), Ecommerce (boutique), Class pass, or Studio pass. Members enter a code at checkout.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4 rounded-xl border border-sage/15 bg-cream/20">
                      <div className="space-y-3">
                        <div>
                          <Label className="font-body text-charcoal">Coupon code</Label>
                          <Input
                            value={couponDraft.code}
                            onChange={(e) => setCouponDraft({ ...couponDraft, code: e.target.value })}
                            placeholder="E.g. SUMMER20"
                            className="border-sage/20 mt-1 font-mono uppercase"
                          />
                        </div>
                        <div>
                          <Label className="font-body text-charcoal">Applies to</Label>
                          <Select
                            value={couponDraft.applies_to}
                            onValueChange={(v) => setCouponDraft({ ...couponDraft, applies_to: v })}
                          >
                            <SelectTrigger className="border-sage/20 mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {COUPON_CONTEXTS.map((c) => (
                                <SelectItem key={c.value} value={c.value}>
                                  {c.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="font-body text-charcoal">Discount type</Label>
                            <Select
                              value={couponDraft.discount_type}
                              onValueChange={(v) =>
                                setCouponDraft({ ...couponDraft, discount_type: v })
                              }
                            >
                              <SelectTrigger className="border-sage/20 mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="percent">Percent %</SelectItem>
                                <SelectItem value="fixed">Fixed ₹</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="font-body text-charcoal">
                              {couponDraft.discount_type === "percent" ? "Percent off" : "Amount (₹)"}
                            </Label>
                            <Input
                              type="number"
                              min={0}
                              step={couponDraft.discount_type === "percent" ? 1 : 1}
                              value={couponDraft.discount_value}
                              onChange={(e) =>
                                setCouponDraft({ ...couponDraft, discount_value: e.target.value })
                              }
                              className="border-sage/20 mt-1"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="font-body text-charcoal">Max uses (total)</Label>
                            <Input
                              placeholder="Unlimited"
                              value={couponDraft.max_redemptions}
                              onChange={(e) =>
                                setCouponDraft({ ...couponDraft, max_redemptions: e.target.value })
                              }
                              className="border-sage/20 mt-1"
                            />
                          </div>
                          <div>
                            <Label className="font-body text-charcoal">Max / user</Label>
                            <Input
                              placeholder="Unlimited"
                              value={couponDraft.max_uses_per_user}
                              onChange={(e) =>
                                setCouponDraft({ ...couponDraft, max_uses_per_user: e.target.value })
                              }
                              className="border-sage/20 mt-1"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="font-body text-charcoal">Starts (optional)</Label>
                            <Input
                              type="datetime-local"
                              value={couponDraft.starts_at}
                              onChange={(e) =>
                                setCouponDraft({ ...couponDraft, starts_at: e.target.value })
                              }
                              className="border-sage/20 mt-1"
                            />
                          </div>
                          <div>
                            <Label className="font-body text-charcoal">Ends (optional)</Label>
                            <Input
                              type="datetime-local"
                              value={couponDraft.ends_at}
                              onChange={(e) =>
                                setCouponDraft({ ...couponDraft, ends_at: e.target.value })
                              }
                              className="border-sage/20 mt-1"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-3 pt-2">
                          <Switch
                            id="coupon-active"
                            checked={couponDraft.is_active}
                            onCheckedChange={(v) => setCouponDraft({ ...couponDraft, is_active: v })}
                          />
                          <Label htmlFor="coupon-active" className="font-body text-charcoal cursor-pointer">
                            Active
                          </Label>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-2">
                          <Button
                            type="button"
                            onClick={() => void saveCouponFromDraft()}
                            disabled={couponSaving}
                            className="bg-sage hover:bg-sage/90 text-white font-body"
                          >
                            {couponSaving ? "Saving..." : editingCouponId ? "Update coupon" : "Create coupon"}
                          </Button>
                          {editingCouponId && (
                            <Button
                              type="button"
                              variant="outline"
                              className="border-sage/30 font-body"
                              onClick={() => {
                                setEditingCouponId(null);
                                setCouponDraft({
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
                              }}
                            >
                              Cancel edit
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="rounded-xl bg-white/80 border border-sage/10 p-4">
                        <p className="font-body text-sm text-charcoal/70 leading-relaxed">
                          Fixed amount never exceeds cart or package subtotal. Percent is capped at 100%.
                          Café and boutique prices are taken from the database at checkout so codes cannot be abused with
                          fake totals. Package coupons match studio vs class pass automatically.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {couponsLoading ? (
                        <p className="p-6 font-body text-charcoal/60">Loading coupons…</p>
                      ) : coupons.length === 0 ? (
                        <div className="text-center py-10 border border-dashed border-sage/20 rounded-xl bg-cream/20">
                          <p className="font-body text-sm text-charcoal/50">No coupons yet. Create one on the left.</p>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-sage/15 bg-white overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-sage/5 hover:bg-sage/5 border-sage/10">
                                <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3">Code</TableHead>
                                <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3">Scope</TableHead>
                                <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3">Discount</TableHead>
                                <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3">Uses</TableHead>
                                <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3">Status</TableHead>
                                <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3 w-[180px]">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {couponsPg.pageItems.map((c) => (
                                <TableRow key={c.id} className="border-sage/10">
                                  <TableCell className="px-5 py-3 font-mono font-semibold text-charcoal">{c.code}</TableCell>
                                  <TableCell className="px-5 py-3 font-body text-sm text-charcoal/80">
                                    {COUPON_CONTEXTS.find((x) => x.value === c.applies_to)?.label ?? c.applies_to}
                                  </TableCell>
                                  <TableCell className="px-5 py-3 font-body text-sm text-charcoal">
                                    {c.discount_type === "percent" ? `${c.discount_value}%` : `₹${c.discount_value}`}
                                  </TableCell>
                                  <TableCell className="px-5 py-3 font-body text-sm text-charcoal/80 tabular-nums">
                                    {c.redemption_count}
                                    {c.max_redemptions != null ? ` / ${c.max_redemptions}` : ""}
                                  </TableCell>
                                  <TableCell className="px-5 py-3">
                                    <Badge className={c.is_active ? "bg-sage text-white font-body" : "bg-charcoal/15 text-charcoal/70 font-body"}>
                                      {c.is_active ? "Active" : "Off"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="px-5 py-3">
                                    <div className="flex items-center gap-1.5">
                                      <Button type="button" size="sm" variant="outline" className="border-sage/20 text-sage hover:bg-sage/10 font-body h-8" onClick={() => startEditCoupon(c)}>
                                        Edit
                                      </Button>
                                      <Button type="button" size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 font-body h-8" onClick={() => void deleteCouponById(c.id)}>
                                        Delete
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                      <Pagination page={couponsPg.page} total={couponsPg.total} onChange={couponsPg.setPage} />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* MEAL SUBSCRIPTION WAITLIST */}
              <TabsContent value="meal-waitlist" className="space-y-6">
                {(() => {
                  const total = mealInquiries.length;
                  const byStatus = (s: string) => mealInquiries.filter((r) => r.status === s).length;
                  return (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <MetricCard label="Total Inquiries" value={total} icon={ChefHat} tone="sage" loading={mealInquiriesLoading} />
                      <MetricCard label="New" value={byStatus("new")} icon={AlertTriangle} tone="amber" loading={mealInquiriesLoading} hint="Awaiting outreach" />
                      <MetricCard label="Contacted" value={byStatus("contacted")} icon={CheckCircle2} tone="terracotta" loading={mealInquiriesLoading} />
                      <MetricCard label="Closed" value={byStatus("closed")} icon={CheckCircle2} tone="charcoal" loading={mealInquiriesLoading} />
                    </div>
                  );
                })()}
                <Card className="border-sage/20 bg-white/95 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="font-display text-2xl text-charcoal">Meal subscription waitlist</CardTitle>
                    <CardDescription className="font-body text-charcoal/60">
                      Submissions from the &ldquo;Join the Waitlist&rdquo; form on the meal subscription page. Newest first.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {mealInquiriesLoading ? (
                      <p className="font-body text-charcoal/60 py-8">Loading…</p>
                    ) : mealInquiries.length === 0 ? (
                      <div className="text-center py-10 border border-dashed border-sage/20 rounded-xl bg-cream/20">
                        <p className="font-body text-sm text-charcoal/50">No enquiries yet.</p>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-sage/15 bg-white overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-sage/5 hover:bg-sage/5 border-sage/10">
                              <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3 w-[160px]">Date</TableHead>
                              <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3">Name</TableHead>
                              <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3">Contact</TableHead>
                              <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3 min-w-[200px]">Message</TableHead>
                              <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3 w-[160px]">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {mealInquiriesPg.pageItems.map((row) => (
                              <TableRow key={row.id} className="border-sage/10 align-top">
                                <TableCell className="px-5 py-3 font-body text-sm text-charcoal/70 whitespace-nowrap">
                                  {new Date(row.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                                </TableCell>
                                <TableCell className="px-5 py-3 font-body font-medium text-charcoal">{row.full_name}</TableCell>
                                <TableCell className="px-5 py-3">
                                  <div className="space-y-0.5">
                                    <a href={`mailto:${row.email}`} className="block font-body text-sm text-sage hover:underline break-all">{row.email}</a>
                                    <a href={`tel:${row.phone}`} className="block font-body text-xs text-charcoal/60 hover:text-sage whitespace-nowrap">{row.phone}</a>
                                  </div>
                                </TableCell>
                                <TableCell className="px-5 py-3 font-body text-sm text-charcoal/70 max-w-md whitespace-pre-wrap">
                                  {row.message?.trim() ? row.message : "—"}
                                </TableCell>
                                <TableCell className="px-5 py-3">
                                  <Select value={row.status} onValueChange={(v) => void updateMealInquiryStatus(row.id, v)}>
                                    <SelectTrigger className="w-[140px] border-sage/20 h-9 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="new">New</SelectItem>
                                      <SelectItem value="contacted">Contacted</SelectItem>
                                      <SelectItem value="closed">Closed</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                    <Pagination page={mealInquiriesPg.page} total={mealInquiriesPg.total} onChange={mealInquiriesPg.setPage} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="rental-inquiries" className="space-y-6">
                {(() => {
                  const total = rentalInquiries.length;
                  const byStatus = (s: string) => rentalInquiries.filter((r) => r.status === s).length;
                  const totalGuests = rentalInquiries.reduce((sum, r) => sum + (Number(r.guest_count) || 0), 0);
                  return (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <MetricCard label="Total Inquiries" value={total} icon={Building2} tone="sage" loading={rentalInquiriesLoading} />
                      <MetricCard label="New" value={byStatus("new")} icon={AlertTriangle} tone="amber" loading={rentalInquiriesLoading} hint="Awaiting reply" />
                      <MetricCard label="In Review" value={byStatus("in_review")} icon={Clock} tone="terracotta" loading={rentalInquiriesLoading} />
                      <MetricCard label="Total Guests Asked" value={totalGuests} icon={Users} tone="charcoal" loading={rentalInquiriesLoading} />
                    </div>
                  );
                })()}
                <Card className="border-sage/20 bg-white/95 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="font-display text-2xl text-charcoal">Space rental inquiries</CardTitle>
                    <CardDescription className="font-body text-charcoal/60">
                      Submissions from the public rental page. Newest first.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {rentalInquiriesLoading ? (
                      <p className="font-body text-charcoal/60 py-8">Loading…</p>
                    ) : rentalInquiries.length === 0 ? (
                      <div className="text-center py-10 border border-dashed border-sage/20 rounded-xl bg-cream/20">
                        <p className="font-body text-sm text-charcoal/50">No inquiries yet.</p>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-sage/15 bg-white overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-sage/5 hover:bg-sage/5 border-sage/10">
                              <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3 w-[160px]">Date</TableHead>
                              <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3">Name</TableHead>
                              <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3">Contact</TableHead>
                              <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3">Event</TableHead>
                              <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3 min-w-[180px]">Notes</TableHead>
                              <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3 w-[120px]">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rentalInquiriesPg.pageItems.map((row) => (
                              <TableRow key={row.id} className="border-sage/10 align-top">
                                <TableCell className="px-5 py-3 font-body text-sm text-charcoal/70 whitespace-nowrap">
                                  {new Date(row.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                                </TableCell>
                                <TableCell className="px-5 py-3 font-body font-medium text-charcoal">{row.name}</TableCell>
                                <TableCell className="px-5 py-3">
                                  <div className="space-y-0.5">
                                    <a href={`mailto:${row.email}`} className="block font-body text-sm text-sage hover:underline break-all">{row.email}</a>
                                    <a href={`tel:${row.phone}`} className="block font-body text-xs text-charcoal/60 hover:text-sage whitespace-nowrap">{row.phone}</a>
                                  </div>
                                </TableCell>
                                <TableCell className="px-5 py-3">
                                  <div className="font-body text-sm text-charcoal">{row.event_type?.trim() ? row.event_type : "—"}</div>
                                  <div className="font-body text-xs text-charcoal/50 mt-0.5">
                                    {row.event_date?.trim() ? row.event_date : ""}
                                    {row.guest_count?.trim() ? ` · ${row.guest_count} guests` : ""}
                                    {row.duration?.trim() ? ` · ${row.duration}` : ""}
                                  </div>
                                </TableCell>
                                <TableCell className="px-5 py-3 font-body text-sm text-charcoal/70 max-w-md whitespace-pre-wrap">
                                  {row.message?.trim() ? row.message : "—"}
                                </TableCell>
                                <TableCell className="px-5 py-3">
                                  <Badge variant="outline" className="border-sage/20 text-sage bg-sage/5 capitalize font-body whitespace-nowrap">
                                    {row.status.replace(/_/g, " ")}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                    <Pagination page={rentalInquiriesPg.page} total={rentalInquiriesPg.total} onChange={rentalInquiriesPg.setPage} />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* MEMBERS TAB */}
              <TabsContent value="members" className="space-y-6">
                {/* Scope indicator — metrics auto-track the selected filter */}
                <div className="rounded-xl border border-sage/20 bg-white/60 backdrop-blur-xl p-3">
                  <div className="font-body text-sm font-medium text-charcoal">Metrics scope</div>
                  <div className="font-body text-xs text-charcoal/60">
                    {selectedMember === "all"
                      ? "Showing stats across all members"
                      : `Showing stats from the ${filteredMemberList.length} member(s) matching the current filter`}
                  </div>
                </div>

                {/* Member Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <MetricCard
                    label="On-Time Check-Ins"
                    value={displayedMemberStats.onTimeCheckIns}
                    icon={UserCheck}
                    tone="sage"
                    hint={
                      displayedMemberStats.checkInSample > 0
                        ? `${displayedMemberStats.onTimeCheckInPct}% of ${displayedMemberStats.checkInSample}`
                        : "No recent check-ins"
                    }
                  />
                  <MetricCard
                    label="Late Check-Ins"
                    value={displayedMemberStats.lateCheckIns}
                    icon={Clock}
                    tone="amber"
                    hint={
                      displayedMemberStats.checkInSample > 0
                        ? `${displayedMemberStats.lateCheckInPct}% after start`
                        : "No recent check-ins"
                    }
                  />
                  <MetricCard
                    label="No-Shows"
                    value={displayedMemberStats.noShows}
                    icon={UserX}
                    tone="terracotta"
                  />
                  <MetricCard
                    label="Inactive Members"
                    value={displayedMemberStats.inactiveUsers}
                    icon={AlertTriangle}
                    tone="charcoal"
                  />
                </div>

                {/* Member Analytics Graphs */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Member Growth Trend */}
                  <Card className="border-sage/20 bg-white/95 backdrop-blur-xl">
                    <CardHeader>
                      <CardTitle className="font-display text-xl text-charcoal">
                        Member Growth
                      </CardTitle>
                      <CardDescription className="font-body text-charcoal/60">
                        New member signups over time
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer
                        config={{ growth: { label: "New members", color: "#8F9779" } }}
                        className="h-[240px] w-full"
                      >
                        <BarChart
                          data={[
                            { month: "Jan", growth: 8 },
                            { month: "Feb", growth: 12 },
                            { month: "Mar", growth: 10 },
                            { month: "Apr", growth: 15 },
                            { month: "May", growth: 13 },
                            { month: "Jun", growth: 18 },
                            { month: "Jul", growth: 16 },
                            { month: "Aug", growth: 21 },
                            { month: "Sep", growth: 19 },
                            { month: "Oct", growth: 24 },
                            { month: "Nov", growth: 22 },
                            { month: "Dec", growth: 28 },
                          ]}
                          margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E5E5E0" />
                          <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#6B6B6B" }} />
                          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#6B6B6B" }} width={32} />
                          <ChartTooltip cursor={{ fill: "rgba(143,151,121,0.05)" }} content={<ChartTooltipContent />} />
                          <Bar dataKey="growth" fill="var(--color-growth)" radius={[6, 6, 0, 0]} maxBarSize={24} />
                        </BarChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>

                  {/* Active vs Inactive Distribution */}
                  <Card className="border-sage/20 bg-white/95 backdrop-blur-xl">
                    <CardHeader>
                      <CardTitle className="font-display text-xl text-charcoal">
                        Member Activity Status
                      </CardTitle>
                      <CardDescription className="font-body text-charcoal/60">
                        Active vs inactive members
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {(() => {
                        const activeRaw = displayedMemberStats.specialtyActive + displayedMemberStats.premiumActive;
                        const inactiveRaw = displayedMemberStats.inactiveUsers;
                        const active = activeRaw > 0 || inactiveRaw > 0 ? activeRaw : 112;
                        const inactive = activeRaw > 0 || inactiveRaw > 0 ? inactiveRaw : 15;
                        const total = active + inactive;
                        const activePct = total > 0 ? Math.round((active / total) * 100) : 0;
                        const pieData = [
                          { name: "Active", value: active },
                          { name: "Inactive", value: inactive },
                        ];
                        return (
                          <>
                            <ChartContainer
                              config={{
                                Active: { label: "Active", color: "#8F9779" },
                                Inactive: { label: "Inactive", color: "#D1D5DB" },
                              }}
                              className="mx-auto aspect-square max-h-[200px]"
                            >
                              <RechartsPieChart>
                                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                                <Pie
                                  data={pieData}
                                  dataKey="value"
                                  nameKey="name"
                                  innerRadius={55}
                                  outerRadius={80}
                                  strokeWidth={2}
                                  stroke="#FFFFFF"
                                >
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
                                          <tspan x={cx} y={cy - 4} fill="#333333" fontSize="22" fontWeight="600">{activePct}%</tspan>
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
                                <div className="font-display text-2xl text-sage tabular-nums">{active}</div>
                              </div>
                              <div className="p-3 rounded-lg bg-charcoal/5 border border-charcoal/20">
                                <div className="flex items-center gap-2 mb-1">
                                  <div className="w-2 h-2 rounded-full bg-charcoal/40" />
                                  <span className="font-body text-xs text-charcoal/60">Inactive</span>
                                </div>
                                <div className="font-display text-2xl text-charcoal tabular-nums">{inactive}</div>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </CardContent>
                  </Card>

                  {/* Streak Distribution Histogram */}
                  <Card className="border-sage/20 bg-white/95 backdrop-blur-xl lg:col-span-2">
                    <CardHeader>
                      <CardTitle className="font-display text-xl text-charcoal">
                        Weekly Streak Distribution
                      </CardTitle>
                      <CardDescription className="font-body text-charcoal/60">
                        How many members maintain different streak lengths
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer
                        config={{ count: { label: "Members", color: "#8F9779" } }}
                        className="h-[220px] w-full"
                      >
                        <BarChart
                          data={[
                            { range: "1-2 wk", count: 45 },
                            { range: "3-4 wk", count: 38 },
                            { range: "5-8 wk", count: 28 },
                            { range: "9-12 wk", count: 12 },
                            { range: "13+ wk", count: 5 },
                          ]}
                          layout="vertical"
                          margin={{ top: 8, right: 24, left: 16, bottom: 0 }}
                        >
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

                {/* Member of the Month */}
                <Card className="border-sage/20 bg-gradient-to-br from-sage/5 to-white backdrop-blur-xl">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="font-display text-2xl text-charcoal flex items-center gap-2">
                          <Trophy className="h-6 w-6 text-amber-500" />
                          Member of the Month
                        </CardTitle>
                        <CardDescription className="font-body text-charcoal/60 mt-1">
                          Top performer this month
                        </CardDescription>
                      </div>
                      <Award className="h-12 w-12 text-sage/20" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-6 p-6 rounded-xl bg-white border border-sage/20">
                      <div className="h-20 w-20 rounded-full bg-sage/10 flex items-center justify-center">
                        <Star className="h-10 w-10 text-sage" />
                      </div>
                      <div className="flex-1">
                        <div className="font-display text-3xl text-charcoal mb-2">
                          {memberStats.memberOfMonth.name}
                        </div>
                        <div className="flex items-center gap-6 text-charcoal/60">
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
                      <Button className="bg-sage hover:bg-sage/90 text-white font-body">
                        View Profile
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Pass Expiry Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="border-amber-500/20 bg-gradient-to-br from-amber-50 to-white backdrop-blur-xl">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="font-body text-sm text-charcoal/60 font-medium">
                          Expiring in 7 Days
                        </CardTitle>
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="font-display text-5xl text-charcoal mb-3">
                        {memberStats.expiring7Days}
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full border-amber-500/20 text-amber-600 hover:bg-amber-50 font-body"
                      >
                        Add to CRM
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="border-amber-500/20 bg-gradient-to-br from-amber-50/50 to-white backdrop-blur-xl">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="font-body text-sm text-charcoal/60 font-medium">
                          Expiring in 15 Days
                        </CardTitle>
                        <Clock className="h-5 w-5 text-amber-500" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="font-display text-5xl text-charcoal mb-3">
                        {memberStats.expiring15Days}
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full border-amber-500/20 text-amber-600 hover:bg-amber-50 font-body"
                      >
                        Add to CRM
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="border-sage/20 bg-white/95 backdrop-blur-xl">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="font-body text-sm text-charcoal/60 font-medium">
                          Expiring in 30 Days
                        </CardTitle>
                        <Calendar className="h-5 w-5 text-sage" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="font-display text-5xl text-charcoal mb-3">
                        {memberStats.expiring30Days}
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full border-sage/20 text-sage hover:bg-sage/5 font-body"
                      >
                        View List
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                {/* Active Members by Pass */}
                <Card className="border-sage/20 bg-white/95 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="font-display text-2xl text-charcoal">
                      Active Members by Pass Type
                    </CardTitle>
                    <CardDescription className="font-body text-charcoal/60">
                      Distribution across membership tiers
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-sage text-white">Premium</Badge>
                            <span className="font-body text-charcoal/60">{displayedMemberStats.premiumActive} members</span>
                          </div>
                          <span className="font-body font-medium text-charcoal">
                            {activeMemberTierTotal > 0
                              ? ((displayedMemberStats.premiumActive / activeMemberTierTotal) * 100).toFixed(0)
                              : "0"}
                            %
                          </span>
                        </div>
                        <Progress
                          value={
                            activeMemberTierTotal > 0
                              ? (displayedMemberStats.premiumActive / activeMemberTierTotal) * 100
                              : 0
                          }
                          className="h-3 bg-sage/10"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="border-terracotta/20 text-terracotta">Specialty</Badge>
                            <span className="font-body text-charcoal/60">{displayedMemberStats.specialtyActive} members</span>
                          </div>
                          <span className="font-body font-medium text-charcoal">
                            {activeMemberTierTotal > 0
                              ? ((displayedMemberStats.specialtyActive / activeMemberTierTotal) * 100).toFixed(0)
                              : "0"}
                            %
                          </span>
                        </div>
                        <Progress
                          value={
                            activeMemberTierTotal > 0
                              ? (displayedMemberStats.specialtyActive / activeMemberTierTotal) * 100
                              : 0
                          }
                          className="h-3 bg-terracotta/10"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Member Performance Table */}
                <Card className="border-sage/20 bg-white/95 backdrop-blur-xl">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="font-display text-2xl text-charcoal">
                          Member Performance
                        </CardTitle>
                        <CardDescription className="font-body text-charcoal/60">
                          Detailed check-in and attendance stats
                        </CardDescription>
                      </div>
                      <Select value={selectedMember} onValueChange={setSelectedMember}>
                        <SelectTrigger className="w-48 border-sage/20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Users</SelectItem>
                          <SelectItem value="premium">Premium Pass</SelectItem>
                          <SelectItem value="specialty">Aerial Specialty</SelectItem>
                          <SelectItem value="active">Active Only</SelectItem>
                          <SelectItem value="inactive">Inactive Only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-xl border border-sage/15 bg-white overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-sage/5 hover:bg-sage/5 border-sage/10">
                            <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3">Member</TableHead>
                            <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3 w-[160px]">Package</TableHead>
                            <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3 w-[80px]">Streak</TableHead>
                            <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3 w-[80px]">On Time</TableHead>
                            <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3 w-[70px]">Late</TableHead>
                            <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3 w-[90px]">No-Show</TableHead>
                            <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3 w-[80px] text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {membersPg.pageItems.map((member) => (
                            <TableRow key={`${member.profileId ?? "p"}-${member.id}`} className="border-sage/10">
                              <TableCell className="px-5 py-3">
                                <div className="flex items-center gap-3">
                                  <ListAvatar name={String(member.name ?? "?")} src={member.avatarUrl ?? null} size="sm" ringClassName="ring-sage/20" />
                                  <div className="min-w-0">
                                    <div className="font-body font-medium text-charcoal truncate">{member.name}</div>
                                    <div className="font-body text-xs text-charcoal/50">{member.credits} credits</div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="px-5 py-3">
                                <Badge variant="outline" className="border-sage/20 text-sage bg-sage/5 font-body whitespace-nowrap">
                                  {member.package}
                                </Badge>
                              </TableCell>
                              <TableCell className="px-5 py-3 font-display text-base text-sage tabular-nums">{member.streak}</TableCell>
                              <TableCell className="px-5 py-3 font-display text-base text-charcoal tabular-nums">{member.onTime}</TableCell>
                              <TableCell className="px-5 py-3 font-display text-base text-amber-600 tabular-nums">{member.late}</TableCell>
                              <TableCell className="px-5 py-3 font-display text-base text-red-500 tabular-nums">{member.noShow}</TableCell>
                              <TableCell className="px-5 py-3 text-right">
                                <Button variant="outline" size="sm" className="border-sage/20 text-sage hover:bg-sage/10 font-body h-8">
                                  View
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <Pagination page={membersPg.page} total={membersPg.total} onChange={membersPg.setPage} />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* INSTRUCTORS TAB */}
              <TabsContent value="instructors" className="space-y-6">
                {(() => {
                  const total = dashboardInstructors.length;
                  const checkInsSum = filteredInstructorPerformance.reduce((s, i) => s + i.totalCheckIns, 0);
                  const classesSum = filteredInstructorPerformance.reduce((s, i) => s + i.classes, 0);
                  const totalPayout = checkInsSum * 150;
                  const avgPerInstructor = total > 0 ? Math.round(totalPayout / total) : 0;
                  const ratings = filteredInstructorPerformance.filter((i) => i.rating > 0).map((i) => i.rating);
                  const avgRating = ratings.length > 0 ? ratings.reduce((s, r) => s + r, 0) / ratings.length : 0;
                  const top = [...filteredInstructorPerformance].sort((a, b) => b.totalCheckIns - a.totalCheckIns)[0];
                  return (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                      <MetricCard label="Active Instructors" value={total} icon={Award} tone="sage" />
                      <MetricCard label="Check-Ins (30d)" value={checkInsSum} icon={UserCheck} tone="sage" />
                      <MetricCard label="Classes (30d)" value={classesSum} icon={Calendar} tone="sage" />
                      <MetricCard label="Avg Rating" value={avgRating} decimals={1} icon={Star} tone="amber" />
                      <MetricCard label="Total Payout" value={totalPayout} prefix="₹" icon={CreditCard} tone="terracotta" hint={`Avg ₹${avgPerInstructor.toLocaleString("en-IN")} / instructor`} />
                      <MetricCard label="Top Performer" value={top?.name ?? "—"} icon={TrendingUp} tone="terracotta" hint={top ? `${top.totalCheckIns} check-ins` : ""} />
                    </div>
                  );
                })()}
                {/* Instructor Filter */}
                <Card className="border-sage/20 bg-white/95 backdrop-blur-xl">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="font-display text-2xl text-charcoal">
                        Instructor Performance
                      </CardTitle>
                      <Select value={selectedInstructor} onValueChange={setSelectedInstructor}>
                        <SelectTrigger className="w-48 border-sage/20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Instructors</SelectItem>
                          {dashboardInstructors.map((ins) => (
                            <SelectItem key={ins.id} value={ins.name}>
                              {ins.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-xl border border-sage/15 bg-white overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-sage/5 hover:bg-sage/5 border-sage/10">
                            <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3 w-[60px]">Rank</TableHead>
                            <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3">Instructor</TableHead>
                            <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3 w-[110px]">Rating</TableHead>
                            <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3 w-[100px]">Classes</TableHead>
                            <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3 w-[110px]">Check-Ins</TableHead>
                            <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3 w-[130px]">Avg Attendance</TableHead>
                            <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3 w-[130px]">Earnings</TableHead>
                            <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3 w-[90px] text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {instructorsPerfPg.pageItems.map((instructor, index) => {
                            const rank = (instructorsPerfPg.page - 1) * instructorsPerfPg.pageSize + index + 1;
                            return (
                              <TableRow key={instructor.name} className="border-sage/10">
                                <TableCell className="px-5 py-3">
                                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-sage/10 text-sage font-display text-xs">
                                    #{rank}
                                  </span>
                                </TableCell>
                                <TableCell className="px-5 py-3">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <ListAvatar name={instructor.name} src={instructor.photo ?? null} size="md" ringClassName="ring-sage/20" />
                                    <div className="font-body font-medium text-charcoal truncate">{instructor.name}</div>
                                  </div>
                                </TableCell>
                                <TableCell className="px-5 py-3">
                                  <div className="flex items-center gap-1">
                                    <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                                    <span className="font-body text-sm text-charcoal tabular-nums">{instructor.rating}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="px-5 py-3 font-body text-sm text-charcoal tabular-nums">{instructor.classes}</TableCell>
                                <TableCell className="px-5 py-3 font-display text-base text-sage tabular-nums">{instructor.totalCheckIns}</TableCell>
                                <TableCell className="px-5 py-3 font-display text-base text-charcoal tabular-nums">{instructor.avgAttendance}</TableCell>
                                <TableCell className="px-5 py-3 font-display text-sm text-terracotta tabular-nums whitespace-nowrap">
                                  ₹{(instructor.totalCheckIns * 150).toLocaleString("en-IN")}
                                </TableCell>
                                <TableCell className="px-5 py-3 text-right">
                                  <Button variant="outline" size="sm" className="border-sage/20 text-sage hover:bg-sage/10 font-body h-8">
                                    View
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    <Pagination page={instructorsPerfPg.page} total={instructorsPerfPg.total} onChange={instructorsPerfPg.setPage} />
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Class share donut */}
                <Card className="border-sage/20 bg-white/95 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="font-display text-xl text-charcoal">
                      Class Share
                    </CardTitle>
                    <CardDescription className="font-body text-charcoal/60">
                      Classes taught split by instructor
                    </CardDescription>
                  </CardHeader>
                    <CardContent>
                      {filteredInstructorPerformance.length === 0 || instructorClassTotal === 0 ? (
                        <div className="h-[240px] flex items-center justify-center font-body text-sm text-charcoal/40">
                          No classes yet.
                        </div>
                      ) : (
                        <ChartContainer
                          config={Object.fromEntries(
                            filteredInstructorPerformance.map((i, idx) => [
                              i.name,
                              { label: i.name, color: instructorPieColors[idx % instructorPieColors.length] },
                            ]),
                          )}
                          className="h-[240px] w-full"
                        >
                          <RechartsPieChart>
                            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                            <Pie
                              data={filteredInstructorPerformance.map((i) => ({
                                name: i.name,
                                value: i.classes,
                              }))}
                              dataKey="value"
                              nameKey="name"
                              innerRadius={50}
                              outerRadius={80}
                              strokeWidth={2}
                              stroke="#FFFFFF"
                            >
                              {filteredInstructorPerformance.map((_, idx) => (
                                <Cell key={idx} fill={instructorPieColors[idx % instructorPieColors.length]} />
                              ))}
                              <RechartsLabel
                                position="center"
                                content={({ viewBox }) => {
                                  if (!viewBox || !("cx" in viewBox)) return null;
                                  const cx = viewBox.cx ?? 0;
                                  const cy = viewBox.cy ?? 0;
                                  return (
                                    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                                      <tspan x={cx} y={cy - 4} fill="#333333" fontSize="22" fontWeight="600">{instructorClassTotal}</tspan>
                                      <tspan x={cx} y={cy + 16} fill="#6B6B6B" fontSize="10">classes</tspan>
                                    </text>
                                  );
                                }}
                              />
                            </Pie>
                          </RechartsPieChart>
                        </ChartContainer>
                      )}
                    </CardContent>
                  </Card>

                  {/* Earnings per instructor — horizontal bar */}
                  <Card className="border-sage/20 bg-white/95 backdrop-blur-xl">
                    <CardHeader>
                      <CardTitle className="font-display text-xl text-charcoal">Earnings Leaderboard</CardTitle>
                      <CardDescription className="font-body text-charcoal/60">
                        ₹ payout this month per instructor
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {filteredInstructorPerformance.length === 0 ? (
                        <div className="h-[260px] flex items-center justify-center font-body text-sm text-charcoal/40">
                          No earnings yet.
                        </div>
                      ) : (
                        <ChartContainer
                          config={{ earnings: { label: "Earnings (₹)", color: "#C17856" } }}
                          className="h-[260px] w-full"
                        >
                          <BarChart
                            data={[...filteredInstructorPerformance]
                              .sort((a, b) => b.totalCheckIns - a.totalCheckIns)
                              .slice(0, 8)
                              .map((i) => ({ name: i.name, earnings: i.totalCheckIns * 150 }))}
                            layout="vertical"
                            margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
                          >
                            <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#E5E5E0" />
                            <XAxis
                              type="number"
                              tickLine={false}
                              axisLine={false}
                              tick={{ fontSize: 10, fill: "#6B6B6B" }}
                              tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`}
                            />
                            <YAxis
                              dataKey="name"
                              type="category"
                              tickLine={false}
                              axisLine={false}
                              tick={{ fontSize: 11, fill: "#6B6B6B" }}
                              width={80}
                            />
                            <ChartTooltip
                              cursor={{ fill: "rgba(193,120,86,0.05)" }}
                              content={<ChartTooltipContent formatter={(v) => `₹${Number(v).toLocaleString("en-IN")}`} />}
                            />
                            <Bar dataKey="earnings" fill="var(--color-earnings)" radius={[0, 6, 6, 0]} maxBarSize={20} />
                          </BarChart>
                        </ChartContainer>
                      )}
                    </CardContent>
                  </Card>

                  {/* Avg attendance per instructor */}
                  <Card className="border-sage/20 bg-white/95 backdrop-blur-xl">
                    <CardHeader>
                      <CardTitle className="font-display text-xl text-charcoal">Avg Attendance</CardTitle>
                      <CardDescription className="font-body text-charcoal/60">
                        Members per class on average
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {filteredInstructorPerformance.length === 0 ? (
                        <div className="h-[260px] flex items-center justify-center font-body text-sm text-charcoal/40">
                          No attendance data yet.
                        </div>
                      ) : (
                        <ChartContainer
                          config={{ avgAttendance: { label: "Avg attendance", color: "#8F9779" } }}
                          className="h-[260px] w-full"
                        >
                          <BarChart
                            data={filteredInstructorPerformance.map((i) => ({
                              name: i.name,
                              avgAttendance: i.avgAttendance,
                            }))}
                            margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                          >
                            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E5E5E0" />
                            <XAxis
                              dataKey="name"
                              tickLine={false}
                              axisLine={false}
                              tick={{ fontSize: 10, fill: "#6B6B6B" }}
                              interval={0}
                              angle={-25}
                              textAnchor="end"
                              height={60}
                            />
                            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#6B6B6B" }} width={28} />
                            <ChartTooltip cursor={{ fill: "rgba(143,151,121,0.05)" }} content={<ChartTooltipContent />} />
                            <Bar dataKey="avgAttendance" fill="var(--color-avgAttendance)" radius={[6, 6, 0, 0]} maxBarSize={22} />
                          </BarChart>
                        </ChartContainer>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Check-Ins vs Capacity efficiency */}
                <Card className="border-sage/20 bg-white/95 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="font-display text-xl text-charcoal">Efficiency: Check-Ins vs Classes</CardTitle>
                    <CardDescription className="font-body text-charcoal/60">
                      Higher check-ins-per-class = stronger draw
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {filteredInstructorPerformance.length === 0 ? (
                      <div className="h-[280px] flex items-center justify-center font-body text-sm text-charcoal/40">
                        No data yet.
                      </div>
                    ) : (
                      <ChartContainer
                        config={{
                          classes: { label: "Classes", color: "#A3B18A" },
                          totalCheckIns: { label: "Check-ins", color: "#8F9779" },
                          perClass: { label: "Per class", color: "#C17856" },
                        }}
                        className="h-[280px] w-full"
                      >
                        <ComposedChart
                          data={filteredInstructorPerformance.map((i) => ({
                            name: i.name,
                            classes: i.classes,
                            totalCheckIns: i.totalCheckIns,
                            perClass: i.classes > 0 ? Number((i.totalCheckIns / i.classes).toFixed(1)) : 0,
                          }))}
                          margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E5E5E0" />
                          <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#6B6B6B" }} interval={0} angle={-15} textAnchor="end" height={50} />
                          <YAxis yAxisId="left" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#6B6B6B" }} width={32} />
                          <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#C17856" }} width={32} />
                          <ChartTooltip cursor={{ fill: "rgba(143,151,121,0.05)" }} content={<ChartTooltipContent />} />
                          <ChartLegend content={<ChartLegendContent />} />
                          <Bar yAxisId="left" dataKey="classes" fill="var(--color-classes)" radius={[6, 6, 0, 0]} maxBarSize={22} />
                          <Bar yAxisId="left" dataKey="totalCheckIns" fill="var(--color-totalCheckIns)" radius={[6, 6, 0, 0]} maxBarSize={22} />
                          <Line yAxisId="right" type="monotone" dataKey="perClass" stroke="var(--color-perClass)" strokeWidth={2.5} dot={{ r: 4, fill: "var(--color-perClass)" }} activeDot={{ r: 6 }} />
                        </ComposedChart>
                      </ChartContainer>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* CLASSES TAB */}
              <TabsContent value="classes" className="space-y-6">
                {(() => {
                  const total = classPerformance.length;
                  const avgUtil = total > 0
                    ? Math.round(classPerformance.reduce((s, c) => s + c.utilization, 0) / total)
                    : 0;
                  const totalBookings = classPerformance.reduce((s, c) => s + c.bookings, 0);
                  const underperformingCount = classPerformance.filter((c) => c.utilization < 60).length;
                  const topClass = [...classPerformance].sort((a, b) => b.utilization - a.utilization)[0];
                  return (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                      <MetricCard label="Total Classes" value={total} icon={Calendar} tone="sage" loading={!classesLoaded} />
                      <MetricCard label="Avg Utilization" value={avgUtil} suffix="%" icon={TrendingUp} tone="sage" loading={!classesLoaded} />
                      <MetricCard label="Bookings 30d" value={totalBookings} icon={Users} tone="sage" loading={!classesLoaded} />
                      <MetricCard label="Low Util" value={underperformingCount} icon={AlertTriangle} tone="terracotta" loading={!classesLoaded} hint="Below 60% capacity" />
                      <MetricCard label="Top Class" value={topClass?.name ?? "—"} icon={Star} tone="amber" loading={!classesLoaded} hint={topClass ? `${topClass.utilization}% filled` : ""} />
                    </div>
                  );
                })()}

                {/* Class Performance Table */}
                <Card className="border-sage/20 bg-white/95 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="font-display text-2xl text-charcoal">
                      Class Performance
                    </CardTitle>
                    <CardDescription className="font-body text-charcoal/60">
                      Utilization and bookings per class type
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-xl border border-sage/15 bg-white overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-sage/5 hover:bg-sage/5 border-sage/10">
                            <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3">Class</TableHead>
                            <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3 w-[160px]">Discipline</TableHead>
                            <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3 w-[120px]">Spots</TableHead>
                            <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3 w-[220px]">Utilization</TableHead>
                            <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3 w-[120px]">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {classesPerfPg.pageItems.map((cls) => {
                            const util = cls.utilization;
                            const statusColor =
                              util >= 75 ? "border-sage/30 text-sage bg-sage/5" :
                              util >= 50 ? "border-amber-500/20 text-amber-600 bg-amber-50" :
                              "border-red-500/30 text-red-600 bg-red-50";
                            const barColor =
                              util >= 75 ? "bg-sage" :
                              util >= 50 ? "bg-amber-500" :
                              "bg-red-500";
                            const status = util >= 75 ? "Strong" : util >= 50 ? "Steady" : "Low";
                            return (
                              <TableRow key={cls.name} className="border-sage/10">
                                <TableCell className="px-5 py-3 font-body font-medium text-charcoal">{cls.name}</TableCell>
                                <TableCell className="px-5 py-3">
                                  <Badge variant="outline" className="border-sage/20 text-sage bg-sage/5 font-body whitespace-nowrap">
                                    {cls.discipline}
                                  </Badge>
                                </TableCell>
                                <TableCell className="px-5 py-3 font-body text-sm text-charcoal/70 tabular-nums whitespace-nowrap">
                                  {cls.bookings} / {cls.capacity}
                                </TableCell>
                                <TableCell className="px-5 py-3">
                                  <div className="flex items-center gap-3">
                                    <div className="h-1.5 flex-1 max-w-[160px] rounded-full bg-sage/10 overflow-hidden">
                                      <div className={`h-full transition-all ${barColor}`} style={{ width: `${util}%` }} />
                                    </div>
                                    <span className="font-display text-sm text-charcoal tabular-nums whitespace-nowrap">{util}%</span>
                                  </div>
                                </TableCell>
                                <TableCell className="px-5 py-3">
                                  <Badge variant="outline" className={`font-body whitespace-nowrap ${statusColor}`}>
                                    {status}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    <Pagination page={classesPerfPg.page} total={classesPerfPg.total} onChange={classesPerfPg.setPage} />
                  </CardContent>
                </Card>

                {/* Charts grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Discipline donut */}
                  <Card className="border-sage/20 bg-white/95 backdrop-blur-xl">
                    <CardHeader>
                      <CardTitle className="font-display text-xl text-charcoal">Discipline Split</CardTitle>
                      <CardDescription className="font-body text-charcoal/60">Bookings by category</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {disciplineSplit.length === 0 ? (
                        <div className="h-[240px] flex items-center justify-center font-body text-sm text-charcoal/40">No bookings yet.</div>
                      ) : (
                        <ChartContainer
                          config={Object.fromEntries(
                            disciplineSplit.map((d, idx) => [
                              d.name,
                              { label: d.name, color: instructorPieColors[idx % instructorPieColors.length] },
                            ]),
                          )}
                          className="mx-auto aspect-square max-h-[240px]"
                        >
                          <RechartsPieChart>
                            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                            <Pie
                              data={disciplineSplit.map((d) => ({ name: d.name, value: d.count }))}
                              dataKey="value"
                              nameKey="name"
                              innerRadius={55}
                              outerRadius={85}
                              strokeWidth={2}
                              stroke="#FFFFFF"
                            >
                              {disciplineSplit.map((_, idx) => (
                                <Cell key={idx} fill={instructorPieColors[idx % instructorPieColors.length]} />
                              ))}
                              <RechartsLabel
                                position="center"
                                content={({ viewBox }) => {
                                  if (!viewBox || !("cx" in viewBox)) return null;
                                  const cx = viewBox.cx ?? 0;
                                  const cy = viewBox.cy ?? 0;
                                  const total = disciplineSplit.reduce((s, d) => s + d.count, 0);
                                  return (
                                    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                                      <tspan x={cx} y={cy - 4} fill="#333333" fontSize="22" fontWeight="600">{total}</tspan>
                                      <tspan x={cx} y={cy + 16} fill="#6B6B6B" fontSize="10">bookings</tspan>
                                    </text>
                                  );
                                }}
                              />
                            </Pie>
                          </RechartsPieChart>
                        </ChartContainer>
                      )}
                    </CardContent>
                  </Card>

                  {/* Utilization by class — horizontal bar */}
                  <Card className="border-sage/20 bg-white/95 backdrop-blur-xl lg:col-span-2">
                    <CardHeader>
                      <CardTitle className="font-display text-xl text-charcoal">Utilization Leaderboard</CardTitle>
                      <CardDescription className="font-body text-charcoal/60">
                        Top 10 classes by capacity fill
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {classPerformance.length === 0 ? (
                        <div className="h-[280px] flex items-center justify-center font-body text-sm text-charcoal/40">No class data yet.</div>
                      ) : (
                        <ChartContainer
                          config={{ utilization: { label: "Utilization %", color: "#8F9779" } }}
                          className="h-[280px] w-full"
                        >
                          <BarChart
                            data={[...classPerformance]
                              .sort((a, b) => b.utilization - a.utilization)
                              .slice(0, 10)
                              .map((c) => ({ name: c.name, utilization: c.utilization }))}
                            layout="vertical"
                            margin={{ top: 4, right: 32, left: 0, bottom: 0 }}
                          >
                            <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#E5E5E0" />
                            <XAxis
                              type="number"
                              domain={[0, 100]}
                              tickLine={false}
                              axisLine={false}
                              tick={{ fontSize: 11, fill: "#6B6B6B" }}
                              tickFormatter={(v: number) => `${v}%`}
                            />
                            <YAxis
                              dataKey="name"
                              type="category"
                              tickLine={false}
                              axisLine={false}
                              tick={{ fontSize: 11, fill: "#6B6B6B" }}
                              width={180}
                              interval={0}
                            />
                            <ChartTooltip cursor={{ fill: "rgba(143,151,121,0.05)" }} content={<ChartTooltipContent formatter={(v) => `${v}%`} />} />
                            <Bar dataKey="utilization" fill="var(--color-utilization)" radius={[0, 6, 6, 0]} maxBarSize={20} />
                          </BarChart>
                        </ChartContainer>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Peak Hours Heatmap */}
                <Card className="border-sage/20 bg-white/95 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="font-display text-xl text-charcoal">Peak Hours Heatmap</CardTitle>
                    <CardDescription className="font-body text-charcoal/60">
                      Bookings by time slot × day of week · last 30 days
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {peakHours.max === 0 ? (
                      <div className="h-[240px] flex items-center justify-center font-body text-sm text-charcoal/40">
                        No bookings yet to plot.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="overflow-x-auto">
                          <div
                            className="inline-grid gap-1 min-w-full"
                            style={{ gridTemplateColumns: `auto repeat(${peakHours.days.length}, minmax(56px, 1fr))` }}
                          >
                            {/* header row */}
                            <div />
                            {peakHours.days.map((d) => (
                              <div key={d} className="font-body text-[11px] text-charcoal/50 text-center uppercase tracking-wide pb-1">
                                {d}
                              </div>
                            ))}
                            {/* rows */}
                            {peakHours.slots.map((slot, rIdx) => (
                              <Fragment key={slot}>
                                <div className="font-body text-[11px] text-charcoal/60 pr-3 flex items-center justify-end whitespace-nowrap">
                                  {slot}
                                </div>
                                {peakHours.days.map((day, cIdx) => {
                                  const count = peakHours.grid[rIdx]?.[cIdx] ?? 0;
                                  const intensity = peakHours.max > 0 ? count / peakHours.max : 0;
                                  const opacity = count === 0 ? 0.06 : 0.18 + intensity * 0.82;
                                  return (
                                    <div
                                      key={`${slot}-${day}`}
                                      className="h-10 rounded-md flex items-center justify-center font-body text-xs font-medium transition-all hover:scale-[1.04] hover:shadow-md cursor-default"
                                      style={{
                                        backgroundColor: `rgba(143, 151, 121, ${opacity})`,
                                        color: intensity > 0.55 ? "#FFFFFF" : "#333333",
                                      }}
                                      title={`${day} ${slot}: ${count} bookings`}
                                    >
                                      {count > 0 ? count : ""}
                                    </div>
                                  );
                                })}
                              </Fragment>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <span className="font-body text-[11px] text-charcoal/50">Less</span>
                          {[0.1, 0.3, 0.5, 0.7, 0.95].map((op) => (
                            <div key={op} className="w-5 h-3 rounded-sm" style={{ backgroundColor: `rgba(143,151,121,${op})` }} />
                          ))}
                          <span className="font-body text-[11px] text-charcoal/50">More</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Underperforming Classes alert */}
                {classPerformance.filter((c) => c.utilization < 60).length > 0 && (
                  <Card className="border-red-500/20 bg-gradient-to-br from-red-50 to-white backdrop-blur-xl">
                    <CardHeader>
                      <CardTitle className="font-display text-xl text-charcoal flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                        Needs Attention
                      </CardTitle>
                      <CardDescription className="font-body text-charcoal/60">
                        Classes below 60% capacity — consider rescheduling or promoting
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {classPerformance
                          .filter((c) => c.utilization < 60)
                          .map((cls) => (
                            <div key={cls.name} className="flex items-center gap-2 rounded-full bg-white border border-red-500/20 px-3 py-1.5">
                              <span className="font-body text-sm text-charcoal">{cls.name}</span>
                              <Badge className="bg-red-500/10 text-red-600 border-red-500/20 font-body">
                                {cls.utilization}%
                              </Badge>
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

              </TabsContent>
            </Tabs>

          </div>
        </main>
      </div>

      {/* Add User Dialog */}
      <Dialog open={showAddUserDialog} onOpenChange={setShowAddUserDialog}>
        <DialogContent className="max-w-2xl bg-white/95 backdrop-blur-xl border-sage/20">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-charcoal">Add New User</DialogTitle>
            <DialogDescription className="font-body text-charcoal/60">
              Create a new member account with package and credits
            </DialogDescription>
          </DialogHeader>
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
              <Label htmlFor="credits" className="font-body text-charcoal">Initial Credits</Label>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddUserDialog(false)} className="border-sage/20 font-body">
              Cancel
            </Button>
            <Button className="bg-sage hover:bg-sage/90 text-white font-body">
              <Save className="h-4 w-4 mr-2" />
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={showEditUserDialog} onOpenChange={setShowEditUserDialog}>
        <DialogContent className="max-w-2xl bg-white/95 backdrop-blur-xl border-sage/20">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-charcoal">Edit User</DialogTitle>
            <DialogDescription className="font-body text-charcoal/60">
              Update member information, package, or credits
            </DialogDescription>
          </DialogHeader>
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
                <Label htmlFor="edit-credits" className="font-body text-charcoal">Credits</Label>
                <div className="flex gap-2">
                  <Input id="edit-credits" type="number" defaultValue={selectedUser.credits} className="border-sage/20 focus:ring-sage" />
                  <Button variant="outline" size="sm" className="border-sage/20 text-sage hover:bg-sage/5">
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditUserDialog(false)} className="border-sage/20 font-body">
              Cancel
            </Button>
            <Button className="bg-sage hover:bg-sage/90 text-white font-body">
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Class Dialog */}
      <Dialog open={showAddClassDialog} onOpenChange={setShowAddClassDialog}>
        <DialogContent className="max-w-2xl bg-white/95 backdrop-blur-xl border-sage/20">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-charcoal">Create New Class</DialogTitle>
            <DialogDescription className="font-body text-charcoal/60">
              Schedule a one-time or recurring class
            </DialogDescription>
          </DialogHeader>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddClassDialog(false)} className="border-sage/20 font-body">
              Cancel
            </Button>
            <Button className="bg-sage hover:bg-sage/90 text-white font-body">
              <Save className="h-4 w-4 mr-2" />
              Create Class
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Class Details Dialog */}
      <Dialog open={showClassDetailsDialog} onOpenChange={setShowClassDetailsDialog}>
        <DialogContent className="max-w-3xl bg-white/95 backdrop-blur-xl border-sage/20">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-charcoal">
              {selectedClass?.name} - Class Details
            </DialogTitle>
            <DialogDescription className="font-body text-charcoal/60">
              {selectedClass?.time} with {selectedClass?.instructor}
            </DialogDescription>
          </DialogHeader>
          {selectedClass && (
            <div className="space-y-4 py-4">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="border-sage/20 bg-cream/20">
                  <CardContent className="p-4 text-center">
                    <div className="font-display text-3xl text-sage mb-1">
                      {selectedClass.checkedIn}
                    </div>
                    <div className="font-body text-xs text-charcoal/60">
                      Checked In
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-sage/20 bg-cream/20">
                  <CardContent className="p-4 text-center">
                    <div className="font-display text-3xl text-charcoal mb-1">
                      {selectedClass.enrolled}
                    </div>
                    <div className="font-body text-xs text-charcoal/60">
                      Total Enrolled
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-sage/20 bg-cream/20">
                  <CardContent className="p-4 text-center">
                    <div className="font-display text-3xl text-charcoal/60 mb-1">
                      {selectedClass.capacity}
                    </div>
                    <div className="font-body text-xs text-charcoal/60">
                      Max Capacity
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Attendee List */}
              <div>
                <div className="font-body font-medium text-charcoal mb-3">Enrolled Members</div>
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
                    const outcomeLabel =
                      attendee.checkedIn && outcome === "on_time"
                        ? "On time"
                        : attendee.checkedIn && outcome === "late"
                          ? "Late"
                          : attendee.checkedIn
                            ? "Checked in"
                            : outcome === "no_show"
                              ? "No-show"
                              : "Not checked in";
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
                          <div className="font-body font-medium text-charcoal truncate">
                            {attendee.name}
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
                      <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                        {attendee.checkedIn ? (
                          <Badge className="bg-sage text-white whitespace-nowrap font-body">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            {outcomeLabel}
                          </Badge>
                        ) : outcome === "no_show" ? (
                          <Badge variant="outline" className="border-charcoal/25 text-charcoal/70 whitespace-nowrap font-body">
                            No-show
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-charcoal/20 text-charcoal/60 whitespace-nowrap font-body">
                            Not checked in
                          </Badge>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClassDetailsDialog(false)} className="border-sage/20 font-body">
              Close
            </Button>
            <Button className="bg-sage hover:bg-sage/90 text-white font-body">
              <Download className="h-4 w-4 mr-2" />
              Export Attendance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payout Dialog */}
      <Dialog open={showPayoutDialog} onOpenChange={setShowPayoutDialog}>
        <DialogContent className="max-w-lg bg-white/95 backdrop-blur-xl border-sage/20">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-charcoal">Process Payment</DialogTitle>
            <DialogDescription className="font-body text-charcoal/60">
              Confirm instructor payout details
            </DialogDescription>
          </DialogHeader>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayoutDialog(false)} className="border-sage/20 font-body">
              Cancel
            </Button>
            <Button className="bg-sage hover:bg-sage/90 text-white font-body">
              <DollarSign className="h-4 w-4 mr-2" />
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Instructor Dialog */}
      <Dialog open={showAddInstructorDialog} onOpenChange={setShowAddInstructorDialog}>
        <DialogContent className="max-w-2xl bg-white/95 backdrop-blur-xl border-sage/20">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-charcoal">Add New Instructor</DialogTitle>
            <DialogDescription className="font-body text-charcoal/60">
              Create instructor profile and set payment percentage
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="instructor-name" className="font-body text-charcoal">Full Name</Label>
              <Input id="instructor-name" placeholder="Instructor name" value={newInstructorForm.name} onChange={e => setNewInstructorForm(f => ({ ...f, name: e.target.value }))} className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="instructor-email" className="font-body text-charcoal">Email</Label>
              <Input id="instructor-email" type="email" placeholder="instructor@email.com" value={newInstructorForm.email} onChange={e => setNewInstructorForm(f => ({ ...f, email: e.target.value }))} className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="instructor-phone" className="font-body text-charcoal">Phone Number</Label>
              <Input id="instructor-phone" placeholder="+91 98765 43210" value={newInstructorForm.phone} onChange={e => setNewInstructorForm(f => ({ ...f, phone: e.target.value }))} className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-percentage" className="font-body text-charcoal">Payment Share (%)</Label>
              <Input id="payment-percentage" type="number" placeholder="60" value={newInstructorForm.studio_payout_cut_percent} onChange={e => setNewInstructorForm(f => ({ ...f, studio_payout_cut_percent: e.target.value }))} className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40" />
            </div>
            <div className="col-span-2 space-y-2">
              <Label htmlFor="specialties" className="font-body text-charcoal">Specialties (comma-separated)</Label>
              <Input id="specialties" placeholder="Muay Thai, Warrior Strength" value={newInstructorForm.specialties} onChange={e => setNewInstructorForm(f => ({ ...f, specialties: e.target.value }))} className="border-sage/20 focus:ring-sage placeholder:text-charcoal/40" />
            </div>
            <div className="col-span-2 space-y-2">
              <Label htmlFor="philosophy" className="font-body text-charcoal">Philosophy/Bio</Label>
              <Textarea
                id="philosophy"
                placeholder="Instructor's teaching philosophy and approach..."
                value={newInstructorForm.philosophy}
                onChange={e => setNewInstructorForm(f => ({ ...f, philosophy: e.target.value }))}
                className="border-sage/20 focus:ring-sage"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddInstructorDialog(false)} className="border-sage/20 font-body">
              Cancel
            </Button>
            <Button onClick={handleCreateInstructor} disabled={savingInstructor} className="bg-sage hover:bg-sage/90 text-white font-body">
              <Save className="h-4 w-4 mr-2" />
              {savingInstructor ? "Saving…" : "Create Instructor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Instructor Dialog */}
      <Dialog open={showEditInstructorDialog} onOpenChange={setShowEditInstructorDialog}>
        <DialogContent className="max-w-2xl bg-white/95 backdrop-blur-xl border-sage/20">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-charcoal">Edit Instructor</DialogTitle>
            <DialogDescription className="font-body text-charcoal/60">
              Update instructor profile and payment settings
            </DialogDescription>
          </DialogHeader>
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
                  <Button variant="outline" className="border-sage/20 text-sage hover:bg-sage/5">
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditInstructorDialog(false)} className="border-sage/20 font-body">
              Cancel
            </Button>
            <Button className="bg-sage hover:bg-sage/90 text-white font-body">
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Member Profile Modal */}
      {showMemberProfile && selectedMemberProfile && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-charcoal/60 backdrop-blur-sm" onClick={() => setShowMemberProfile(false)} />
          
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-3xl bg-gradient-to-br from-cream via-white to-cream shadow-2xl overflow-y-auto">
            <div className="sticky top-0 bg-white/95 backdrop-blur-xl border-b border-sage/10 p-6 z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-3xl text-charcoal mb-1">
                    {selectedMemberProfile.name}
                  </h2>
                  <p className="font-body text-sm text-charcoal/60">
                    {selectedMemberProfile.email} • {selectedMemberProfile.phone}
                  </p>
                </div>
                <button
                  onClick={() => setShowMemberProfile(false)}
                  className="w-10 h-10 rounded-full hover:bg-sage/10 flex items-center justify-center transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="border-0 bg-white/80 backdrop-blur-xl shadow-lg">
                  <CardContent className="p-4 text-center">
                    <p className="font-display text-3xl text-sage mb-1">
                      {selectedMemberProfile.totalClasses}
                    </p>
                    <p className="font-body text-xs text-charcoal/60">Total Classes</p>
                  </CardContent>
                </Card>
                <Card className="border-0 bg-white/80 backdrop-blur-xl shadow-lg">
                  <CardContent className="p-4 text-center">
                    <p className="font-display text-3xl text-charcoal mb-1">
                      {selectedMemberProfile.weeklyStreak}
                    </p>
                    <p className="font-body text-xs text-charcoal/60">Week Streak</p>
                  </CardContent>
                </Card>
                <Card className="border-0 bg-white/80 backdrop-blur-xl shadow-lg">
                  <CardContent className="p-4 text-center">
                    <p className="font-display text-3xl text-charcoal mb-1">
                      {selectedMemberProfile.credits}
                    </p>
                    <p className="font-body text-xs text-charcoal/60">Credits Left</p>
                  </CardContent>
                </Card>
              </div>

              {/* Membership Info */}
              <Card className="border-0 bg-white/80 backdrop-blur-xl shadow-lg">
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
                    <span className="font-body text-sm font-medium text-amber-600">
                      In {selectedMemberProfile.expires}
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
              <Card className="border-0 bg-white/80 backdrop-blur-xl shadow-lg">
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
              <Card className="border-0 bg-white/80 backdrop-blur-xl shadow-lg">
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
              <Card className="border-0 bg-white/80 backdrop-blur-xl shadow-lg">
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

              {/* Order History */}
              <Card className="border-0 bg-white/80 backdrop-blur-xl shadow-lg">
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
                <Button className="bg-sage hover:bg-sage/90 text-white font-body h-12">
                  <Zap size={16} className="mr-2" />
                  Send Nudge
                </Button>
                <Button variant="outline" className="border-sage/30 text-charcoal hover:bg-sage/5 font-body h-12">
                  <CreditCard size={16} className="mr-2" />
                  Manage Credits
                </Button>
                <Button variant="outline" className="border-sage/30 text-charcoal hover:bg-sage/5 font-body h-12">
                  <Mail size={16} className="mr-2" />
                  Send Email
                </Button>
                <Button variant="outline" className="border-sage/30 text-charcoal hover:bg-sage/5 font-body h-12">
                  <Edit size={16} className="mr-2" />
                  Edit Profile
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}