import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import { AdminNavigation } from "@/components/AdminNavigation";
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
  /** Today's rosters with check-in details (from dashboard-extras). */
  const [todayClassesDetail, setTodayClassesDetail] = useState<any[]>([]);
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
    })();
    return () => {
      cancelled = true;
    };
  }, [status, session]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const role = (session?.user as { role?: string })?.role;
    if (role !== "admin") return;
    let cancelled = false;
    (async () => {
      const [exRes, payRes] = await Promise.all([
        fetch("/api/admin/dashboard-extras"),
        fetch("/api/admin/instructor-payouts?window=month"),
      ]);
      if (cancelled) return;
      if (exRes.ok) {
        const d = await exRes.json();
        if (cancelled) return;
        if (d.memberStats) setMemberStats(d.memberStats);
        if (Array.isArray(d.classPerformance)) setClassPerformance(d.classPerformance);
        if (Array.isArray(d.disciplineSplit)) setDisciplineSplit(d.disciplineSplit);
        if (Array.isArray(d.instructorPerformance)) setInstructorPerformance(d.instructorPerformance);
        if (Array.isArray(d.transactions)) setTransactions(d.transactions);
        if (Array.isArray(d.memberList)) setMemberList(d.memberList);
        if (Array.isArray(d.expiringMembers)) setExpiringMembers(d.expiringMembers);
        if (Array.isArray(d.instructors)) setDashboardInstructors(d.instructors);
        if (Array.isArray(d.todayClasses)) setTodayClassesDetail(d.todayClasses);
      }
      if (cancelled || !payRes.ok) return;
      const pay = await payRes.json();
      if (cancelled) return;
      const coachPayments = Number(pay.summary?.totalPayouts ?? 0);
      setInstructorPayouts(Array.isArray(pay.instructors) ? pay.instructors : []);
      setFinanceStats((prev) => {
        const totalExpenses = coachPayments + prev.studioExpenses;
        return {
          ...prev,
          coachPayments,
          totalExpenses,
          profit: prev.totalRevenue - totalExpenses,
        };
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [status, session]);

  /** Finance tab: reload ledger after portal checkouts (data is only fetched on mount otherwise). */
  useEffect(() => {
    if (status !== "authenticated") return;
    const role = (session?.user as { role?: string })?.role;
    if (role !== "admin" || activeTab !== "finance") return;
    let cancelled = false;
    void (async () => {
      const exRes = await fetch("/api/admin/dashboard-extras");
      if (cancelled || !exRes.ok) return;
      const d = await exRes.json();
      if (cancelled) return;
      if (Array.isArray(d.transactions)) setTransactions(d.transactions);
    })();
    return () => {
      cancelled = true;
    };
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cream via-cream to-sage/10 flex items-center justify-center">
        <div className="h-12 w-12 border-4 border-sage/20 border-t-sage rounded-full animate-spin" />
      </div>
    );
  }

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

  const activeMemberTierTotal = memberStats.premiumActive + memberStats.specialtyActive;

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
        
        <AdminNavigation />
        
        <main className="md:pl-64 min-h-screen pt-20">
          <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-8">
            
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-display text-4xl md:text-5xl text-charcoal mb-2">
                  Dashboard
                </h1>
                <p className="font-body text-charcoal/60 text-lg">
                  Welcome back, Admin. Here's what's happening today.
                </p>
              </div>
              <div className="flex items-center gap-3">
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
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="bg-white/80 backdrop-blur-xl border border-sage/20 p-1 flex flex-wrap gap-1 h-auto justify-start">
                <TabsTrigger value="overview" className="data-[state=active]:bg-sage data-[state=active]:text-white font-body">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="finance" className="data-[state=active]:bg-sage data-[state=active]:text-white font-body">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Finance
                </TabsTrigger>
                <TabsTrigger value="pricing" className="data-[state=active]:bg-sage data-[state=active]:text-white font-body">
                  <Tag className="h-4 w-4 mr-2" />
                  Pricing
                </TabsTrigger>
                <TabsTrigger value="meal-waitlist" className="data-[state=active]:bg-sage data-[state=active]:text-white font-body">
                  <ChefHat className="h-4 w-4 mr-2" />
                  Meal waitlist
                </TabsTrigger>
                <TabsTrigger value="rental-inquiries" className="data-[state=active]:bg-sage data-[state=active]:text-white font-body">
                  <Building2 className="h-4 w-4 mr-2" />
                  Rentals
                </TabsTrigger>
                <TabsTrigger value="members" className="data-[state=active]:bg-sage data-[state=active]:text-white font-body">
                  <Users className="h-4 w-4 mr-2" />
                  Members
                </TabsTrigger>
                <TabsTrigger value="instructors" className="data-[state=active]:bg-sage data-[state=active]:text-white font-body">
                  <Award className="h-4 w-4 mr-2" />
                  Instructors
                </TabsTrigger>
                <TabsTrigger value="classes" className="data-[state=active]:bg-sage data-[state=active]:text-white font-body">
                  <Target className="h-4 w-4 mr-2" />
                  Classes
                </TabsTrigger>
              </TabsList>

              {/* OVERVIEW TAB */}
              <TabsContent value="overview" className="space-y-6">
                {/* Key Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <Card className="border-sage/20 bg-white/95 backdrop-blur-xl hover:shadow-2xl transition-all duration-600">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="font-body text-sm text-charcoal/60 font-medium">
                          Total Members
                        </CardTitle>
                        <Users className="h-5 w-5 text-sage" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="font-display text-4xl text-charcoal mb-2">
                        {overviewStats.totalMembers}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Badge variant="outline" className="border-sage/20 text-sage bg-sage/5">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          +{overviewMeta.newMembersThisMonth} this month
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-sage/20 bg-white/95 backdrop-blur-xl hover:shadow-2xl transition-all duration-600">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="font-body text-sm text-charcoal/60 font-medium">
                          Active Today
                        </CardTitle>
                        <Flame className="h-5 w-5 text-terracotta" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="font-display text-4xl text-charcoal mb-2">
                        {overviewStats.activeToday}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Badge variant="outline" className="border-terracotta/20 text-terracotta bg-terracotta/5">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          {overviewMeta.classesTodayCount} classes today
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-sage/20 bg-white/95 backdrop-blur-xl hover:shadow-2xl transition-all duration-600">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="font-body text-sm text-charcoal/60 font-medium">
                          Expiring This Week
                        </CardTitle>
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="font-display text-4xl text-charcoal mb-2">
                        {overviewStats.expiringWeek}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="border-amber-500/20 text-amber-600 hover:bg-amber-50 h-7 text-xs font-body"
                        >
                          Send Reminders
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-sage/20 bg-white/95 backdrop-blur-xl hover:shadow-2xl transition-all duration-600">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="font-body text-sm text-charcoal/60 font-medium">
                          Month Revenue
                        </CardTitle>
                        <CreditCard className="h-5 w-5 text-sage" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="font-display text-4xl text-charcoal mb-2">
                        ₹{Math.round(overviewStats.monthRevenue).toLocaleString("en-IN")}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Badge variant="outline" className="border-sage/20 text-sage bg-sage/5">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          +23% vs last month
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-sage/20 bg-white/95 backdrop-blur-xl hover:shadow-2xl transition-all duration-600">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="font-body text-sm text-charcoal/60 font-medium">
                          Café Orders
                        </CardTitle>
                        <Coffee className="h-5 w-5 text-sage" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="font-display text-4xl text-charcoal mb-2">
                        {overviewStats.cafeOrders}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="border-sage/20 text-sage hover:bg-sage/5 h-7 text-xs font-body"
                          onClick={() => router.push("/admin/cafe")}
                        >
                          View Queue
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-sage/20 bg-white/95 backdrop-blur-xl hover:shadow-2xl transition-all duration-600">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="font-body text-sm text-charcoal/60 font-medium">
                          Pending Waivers
                        </CardTitle>
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="font-display text-4xl text-charcoal mb-2">
                        {overviewStats.pendingWaivers}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="border-amber-500/20 text-amber-600 hover:bg-amber-50 h-7 text-xs font-body"
                        >
                          Review Forms
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Upcoming Classes */}
                <Card className="border-sage/20 bg-white/95 backdrop-blur-xl">
                    <CardHeader>
                      <CardTitle className="font-display text-2xl text-charcoal">
                        Today&apos;s schedule
                      </CardTitle>
                      <CardDescription className="font-body text-charcoal/60">
                        {todayClassesDetail.length > 0
                          ? "Tap a class to see who checked in. Check-in opens for members 15 minutes before start."
                          : "Upcoming classes — full roster appears after extras load."}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {(todayClassesDetail.length > 0 ? todayClassesDetail.slice(0, 8) : upcomingClasses.slice(0, 8)).map(
                          (cls: any) => {
                            const hasRoster = Boolean(cls.attendees);
                            const checked = cls.checkedIn ?? 0;
                            const enrolled = cls.enrolled ?? 0;
                            const spotLabel = cls.spots as string | undefined;
                            return (
                          <button
                            type="button"
                            key={String(cls.id)}
                            disabled={!hasRoster}
                            onClick={() => {
                              if (hasRoster) {
                                setSelectedClass(cls);
                                setShowClassDetailsDialog(true);
                              }
                            }}
                            className={`w-full flex items-center justify-between p-4 rounded-xl border border-charcoal/10 transition-all duration-600 text-left ${
                              hasRoster
                                ? "hover:border-sage/30 hover:bg-sage/5 cursor-pointer"
                                : "opacity-90 cursor-default"
                            }`}
                          >
                            <div className="flex-1">
                              <div className="font-body font-medium text-charcoal mb-1">
                                {cls.name}
                              </div>
                              <div className="flex flex-wrap items-center gap-3 text-sm text-charcoal/60">
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" />
                                  {cls.time}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Users className="h-3.5 w-3.5" />
                                  {cls.instructor}
                                </div>
                                {hasRoster && (
                                  <span className="text-sage font-medium">
                                    {checked}/{enrolled} checked in
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              {hasRoster ? (
                                <Badge
                                  variant="outline"
                                  className="border-sage/20 text-sage bg-sage/5"
                                >
                                  Roster
                                </Badge>
                              ) : (
                                <Badge
                                  variant={cls.status === "full" ? "destructive" : "outline"}
                                  className={
                                    cls.status === "full"
                                      ? ""
                                      : "border-sage/20 text-sage bg-sage/5"
                                  }
                                >
                                  {spotLabel ?? ""}
                                </Badge>
                              )}
                            </div>
                          </button>
                            );
                          }
                        )}
                      </div>
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
                      {expiringMembers.map((member) => (
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
                  </CardContent>
                </Card>
              </TabsContent>

              {/* FINANCE TAB */}
              <TabsContent value="finance" className="space-y-6">
                {/* Finance Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <Card className="border-sage/20 bg-white/95 backdrop-blur-xl hover:shadow-2xl transition-all duration-600">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="font-body text-sm text-charcoal/60 font-medium">
                          Total Revenue
                        </CardTitle>
                        <TrendingUp className="h-5 w-5 text-sage" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="font-display text-4xl text-charcoal mb-2">
                        ₹{(financeStats.totalRevenue / 100000).toFixed(1)}L
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Badge variant="outline" className="border-sage/20 text-sage bg-sage/5">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          +{financeStats.growthRate}% growth
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-sage/20 bg-white/95 backdrop-blur-xl hover:shadow-2xl transition-all duration-600">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="font-body text-sm text-charcoal/60 font-medium">
                          Total Expenses
                        </CardTitle>
                        <TrendingDown className="h-5 w-5 text-red-500" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="font-display text-4xl text-charcoal mb-2">
                        ₹{(financeStats.totalExpenses / 100000).toFixed(1)}L
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-body text-xs text-charcoal/50">
                          Coach: ₹{(financeStats.coachPayments / 1000).toFixed(0)}k | Studio: ₹{(financeStats.studioExpenses / 1000).toFixed(0)}k
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-sage/20 bg-gradient-to-br from-sage/5 to-white backdrop-blur-xl hover:shadow-2xl transition-all duration-600">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="font-body text-sm text-charcoal/60 font-medium">
                          Net Profit
                        </CardTitle>
                        <DollarSign className="h-5 w-5 text-sage" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="font-display text-4xl text-sage mb-2">
                        ₹{(financeStats.profit / 100000).toFixed(1)}L
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Badge variant="outline" className="border-sage/20 text-sage bg-sage/5">
                          {financeStats.totalRevenue > 0
                            ? `${((financeStats.profit / financeStats.totalRevenue) * 100).toFixed(0)}% margin`
                            : "—"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
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
                    <div className="space-y-3">
                      {filteredFinanceTransactions.map((txn) => {
                        const openFinance = txn.finance1Tag === true && txn.financeDetail != null;
                        const displayMember = txn.memberFull ?? txn.member ?? txn.instructor ?? "Studio";
                        const plus = txn.memberPlusLabel?.trim() ? ` ${txn.memberPlusLabel.trim()}` : "";

                        const inner = (
                          <>
                            <div className="flex items-center gap-4 flex-1">
                              <div
                                className={`p-3 rounded-lg ${
                                  txn.type === "revenue" ? "bg-sage/10" : "bg-red-50"
                                }`}
                              >
                                {txn.type === "revenue" ? (
                                  <TrendingUp className="h-5 w-5 text-sage" />
                                ) : (
                                  <TrendingDown className="h-5 w-5 text-red-500" />
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="font-body font-medium text-charcoal mb-0.5 flex flex-wrap items-center gap-2">
                                  <span>{txn.category}</span>
                                  {txn.isFinanceDemo ? (
                                    <Badge
                                      variant="outline"
                                      className="border-amber-300 bg-amber-50 text-amber-900 text-[10px] uppercase tracking-wide"
                                    >
                                      Sample
                                    </Badge>
                                  ) : null}
                                </div>
                                <div className="font-body text-sm text-charcoal/60 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                  <span>
                                    <span className="font-medium text-charcoal/80">{displayMember}</span>
                                    {plus ? (
                                      <span className="text-sage font-medium">{plus}</span>
                                    ) : null}
                                  </span>
                                  <span className="text-charcoal/40">•</span>
                                  <span>{txn.date}</span>
                                  {txn.foodOrderedLabel && txn.foodOrderedLabel !== "—" ? (
                                    <>
                                      <span className="text-charcoal/40">•</span>
                                      <span>{txn.foodOrderedLabel}</span>
                                    </>
                                  ) : null}
                                  {openFinance ? (
                                    <>
                                      <span className="text-charcoal/40">•</span>
                                      <span className="text-charcoal/50 italic">Details on click</span>
                                    </>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div
                                className={`font-display text-2xl mb-1 ${
                                  txn.type === "revenue" ? "text-sage" : "text-red-500"
                                }`}
                              >
                                {formatTxnAmountRupee(txn.amount, txn.type)}
                              </div>
                              <Badge variant="outline" className="border-charcoal/10 text-charcoal/60">
                                {txn.method}
                              </Badge>
                            </div>
                          </>
                        );

                        const rowClass =
                          "flex w-full items-center justify-between p-4 rounded-xl border border-charcoal/10 hover:border-sage/30 hover:bg-sage/5 transition-all duration-600";

                        return openFinance ? (
                          <button
                            key={txn.id}
                            type="button"
                            className={`${rowClass} cursor-pointer text-left`}
                            onClick={() => {
                              if (txn.financeDetail)
                                setSelectedFinanceDetail(txn.financeDetail);
                              setFinanceDetailOpen(true);
                            }}
                          >
                            {inner}
                          </button>
                        ) : (
                          <div key={txn.id} className={rowClass}>
                            {inner}
                          </div>
                        );
                      })}
                    </div>
                    
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
                        Monthly Profit/Loss Comparison
                      </CardTitle>
                      <CardDescription className="font-body text-charcoal/60">
                        Revenue vs expenses over the past 6 months
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        {[
                          { month: "October", revenue: 245, expenses: 185, profit: 60 },
                          { month: "September", revenue: 230, expenses: 178, profit: 52 },
                          { month: "August", revenue: 218, expenses: 172, profit: 46 },
                          { month: "July", revenue: 205, expenses: 165, profit: 40 },
                          { month: "June", revenue: 192, expenses: 158, profit: 34 },
                          { month: "May", revenue: 180, expenses: 155, profit: 25 }
                        ].reverse().map((data, idx) => (
                          <div key={idx} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4 text-xs font-body">
                                <div className="flex items-center gap-1">
                                  <div className="w-3 h-3 rounded-full bg-sage" />
                                  <span className="text-charcoal/60">Revenue: ₹{data.revenue}k</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <div className="w-3 h-3 rounded-full bg-red-400" />
                                  <span className="text-charcoal/60">Expenses: ₹{data.expenses}k</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <TrendingUp className="w-3 h-3 text-sage" />
                                  <span className="font-medium text-sage">+₹{data.profit}k</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2 h-8">
                              <div 
                                className="bg-gradient-to-r from-sage to-sage/60 rounded-lg hover:shadow-lg transition-all duration-300 cursor-pointer relative group"
                                style={{ width: `${(data.revenue / 300) * 100}%` }}
                              >
                                <span className="text-xs font-body text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                  ₹{data.revenue}k
                                </span>
                              </div>
                              <div 
                                className="bg-gradient-to-r from-red-400 to-red-300 rounded-lg hover:shadow-lg transition-all duration-300 cursor-pointer relative group"
                                style={{ width: `${(data.expenses / 300) * 100}%` }}
                              >
                                <span className="text-xs font-body text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                  ₹{data.expenses}k
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* PRICING & COUPONS */}
              <TabsContent value="pricing" className="space-y-6">
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

                    <div className="border border-sage/15 rounded-xl overflow-hidden">
                      {couponsLoading ? (
                        <p className="p-6 font-body text-charcoal/60">Loading coupons…</p>
                      ) : coupons.length === 0 ? (
                        <p className="p-6 font-body text-charcoal/60">No coupons yet. Create one on the left.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm font-body">
                            <thead className="bg-cream/50 border-b border-sage/15">
                              <tr>
                                <th className="text-left p-3 font-medium text-charcoal/70">Code</th>
                                <th className="text-left p-3 font-medium text-charcoal/70">Scope</th>
                                <th className="text-left p-3 font-medium text-charcoal/70">Discount</th>
                                <th className="text-left p-3 font-medium text-charcoal/70">Uses</th>
                                <th className="text-left p-3 font-medium text-charcoal/70">Status</th>
                                <th className="text-right p-3 font-medium text-charcoal/70">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {coupons.map((c) => (
                                <tr key={c.id} className="border-b border-sage/10 last:border-0">
                                  <td className="p-3 font-mono font-semibold text-charcoal">{c.code}</td>
                                  <td className="p-3 text-charcoal/80">
                                    {COUPON_CONTEXTS.find((x) => x.value === c.applies_to)?.label ?? c.applies_to}
                                  </td>
                                  <td className="p-3 text-charcoal">
                                    {c.discount_type === "percent"
                                      ? `${c.discount_value}%`
                                      : `₹${c.discount_value}`}
                                  </td>
                                  <td className="p-3 text-charcoal/80">
                                    {c.redemption_count}
                                    {c.max_redemptions != null ? ` / ${c.max_redemptions}` : ""}
                                  </td>
                                  <td className="p-3">
                                    <Badge
                                      className={
                                        c.is_active ? "bg-sage text-white" : "bg-charcoal/20 text-charcoal"
                                      }
                                    >
                                      {c.is_active ? "Active" : "Off"}
                                    </Badge>
                                  </td>
                                  <td className="p-3 text-right space-x-2">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="border-sage/30"
                                      onClick={() => startEditCoupon(c)}
                                    >
                                      Edit
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="border-red-200 text-red-700 hover:bg-red-50"
                                      onClick={() => void deleteCouponById(c.id)}
                                    >
                                      Delete
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* MEAL SUBSCRIPTION WAITLIST */}
              <TabsContent value="meal-waitlist" className="space-y-6">
                <Card className="border-sage/20 bg-white/95 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="font-display text-2xl text-charcoal">Meal subscription waitlist</CardTitle>
                    <CardDescription className="font-body text-charcoal/60">
                      Submissions from the “Join the Waitlist” form on the meal subscription page. Newest first.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {mealInquiriesLoading ? (
                      <p className="font-body text-charcoal/60 py-8">Loading…</p>
                    ) : mealInquiries.length === 0 ? (
                      <p className="font-body text-charcoal/60 py-8">No enquiries yet.</p>
                    ) : (
                      <div className="overflow-x-auto border border-sage/15 rounded-xl">
                        <table className="w-full text-sm font-body">
                          <thead className="bg-cream/50 border-b border-sage/15">
                            <tr>
                              <th className="text-left p-3 font-medium text-charcoal/70">Date</th>
                              <th className="text-left p-3 font-medium text-charcoal/70">Name</th>
                              <th className="text-left p-3 font-medium text-charcoal/70">Email</th>
                              <th className="text-left p-3 font-medium text-charcoal/70">Phone</th>
                              <th className="text-left p-3 font-medium text-charcoal/70 min-w-[200px]">Message</th>
                              <th className="text-left p-3 font-medium text-charcoal/70">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {mealInquiries.map((row) => (
                              <tr key={row.id} className="border-b border-sage/10 last:border-0 align-top">
                                <td className="p-3 text-charcoal/80 whitespace-nowrap">
                                  {new Date(row.created_at).toLocaleString("en-IN", {
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                  })}
                                </td>
                                <td className="p-3 font-medium text-charcoal">{row.full_name}</td>
                                <td className="p-3">
                                  <a
                                    href={`mailto:${row.email}`}
                                    className="text-sage hover:underline break-all"
                                  >
                                    {row.email}
                                  </a>
                                </td>
                                <td className="p-3 whitespace-nowrap">
                                  <a href={`tel:${row.phone}`} className="text-charcoal hover:text-sage">
                                    {row.phone}
                                  </a>
                                </td>
                                <td className="p-3 text-charcoal/80 max-w-md whitespace-pre-wrap">
                                  {row.message?.trim() ? row.message : "—"}
                                </td>
                                <td className="p-3">
                                  <Select
                                    value={row.status}
                                    onValueChange={(v) => void updateMealInquiryStatus(row.id, v)}
                                  >
                                    <SelectTrigger className="w-[140px] border-sage/20 h-9 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="new">New</SelectItem>
                                      <SelectItem value="contacted">Contacted</SelectItem>
                                      <SelectItem value="closed">Closed</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="rental-inquiries" className="space-y-6">
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
                      <p className="font-body text-charcoal/60 py-8">No inquiries yet.</p>
                    ) : (
                      <div className="overflow-x-auto border border-sage/15 rounded-xl">
                        <table className="w-full text-sm font-body">
                          <thead className="bg-cream/50 border-b border-sage/15">
                            <tr>
                              <th className="text-left p-3 font-medium text-charcoal/70">Date</th>
                              <th className="text-left p-3 font-medium text-charcoal/70">Name</th>
                              <th className="text-left p-3 font-medium text-charcoal/70">Email</th>
                              <th className="text-left p-3 font-medium text-charcoal/70">Phone</th>
                              <th className="text-left p-3 font-medium text-charcoal/70">Event</th>
                              <th className="text-left p-3 font-medium text-charcoal/70">Date / guests</th>
                              <th className="text-left p-3 font-medium text-charcoal/70 min-w-[180px]">Notes</th>
                              <th className="text-left p-3 font-medium text-charcoal/70">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rentalInquiries.map((row) => (
                              <tr key={row.id} className="border-b border-sage/10 last:border-0 align-top">
                                <td className="p-3 text-charcoal/80 whitespace-nowrap">
                                  {new Date(row.created_at).toLocaleString("en-IN", {
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                  })}
                                </td>
                                <td className="p-3 font-medium text-charcoal">{row.name}</td>
                                <td className="p-3">
                                  <a href={`mailto:${row.email}`} className="text-sage hover:underline break-all">
                                    {row.email}
                                  </a>
                                </td>
                                <td className="p-3 whitespace-nowrap">
                                  <a href={`tel:${row.phone}`} className="text-charcoal hover:text-sage">
                                    {row.phone}
                                  </a>
                                </td>
                                <td className="p-3 text-charcoal/80 max-w-[140px]">
                                  {row.event_type?.trim() ? row.event_type : "—"}
                                </td>
                                <td className="p-3 text-charcoal/80 whitespace-nowrap">
                                  <div>{row.event_date?.trim() ? row.event_date : "—"}</div>
                                  <div className="text-charcoal/50 text-xs">
                                    {row.guest_count?.trim() ? `${row.guest_count} guests` : ""}
                                    {row.duration?.trim() ? ` · ${row.duration}` : ""}
                                  </div>
                                </td>
                                <td className="p-3 text-charcoal/80 max-w-md whitespace-pre-wrap">
                                  {row.message?.trim() ? row.message : "—"}
                                </td>
                                <td className="p-3 capitalize text-charcoal/80">{row.status}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* MEMBERS TAB */}
              <TabsContent value="members" className="space-y-6">
                {/* Member Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card className="border-sage/20 bg-white/95 backdrop-blur-xl hover:shadow-2xl transition-all duration-600">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="font-body text-sm text-charcoal/60 font-medium">
                          On-Time Check-Ins
                        </CardTitle>
                        <UserCheck className="h-5 w-5 text-sage" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="font-display text-4xl text-charcoal mb-2">
                        {memberStats.onTimeCheckIns}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Badge variant="outline" className="border-sage/20 text-sage bg-sage/5">
                          {memberStats.checkInSample > 0
                            ? `${memberStats.onTimeCheckInPct}% of ${memberStats.checkInSample} check-ins`
                            : "No recent check-ins"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-sage/20 bg-white/95 backdrop-blur-xl hover:shadow-2xl transition-all duration-600">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="font-body text-sm text-charcoal/60 font-medium">
                          Late Check-Ins
                        </CardTitle>
                        <Clock className="h-5 w-5 text-amber-500" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="font-display text-4xl text-charcoal mb-2">
                        {memberStats.lateCheckIns}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Badge variant="outline" className="border-amber-500/20 text-amber-600 bg-amber-50">
                          {memberStats.checkInSample > 0
                            ? `${memberStats.lateCheckInPct}% late (after start)`
                            : "No recent check-ins"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-sage/20 bg-white/95 backdrop-blur-xl hover:shadow-2xl transition-all duration-600">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="font-body text-sm text-charcoal/60 font-medium">
                          No-Shows
                        </CardTitle>
                        <UserX className="h-5 w-5 text-red-500" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="font-display text-4xl text-charcoal mb-2">
                        {memberStats.noShows}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="border-amber-500/20 text-amber-600 hover:bg-amber-50 h-7 text-xs font-body"
                        >
                          Send to CRM
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-sage/20 bg-white/95 backdrop-blur-xl hover:shadow-2xl transition-all duration-600">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="font-body text-sm text-charcoal/60 font-medium">
                          Inactive Members
                        </CardTitle>
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="font-display text-4xl text-charcoal mb-2">
                        {memberStats.inactiveUsers}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="border-amber-500/20 text-amber-600 hover:bg-amber-50 h-7 text-xs font-body"
                        >
                          Send to CRM
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
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
                      <div className="space-y-4">
                        <div className="h-48 flex items-end justify-between gap-2">
                          {[8, 12, 10, 15, 13, 18, 16, 21, 19, 24, 22, 28].map((value, idx) => (
                            <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                              <div 
                                className="w-full bg-gradient-to-t from-sage to-sage/40 rounded-t-sm hover:from-sage/90 hover:to-sage/60 transition-all duration-300 cursor-pointer relative group"
                                style={{ height: `${(value / 28) * 100}%` }}
                              >
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-charcoal text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                  {value} new
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center justify-between text-xs text-charcoal/50 font-body">
                          <span>Jan</span>
                          <span>Dec</span>
                        </div>
                      </div>
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
                      <div className="flex items-center justify-center py-8">
                        <div className="relative w-40 h-40">
                          <svg viewBox="0 0 100 100" className="transform -rotate-90">
                            {/* Active - 88% */}
                            <circle
                              cx="50"
                              cy="50"
                              r="40"
                              fill="transparent"
                              stroke="#8F9779"
                              strokeWidth="20"
                              strokeDasharray="220 251"
                            />
                            {/* Inactive - 12% */}
                            <circle
                              cx="50"
                              cy="50"
                              r="40"
                              fill="transparent"
                              stroke="#D1D5DB"
                              strokeWidth="20"
                              strokeDasharray="30 221"
                              strokeDashoffset="-220"
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <div className="font-display text-3xl text-charcoal">88%</div>
                            <div className="font-body text-xs text-charcoal/60">Active</div>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 rounded-lg bg-sage/5 border border-sage/20">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-2 h-2 rounded-full bg-sage" />
                            <span className="font-body text-xs text-charcoal/60">Active</span>
                          </div>
                          <div className="font-display text-2xl text-sage">112</div>
                        </div>
                        <div className="p-3 rounded-lg bg-charcoal/5 border border-charcoal/20">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-2 h-2 rounded-full bg-charcoal/40" />
                            <span className="font-body text-xs text-charcoal/60">Inactive</span>
                          </div>
                          <div className="font-display text-2xl text-charcoal">15</div>
                        </div>
                      </div>
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
                      <div className="space-y-3">
                        {[
                          { range: "1-2 weeks", count: 45, percentage: 35 },
                          { range: "3-4 weeks", count: 38, percentage: 30 },
                          { range: "5-8 weeks", count: 28, percentage: 22 },
                          { range: "9-12 weeks", count: 12, percentage: 9 },
                          { range: "13+ weeks", count: 5, percentage: 4 }
                        ].map((data, idx) => (
                          <div key={idx} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-body text-charcoal/60">{data.range}</span>
                              <span className="font-body font-medium text-charcoal">{data.count} members</span>
                            </div>
                            <div className="h-8 bg-charcoal/5 rounded-lg overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-sage to-sage/60 rounded-lg flex items-center justify-end pr-3 hover:shadow-lg transition-all duration-300"
                                style={{ width: `${data.percentage}%` }}
                              >
                                <span className="text-xs font-body text-white font-medium">{data.percentage}%</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
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
                            <span className="font-body text-charcoal/60">{memberStats.premiumActive} members</span>
                          </div>
                          <span className="font-body font-medium text-charcoal">
                            {activeMemberTierTotal > 0
                              ? ((memberStats.premiumActive / activeMemberTierTotal) * 100).toFixed(0)
                              : "0"}
                            %
                          </span>
                        </div>
                        <Progress
                          value={
                            activeMemberTierTotal > 0
                              ? (memberStats.premiumActive / activeMemberTierTotal) * 100
                              : 0
                          }
                          className="h-3 bg-sage/10"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="border-terracotta/20 text-terracotta">Specialty</Badge>
                            <span className="font-body text-charcoal/60">{memberStats.specialtyActive} members</span>
                          </div>
                          <span className="font-body font-medium text-charcoal">
                            {activeMemberTierTotal > 0
                              ? ((memberStats.specialtyActive / activeMemberTierTotal) * 100).toFixed(0)
                              : "0"}
                            %
                          </span>
                        </div>
                        <Progress
                          value={
                            activeMemberTierTotal > 0
                              ? (memberStats.specialtyActive / activeMemberTierTotal) * 100
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
                    <div className="space-y-3">
                      {filteredMemberList.map((member) => (
                        <div 
                          key={`${member.profileId ?? "p"}-${member.id}`}
                          className="flex items-center justify-between p-4 rounded-xl border border-charcoal/10 hover:border-sage/30 hover:bg-sage/5 transition-all duration-600"
                        >
                          <div className="flex items-center gap-4 flex-1">
                            <div className="h-12 w-12 rounded-full bg-sage/10 flex items-center justify-center">
                              <span className="font-display text-lg text-sage">
                                {String(member.name ?? "?")
                                  .split(" ")
                                  .map((n: string) => n[0])
                                  .join("")}
                              </span>
                            </div>
                            <div>
                              <div className="font-body font-medium text-charcoal mb-0.5">
                                {member.name}
                              </div>
                              <div className="flex items-center gap-3 text-sm text-charcoal/60">
                                <Badge variant="outline" className="border-sage/20 text-sage bg-sage/5">
                                  {member.package}
                                </Badge>
                                <span>{member.credits} credits</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-center">
                              <div className="font-display text-2xl text-sage mb-1">
                                {member.streak}
                              </div>
                              <div className="font-body text-xs text-charcoal/50">
                                Streak
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="font-display text-2xl text-charcoal mb-1">
                                {member.onTime}
                              </div>
                              <div className="font-body text-xs text-charcoal/50">
                                On Time
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="font-display text-2xl text-amber-500 mb-1">
                                {member.late}
                              </div>
                              <div className="font-body text-xs text-charcoal/50">
                                Late
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="font-display text-2xl text-red-500 mb-1">
                                {member.noShow}
                              </div>
                              <div className="font-body text-xs text-charcoal/50">
                                No Show
                              </div>
                            </div>
                            <Button variant="outline" size="sm" className="border-sage/20 text-sage hover:bg-sage/5 font-body">
                              View
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* INSTRUCTORS TAB */}
              <TabsContent value="instructors" className="space-y-6">
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
                    <div className="space-y-4">
                      {filteredInstructorPerformance.map((instructor, index) => (
                        <div 
                          key={instructor.name}
                          className="flex items-center justify-between p-5 rounded-xl border border-charcoal/10 hover:border-sage/30 hover:bg-sage/5 transition-all duration-600"
                        >
                          <div className="flex items-center gap-4 flex-1">
                            <div className="h-14 w-14 rounded-full bg-sage/10 flex items-center justify-center">
                              <span className="font-display text-2xl text-sage">
                                #{index + 1}
                              </span>
                            </div>
                            <div>
                              <div className="font-display text-xl text-charcoal mb-1">
                                {instructor.name}
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1">
                                  <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                                  <span className="font-body text-sm text-charcoal/60">{instructor.rating}</span>
                                </div>
                                <span className="font-body text-sm text-charcoal/60">•</span>
                                <span className="font-body text-sm text-charcoal/60">{instructor.classes} classes</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-8">
                            <div className="text-center">
                              <div className="font-display text-3xl text-sage mb-1">
                                {instructor.totalCheckIns}
                              </div>
                              <div className="font-body text-xs text-charcoal/50">
                                Total Check-Ins
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="font-display text-3xl text-charcoal mb-1">
                                {instructor.avgAttendance}
                              </div>
                              <div className="font-body text-xs text-charcoal/50">
                                Avg Attendance
                              </div>
                            </div>
                            <Button className="bg-sage hover:bg-sage/90 text-white font-body">
                              View Details
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Pay Calculation Summary */}
                <Card className="border-sage/20 bg-gradient-to-br from-sage/5 to-white backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="font-display text-2xl text-charcoal">
                      Pay Calculation Summary
                    </CardTitle>
                    <CardDescription className="font-body text-charcoal/60">
                      Based on total check-ins per instructor
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredInstructorPerformance.map((instructor) => (
                        <div 
                          key={instructor.name}
                          className="p-4 rounded-xl bg-white border border-sage/20"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="font-body font-medium text-charcoal">
                              {instructor.name}
                            </div>
                            <Badge className="bg-sage text-white">
                              {instructor.totalCheckIns} check-ins
                            </Badge>
                          </div>
                          <div className="font-display text-3xl text-sage">
                            ₹{(instructor.totalCheckIns * 150).toLocaleString()}
                          </div>
                          <div className="font-body text-xs text-charcoal/50 mt-1">
                            @ ₹150 per check-in
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Instructor Analytics Graphs */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Instructor Performance Comparison */}
                  <Card className="border-sage/20 bg-white/95 backdrop-blur-xl lg:col-span-2">
                    <CardHeader>
                      <CardTitle className="font-display text-xl text-charcoal">
                        Instructor Performance Comparison
                      </CardTitle>
                      <CardDescription className="font-body text-charcoal/60">
                        Total check-ins per instructor this month
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {filteredInstructorPerformance.map((instructor, idx) => (
                          <div key={idx} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-sage/10 flex items-center justify-center">
                                  <span className="font-body text-2xl text-sage">
                                    #{idx + 1}
                                  </span>
                                </div>
                                <div>
                                  <div className="font-body font-medium text-charcoal">
                                    {instructor.name}
                                  </div>
                                  <div className="font-body text-xs text-charcoal/50">{instructor.classes} classes</div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-display text-2xl text-sage">{instructor.totalCheckIns}</div>
                                <div className="font-body text-xs text-charcoal/50">check-ins</div>
                              </div>
                            </div>
                            <div className="h-3 bg-charcoal/5 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-sage to-sage/60 rounded-full hover:shadow-lg transition-all duration-300"
                                style={{ width: `${(instructor.totalCheckIns / maxInstructorCheckIns) * 100}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Class Distribution by Instructor */}
                  <Card className="border-sage/20 bg-white/95 backdrop-blur-xl">
                    <CardHeader>
                      <CardTitle className="font-display text-xl text-charcoal">
                        Classes Taught
                      </CardTitle>
                      <CardDescription className="font-body text-charcoal/60">
                        Total classes per instructor
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {filteredInstructorPerformance.map((inst, idx) => {
                          const pct =
                            instructorClassTotal > 0
                              ? Math.round((inst.classes / instructorClassTotal) * 100)
                              : 0;
                          return (
                            <div
                              key={inst.name}
                              className="flex items-center justify-between p-2 rounded hover:bg-sage/5"
                            >
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{
                                    backgroundColor: instructorPieColors[idx % instructorPieColors.length],
                                  }}
                                />
                                <span className="font-body text-sm">{inst.name}</span>
                              </div>
                              <span className="font-body text-sm font-medium">
                                {inst.classes} ({pct}%)
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Earnings Breakdown */}
                  <Card className="border-sage/20 bg-white/95 backdrop-blur-xl">
                    <CardHeader>
                      <CardTitle className="font-display text-xl text-charcoal">
                        Monthly Earnings
                      </CardTitle>
                      <CardDescription className="font-body text-charcoal/60">
                        Total compensation per instructor
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {filteredInstructorPerformance.map((instructor, idx) => {
                          const earnings = instructor.totalCheckIns * 150;
                          return (
                            <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-sage/10 hover:border-sage/30 hover:bg-sage/5 transition-all">
                              <div className="font-body text-sm text-charcoal">{instructor.name}</div>
                              <div className="text-right">
                                <div className="font-display text-lg text-sage">₹{(earnings / 1000).toFixed(1)}k</div>
                                <div className="w-24 h-1.5 bg-charcoal/5 rounded-full mt-1 overflow-hidden">
                                  <div 
                                    className="h-full bg-sage rounded-full"
                                    style={{
                                      width: `${maxInstructorEarnings > 0 ? (earnings / maxInstructorEarnings) * 100 : 0}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* CLASSES TAB */}
              <TabsContent value="classes" className="space-y-6">
                {/* Class Performance */}
                <Card className="border-sage/20 bg-white/95 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="font-display text-2xl text-charcoal">
                      Class Performance Overview
                    </CardTitle>
                    <CardDescription className="font-body text-charcoal/60">
                      Utilization and popularity metrics
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {classPerformance.map((cls) => (
                        <div 
                          key={cls.name}
                          className="p-4 rounded-xl border border-charcoal/10 hover:border-sage/30 hover:bg-sage/5 transition-all duration-600"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <div className="font-body font-medium text-charcoal mb-1">
                                {cls.name}
                              </div>
                              <Badge variant="outline" className="border-sage/20 text-sage bg-sage/5">
                                {cls.discipline}
                              </Badge>
                            </div>
                            <div className="text-right">
                              <div className="font-display text-2xl text-charcoal mb-1">
                                {cls.utilization}%
                              </div>
                              <div className="font-body text-xs text-charcoal/50">
                                {cls.bookings} / {cls.capacity} spots
                              </div>
                            </div>
                          </div>
                          <Progress 
                            value={cls.utilization} 
                            className={`h-2 ${
                              cls.utilization >= 75 ? "bg-sage/10" :
                              cls.utilization >= 50 ? "bg-amber-500/10" :
                              "bg-red-500/10"
                            }`}
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Underperforming Classes */}
                <Card className="border-red-500/20 bg-gradient-to-br from-red-50 to-white backdrop-blur-xl">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="font-display text-2xl text-charcoal flex items-center gap-2">
                          <AlertTriangle className="h-6 w-6 text-red-500" />
                          Underperforming Classes
                        </CardTitle>
                        <CardDescription className="font-body text-charcoal/60 mt-1">
                          Classes below 60% capacity utilization
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {classPerformance.filter(c => c.utilization < 60).map((cls) => (
                        <div 
                          key={cls.name}
                          className="flex items-center justify-between p-4 rounded-xl border border-red-500/20 bg-white hover:shadow-md transition-all duration-600"
                        >
                          <div className="flex-1">
                            <div className="font-body font-medium text-charcoal mb-1">
                              {cls.name}
                            </div>
                            <div className="font-body text-sm text-charcoal/60">
                              Only {cls.bookings} out of {cls.capacity} spots filled
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="font-display text-2xl text-red-500 mb-1">
                                {cls.utilization}%
                              </div>
                              <div className="font-body text-xs text-charcoal/50">
                                Utilization
                              </div>
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="border-red-500/20 text-red-600 hover:bg-red-50 font-body"
                            >
                              Boost
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Discipline Split */}
                <Card className="border-sage/20 bg-white/95 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="font-display text-2xl text-charcoal">
                      Discipline Split
                    </CardTitle>
                    <CardDescription className="font-body text-charcoal/60">
                      Class bookings by discipline category
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {disciplineSplit.map((discipline) => (
                        <div key={discipline.name}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg bg-sage/10 flex items-center justify-center">
                                <Activity className="h-5 w-5 text-sage" />
                              </div>
                              <div>
                                <div className="font-body font-medium text-charcoal">
                                  {discipline.name}
                                </div>
                                <div className="font-body text-xs text-charcoal/50">
                                  {discipline.count} bookings
                                </div>
                              </div>
                            </div>
                            <div className="font-display text-2xl text-charcoal">
                              {discipline.percentage}%
                            </div>
                          </div>
                          <Progress value={discipline.percentage} className="h-3 bg-sage/10" />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Class Analytics Graphs */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Peak Hours Heatmap */}
                  <Card className="border-sage/20 bg-white/95 backdrop-blur-xl lg:col-span-2">
                    <CardHeader>
                      <CardTitle className="font-display text-xl text-charcoal">
                        Peak Hours Analysis
                      </CardTitle>
                      <CardDescription className="font-body text-charcoal/60">
                        Class popularity by time of day
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-6 gap-3">
                        {[
                          { time: "6-8 AM", bookings: 145, percentage: 95 },
                          { time: "8-10 AM", bookings: 98, percentage: 64 },
                          { time: "10-12 PM", bookings: 56, percentage: 37 },
                          { time: "12-2 PM", bookings: 42, percentage: 28 },
                          { time: "5-7 PM", bookings: 168, percentage: 100 },
                          { time: "7-9 PM", bookings: 134, percentage: 80 }
                        ].map((slot, idx) => (
                          <div key={idx} className="space-y-2">
                            <div 
                              className="h-32 rounded-lg flex flex-col items-center justify-end p-3 transition-all duration-300 hover:shadow-lg cursor-pointer relative group"
                              style={{ 
                                backgroundColor: `rgba(143, 151, 121, ${slot.percentage / 100})`,
                              }}
                            >
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="bg-charcoal text-white text-xs px-2 py-1 rounded">
                                  {slot.bookings} bookings
                                </div>
                              </div>
                              <div className="font-display text-xl text-white">{slot.percentage}%</div>
                            </div>
                            <div className="text-center font-body text-xs text-charcoal/60">{slot.time}</div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-6 flex items-center justify-center gap-6">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-3 rounded" style={{ backgroundColor: 'rgba(143, 151, 121, 0.3)' }} />
                          <span className="font-body text-xs text-charcoal/60">Low</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-3 rounded" style={{ backgroundColor: 'rgba(143, 151, 121, 0.6)' }} />
                          <span className="font-body text-xs text-charcoal/60">Medium</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-3 rounded bg-sage" />
                          <span className="font-body text-xs text-charcoal/60">High</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Occupancy Trend */}
                  <Card className="border-sage/20 bg-white/95 backdrop-blur-xl lg:col-span-2">
                    <CardHeader>
                      <CardTitle className="font-display text-xl text-charcoal">
                        Weekly Occupancy Trend
                      </CardTitle>
                      <CardDescription className="font-body text-charcoal/60">
                        Average class occupancy over the past 4 weeks
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="h-64 flex items-end justify-between gap-3">
                          {[
                            { day: "Mon", weeks: [72, 75, 78, 82] },
                            { day: "Tue", weeks: [68, 71, 74, 76] },
                            { day: "Wed", weeks: [75, 78, 81, 85] },
                            { day: "Thu", weeks: [65, 68, 70, 73] },
                            { day: "Fri", weeks: [80, 83, 86, 89] },
                            { day: "Sat", weeks: [88, 90, 92, 95] },
                            { day: "Sun", weeks: [62, 65, 67, 70] }
                          ].map((day, dayIdx) => (
                            <div key={dayIdx} className="flex-1 flex flex-col items-center gap-2">
                              <div className="w-full flex items-end justify-center gap-0.5 h-full">
                                {day.weeks.map((occupancy, weekIdx) => (
                                  <div 
                                    key={weekIdx}
                                    className={`flex-1 rounded-t transition-all duration-300 hover:opacity-80 cursor-pointer relative group ${
                                      weekIdx === 0 ? 'bg-sage/30' :
                                      weekIdx === 1 ? 'bg-sage/50' :
                                      weekIdx === 2 ? 'bg-sage/70' :
                                      'bg-sage'
                                    }`}
                                    style={{ height: `${occupancy}%` }}
                                  >
                                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-charcoal text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                      {occupancy}%
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <div className="font-body text-xs text-charcoal/60 font-medium">{day.day}</div>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center justify-center gap-6 pt-4 border-t border-sage/20">
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-sage/30" />
                            <span className="font-body text-xs text-charcoal/60">Week 1</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-sage/50" />
                            <span className="font-body text-xs text-charcoal/60">Week 2</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-sage/70" />
                            <span className="font-body text-xs text-charcoal/60">Week 3</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-sage" />
                            <span className="font-body text-xs text-charcoal/60">Week 4 (Current)</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
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
                <div className="font-body font-medium text-charcoal mb-3">Enrolled Members:</div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {(selectedClass.attendees ?? []).map((attendee: any) => {
                    const initials = (attendee.name || "M")
                      .split(" ")
                      .filter(Boolean)
                      .map((n: string) => n[0])
                      .join("")
                      .slice(0, 3);
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
                    <div key={attendee.id} className="flex items-center justify-between p-3 rounded-lg border border-sage/20 bg-white">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 shrink-0 rounded-full bg-sage/10 flex items-center justify-center">
                          <span className="font-body text-sm text-sage">
                            {initials || "—"}
                          </span>
                        </div>
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
                          <Badge className="bg-sage text-white">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            {outcomeLabel}
                          </Badge>
                        ) : outcome === "no_show" ? (
                          <Badge variant="outline" className="border-charcoal/25 text-charcoal/70">
                            No-show
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-charcoal/20 text-charcoal/60">
                            Not checked in
                          </Badge>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
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