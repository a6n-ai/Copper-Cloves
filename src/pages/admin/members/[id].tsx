import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import {
  Mail,
  Phone,
  MessageCircle,
  Calendar,
  CreditCard,
  Trophy,
  Flame,
  UserX,
  ArrowLeft,
  ReceiptText,
  Pause,
  Play,
  Cake,
  Pencil,
  User as UserIcon,
  Banknote,
  Coffee,
  Ticket,
  Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";
import { requireSessionSSP } from "@/lib/requireSessionSSP";
import { passCategoryForPackageType } from "@/lib/couponHelpers";
import {
  passIsActive,
  derivePassStatus,
  byExpirySoonestFirst,
  type PassStatus,
} from "@/lib/passStatus";
import { SEO } from "@/components/SEO";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { PassCard } from "@/components/dashboard/PassCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { paymentMethodPill, ticketStatusPill, bookingStatusPill, bookingPaymentPill, memberStatusPill } from "@/lib/pillMaps";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/filters";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/responsive/ResponsiveDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ListAvatar } from "@/components/admin/ListAvatar";
import {
  usePassPaymentState,
  PassConfigSection,
  PaymentSection,
  validateConfig,
  validatePayment,
  applyPassConfig,
  persistStartDate,
  recordPayment,
  passSummary,
  priceBreakdown,
  formatINR,
  selectedPackageOf,
  PAYMENT_METHODS,
  type PassMemberContext,
  type PackageRow as CatalogPackageRow,
} from "@/components/admin/managePass";
import { computeUpgradeDifferencePaise } from "@/lib/passAdjust";
import { toast } from "sonner";

export const getServerSideProps = requireSessionSSP({ roles: ["admin"] });

/* ──────────────────────────  Types  ────────────────────────── */

type PassCategory = "studio_pass" | "class_pass" | "none";

interface PackageRow {
  id: string;
  name: string;
  purchasedAt: string | null;
  expiresAt: string | null;
  creditsRemaining: number | null;
  isActive: boolean;
  isUnlimited: boolean;
  isPaused: boolean;
  passType: string | null;
  durationMonths: number | null;
  status: PassStatus;
  /** Package-type list price in rupees (INR), for computing upgrade price differences. */
  price: number | null;
  /** Package-type id of the pass currently held — used to filter upgrade targets. */
  packageTypeId: string | null;
}
interface BookingRow {
  id: string;
  name: string;
  when: number | null;
  status: "attended" | "no_show" | "missed" | "upcoming";
  lifecycle: string;
  checkedIn: boolean;
  checkInOutcome: string | null;
  invoiceAvailable: boolean;
}
interface FoodRow {
  id: string;
  item: string;
  quantity: number;
  orderedAt: string | null;
  status: string;
}
interface BadgeRow {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  earnedAt: string | null;
}
interface PaymentRow {
  id: string;
  method: string;
  amountPaise: number;
  status: string;
  reference: string | null;
  proofUrl: string | null;
  createdAt: string | null;
  recordedBy: string | null;
}
interface TicketRow {
  id: string;
  type: string;
  reason: string;
  status: string;
  createdAt: string | null;
  pauseFrom: string | null;
  pauseTo: string | null;
}
interface MemberDetail {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  whatsappPhone: string | null;
  avatarUrl: string | null;
  dob: string | null;
  gender: string | null;
  startDate: string | null;
  createdAt: string | null;
  passCategory: PassCategory;
  unlimited: boolean;
  credits: number;
  expiry: string | null;
  activePackageId: string | null;
  activePaused: boolean;
  stats: { totalClasses: number; currentStreak: number; longestStreak: number; lastClassDate: string | null };
  packages: PackageRow[];
  bookings: BookingRow[];
  food: FoodRow[];
  badges: BadgeRow[];
  payments: PaymentRow[];
  tickets: TicketRow[];
}

/* ──────────────────────────  Helpers  ────────────────────────── */

function rupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
function fmtDate(d: string | number | null | undefined): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function fmtDateTime(d: string | number | null | undefined): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

/* maps the raw `/api/admin/members?id=` payload into the page's view model */
function mapDetail(data: Record<string, unknown>): MemberDetail {
  const now = Date.now();
  const pkgsRaw = Array.isArray(data.user_packages) ? (data.user_packages as Array<Record<string, unknown>>) : [];
  const packages: PackageRow[] = pkgsRaw.map((p) => {
    const pt = (p.package_type ?? null) as { id?: string; name?: string; is_unlimited?: boolean; duration_months?: number | null; price?: number | string | null } | null;
    const exp = p.expiration_date ? String(p.expiration_date) : null;
    const isUnlimited = !!pt?.is_unlimited;
    const creditsRemaining = typeof p.credits_remaining === "number" ? p.credits_remaining : null;
    const isPaused = !!p.is_paused;
    // Live = enabled AND not expired AND still has credit (unlimited never depletes) —
    // matches the member portal; a used-up 0-credit pass is no longer "active".
    const isActive = passIsActive({ isEnabled: !!p.is_active, isUnlimited, creditsRemaining, expiry: exp, now });
    return {
      id: String(p.id),
      name: pt?.name ?? "Package",
      purchasedAt: p.purchase_date ? String(p.purchase_date) : null,
      expiresAt: exp,
      creditsRemaining,
      isActive,
      isUnlimited,
      isPaused,
      passType: p.pass_type ? String(p.pass_type) : null,
      durationMonths: typeof pt?.duration_months === "number" ? pt.duration_months : null,
      status: derivePassStatus(isActive, isPaused, exp, now),
      price: pt?.price == null ? null : Number(pt.price),
      packageTypeId: pt?.id ?? null,
    };
  });
  // Active passes expiring-soonest first (booking-spend order); expired/used-up
  // after, newest purchase first. The soonest-expiring active pass is "current".
  packages.sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    if (a.isActive) return byExpirySoonestFirst({ expiry: a.expiresAt }, { expiry: b.expiresAt });
    return new Date(b.purchasedAt ?? 0).getTime() - new Date(a.purchasedAt ?? 0).getTime();
  });
  const activePkg = packages.find((p) => p.isActive) ?? packages[0] ?? null;

  let passCategory: PassCategory = "none";
  if (activePkg) {
    const raw = pkgsRaw.find((r) => String(r.id) === activePkg.id);
    const pt = (raw?.package_type ?? null) as Parameters<typeof passCategoryForPackageType>[0];
    passCategory = pt ? passCategoryForPackageType(pt) : "none";
  }

  const bookingsRaw = Array.isArray(data.bookings) ? (data.bookings as Array<Record<string, unknown>>) : [];
  const bookings: BookingRow[] = bookingsRaw
    .map((b) => {
      const sched = (b.class_schedule ?? null) as { start_time?: string; class_model?: { name?: string } } | null;
      const startRaw = sched?.start_time ?? (b.booking_date ? String(b.booking_date) : null);
      const when = startRaw ? new Date(startRaw).getTime() : null;
      const name = sched?.class_model?.name ?? "Class";
      const checkedIn = !!b.checked_in;
      const outcome = b.check_in_outcome ? String(b.check_in_outcome) : null;
      let status: BookingRow["status"];
      if (checkedIn) status = "attended";
      else if (outcome === "no_show") status = "no_show";
      else if (when != null && when < now) status = "missed";
      else status = "upcoming";
      const lifecycle = b.status ? String(b.status) : "confirmed";
      return { id: String(b.id), name, when, status, lifecycle, checkedIn, checkInOutcome: outcome, invoiceAvailable: !!b.invoiceAvailable };
    })
    .sort((a, b) => (b.when ?? 0) - (a.when ?? 0));

  const foodRaw = Array.isArray(data.cafe_orders) ? (data.cafe_orders as Array<Record<string, unknown>>) : [];
  const food: FoodRow[] = foodRaw.map((o) => ({
    id: String(o.id),
    item: ((o.cafe_item ?? null) as { name?: string } | null)?.name ?? "Item",
    quantity: typeof o.quantity === "number" ? o.quantity : 1,
    orderedAt: o.order_date ? String(o.order_date) : null,
    status: o.status ? String(o.status) : "—",
  }));

  const badgesRaw = Array.isArray(data.user_badges) ? (data.user_badges as Array<Record<string, unknown>>) : [];
  const badges: BadgeRow[] = badgesRaw.map((b) => ({
    id: String(b.id),
    name: b.badge_name ? String(b.badge_name) : "Badge",
    description: b.badge_description ? String(b.badge_description) : null,
    icon: b.icon ? String(b.icon) : null,
    earnedAt: b.earned_at ? String(b.earned_at) : null,
  }));

  const paymentsRaw = Array.isArray(data.payments) ? (data.payments as Array<Record<string, unknown>>) : [];
  const payments: PaymentRow[] = paymentsRaw.map((p) => {
    const admin = (p.recorded_by_admin ?? null) as { full_name?: string; email?: string } | null;
    return {
      id: String(p.id),
      method: p.method ? String(p.method) : "—",
      amountPaise: typeof p.amount_paise === "number" ? p.amount_paise : 0,
      status: p.status ? String(p.status) : "—",
      reference: p.reference ? String(p.reference) : null,
      proofUrl: p.proof_url ? String(p.proof_url) : null,
      createdAt: p.created_at ? String(p.created_at) : null,
      recordedBy: admin ? admin.full_name ?? admin.email ?? null : null,
    };
  });

  const ticketsRaw = Array.isArray(data.member_tickets) ? (data.member_tickets as Array<Record<string, unknown>>) : [];
  const tickets: TicketRow[] = ticketsRaw.map((t) => ({
    id: String(t.id),
    type: t.type ? String(t.type) : "request",
    reason: t.reason ? String(t.reason) : "",
    status: t.status ? String(t.status) : "open",
    createdAt: t.created_at ? String(t.created_at) : null,
    pauseFrom: t.pause_from ? String(t.pause_from) : null,
    pauseTo: t.pause_to ? String(t.pause_to) : null,
  }));

  const stats = (data.user_stats ?? null) as {
    total_classes_attended?: number;
    current_streak?: number;
    longest_streak?: number;
    last_class_date?: string | null;
  } | null;

  return {
    id: String(data.id),
    name: (data.full_name as string) || (data.email as string) || "Member",
    email: String(data.email ?? ""),
    phone: data.phone ? String(data.phone) : null,
    whatsappPhone: data.whatsapp_phone ? String(data.whatsapp_phone) : null,
    avatarUrl: data.avatar_url ? String(data.avatar_url) : null,
    dob: data.dob ? String(data.dob) : null,
    gender: data.gender ? String(data.gender) : null,
    startDate: data.start_date ? String(data.start_date) : null,
    createdAt: data.created_at ? String(data.created_at) : null,
    passCategory,
    unlimited: !!activePkg?.isUnlimited || passCategory === "studio_pass",
    credits: activePkg?.creditsRemaining ?? 0,
    expiry: activePkg?.expiresAt ?? null,
    activePackageId: activePkg?.id ?? null,
    activePaused: !!activePkg?.isPaused,
    stats: {
      totalClasses: stats?.total_classes_attended ?? 0,
      currentStreak: stats?.current_streak ?? 0,
      longestStreak: stats?.longest_streak ?? 0,
      lastClassDate: stats?.last_class_date ?? null,
    },
    packages,
    bookings,
    food,
    badges,
    payments,
    tickets,
  };
}

function passLabelFor(cat: PassCategory): string {
  if (cat === "studio_pass") return "Studio pass";
  if (cat === "class_pass") return "Class pass";
  return "No active pass";
}

/* ──────────────────────────  Page  ────────────────────────── */

export default function MemberDetailPage() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";
  const { status } = useSession();

  const [member, setMember] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [savingBookingId, setSavingBookingId] = useState<string | null>(null);
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  // Unified pass-edit dialog: the clicked pass + which tab is active.
  const [editPass, setEditPass] = useState<PackageRow | null>(null);
  const [editTab, setEditTab] = useState<"expiry" | "credits" | "upgrade" | "remove">("expiry");

  const [expiryDraft, setExpiryDraft] = useState("");
  const [savingExpiry, setSavingExpiry] = useState(false);

  const [adjustCredits, setAdjustCredits] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [savingAdjust, setSavingAdjust] = useState(false);

  const [removeReason, setRemoveReason] = useState("");
  const [refundKind, setRefundKind] = useState<"none" | "comp" | "money">("none");
  const [refundClasses, setRefundClasses] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundMethod, setRefundMethod] = useState("");
  const [refundProofUrl, setRefundProofUrl] = useState("");
  const [refundProofUploading, setRefundProofUploading] = useState(false);
  const [savingRemove, setSavingRemove] = useState(false);

  const [upgradeCatalog, setUpgradeCatalog] = useState<CatalogPackageRow[]>([]);
  const [upgradeTargetId, setUpgradeTargetId] = useState("");
  const [upgradeAmount, setUpgradeAmount] = useState("");
  const [upgradeMethod, setUpgradeMethod] = useState("");
  const [upgradeProofUrl, setUpgradeProofUrl] = useState("");
  const [upgradeProofUploading, setUpgradeProofUploading] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState("");
  const [savingUpgrade, setSavingUpgrade] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setNotFound(false);
    try {
      const res = await fetch(`/api/admin/members?id=${encodeURIComponent(id)}`, { credentials: "include" });
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setMember(mapDetail(await res.json()));
    } catch {
      toast.error("Could not load member");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (status === "authenticated") void load();
  }, [status, load]);

  const noShowCount = useMemo(
    () => (member?.bookings ?? []).filter((b) => b.status === "no_show").length,
    [member],
  );

  // Upgrade targets: same category (class ↔ class, studio/unlimited ↔ studio/unlimited)
  // as the pass being edited, excluding the identical package.
  const eligibleUpgradeCatalog = useMemo(() => {
    if (!editPass) return [];
    return upgradeCatalog.filter(
      (c) => Boolean(c.is_unlimited) === Boolean(editPass.isUnlimited) && c.id !== editPass.packageTypeId,
    );
  }, [upgradeCatalog, editPass]);

  /* — manual check-in outcome — */
  async function applyOutcome(bookingId: string, outcome: "on_time" | "late" | "no_show" | "not_checked_in") {
    setSavingBookingId(bookingId);
    try {
      const res = await fetch("/api/admin/manual-check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ bookingId, outcome }),
      });
      if (!res.ok) throw new Error();
      setMember((m) => {
        if (!m) return m;
        return {
          ...m,
          bookings: m.bookings.map((r) => {
            if (r.id !== bookingId) return r;
            const checkedIn = outcome === "on_time" || outcome === "late";
            let st: BookingRow["status"];
            if (checkedIn) st = "attended";
            else if (outcome === "no_show") st = "no_show";
            else st = r.when != null && r.when < Date.now() ? "missed" : "upcoming";
            return { ...r, checkedIn, checkInOutcome: outcome === "not_checked_in" ? null : outcome, status: st };
          }),
        };
      });
    } catch {
      toast.error("Could not update status");
    } finally {
      setSavingBookingId(null);
    }
  }

  /* — admin direct cancel of a booking (cancels + grants refund pass) — */
  function cancelBooking(bookingId: string) {
    setCancelTargetId(bookingId);
  }

  async function confirmCancelBooking() {
    const bookingId = cancelTargetId;
    if (!bookingId) return;
    setCancelTargetId(null);
    setSavingBookingId(bookingId);
    try {
      const res = await fetch("/api/admin/bookings/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ bookingId }),
      });
      if (!res.ok) throw new Error();
      toast.success("Booking cancelled and refund pass granted.");
      await load();
    } catch {
      toast.error("Could not cancel booking");
    } finally {
      setSavingBookingId(null);
    }
  }

  /* — open the unified pass-edit dialog and seed every tab's form state — */
  function openEditPass(p: PackageRow) {
    setEditPass(p);
    setEditTab("expiry");
    // Expiry tab
    setExpiryDraft(p.expiresAt ? p.expiresAt.slice(0, 10) : "");
    // Credits tab
    setAdjustCredits(String(p.creditsRemaining ?? 0));
    setAdjustReason("");
    // Remove tab
    setRemoveReason("");
    setRefundKind("none");
    setRefundClasses("");
    setRefundAmount("");
    setRefundMethod("");
    setRefundProofUrl("");
    // Upgrade tab
    setUpgradeTargetId("");
    setUpgradeAmount("");
    setUpgradeMethod("");
    setUpgradeProofUrl("");
    setUpgradeReason("");
    if (upgradeCatalog.length === 0) {
      fetch("/api/packages?published=1", { credentials: "include" })
        .then((r) => (r.ok ? r.json() : []))
        .then((rows: unknown) => {
          const list = Array.isArray(rows) ? rows : [];
          setUpgradeCatalog(
            list.map((row: Record<string, unknown>) => ({
              id: String(row.id),
              name: String(row.name ?? "Package"),
              type: String(row.type ?? "class_pass"),
              price: Number(row.price ?? 0),
              class_count: row.class_count == null ? null : Number(row.class_count),
              duration_months: row.duration_months == null ? null : Number(row.duration_months),
              is_unlimited: Boolean(row.is_unlimited),
            })),
          );
        })
        .catch(() => {});
    }
  }

  async function saveExpiry() {
    if (!member || !editPass || !expiryDraft) return;
    setSavingExpiry(true);
    try {
      const res = await fetch("/api/admin/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          profile_id: member.id,
          user_package_id: editPass.id,
          expiration_date: expiryDraft,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed");
      }
      toast.success("Expiry updated");
      setEditPass(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update expiry");
    } finally {
      setSavingExpiry(false);
    }
  }

  async function saveAdjust() {
    if (!editPass || !member) return;
    const credits = Number(adjustCredits);
    if (!Number.isInteger(credits) || credits < 0) {
      toast.error("Enter a whole number, zero or more");
      return;
    }
    if (!adjustReason.trim()) {
      toast.error("Reason required");
      return;
    }
    setSavingAdjust(true);
    try {
      const res = await fetch("/api/admin/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          profile_id: member.id,
          user_package_id: editPass.id,
          action: "adjust_credits",
          credits,
          reason: adjustReason.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed");
      }
      toast.success("Credits updated");
      setEditPass(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update credits");
    } finally {
      setSavingAdjust(false);
    }
  }

  async function uploadRefundProof(file: File) {
    setRefundProofUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("purpose", "payment_proof");
      const res = await fetch("/api/upload", { method: "POST", credentials: "include", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.url) throw new Error(json.error ?? "Upload failed");
      setRefundProofUrl(json.url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setRefundProofUploading(false);
    }
  }
  async function saveRemove() {
    if (!editPass || !member) return;
    if (!removeReason.trim()) {
      toast.error("Reason required");
      return;
    }
    if (refundKind === "comp" && (!Number.isInteger(Number(refundClasses)) || Number(refundClasses) <= 0)) {
      toast.error("Enter a valid number of comp classes");
      return;
    }
    if (refundKind === "money" && (!refundAmount || !refundMethod)) {
      toast.error("Enter a refund amount and method");
      return;
    }
    setSavingRemove(true);
    try {
      const res = await fetch("/api/admin/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          profile_id: member.id,
          user_package_id: editPass.id,
          action: "remove_pass",
          reason: removeReason.trim(),
          refund_kind: refundKind,
          refund:
            refundKind === "comp"
              ? { classes: Number(refundClasses) }
              : refundKind === "money"
                ? { amount_paise: Math.round(Number(refundAmount) * 100), method: refundMethod, proof_url: refundProofUrl || undefined }
                : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed");
      }
      toast.success("Pass removed");
      setEditPass(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove pass");
    } finally {
      setSavingRemove(false);
    }
  }

  function onUpgradeTargetChange(id: string) {
    setUpgradeTargetId(id);
    const target = upgradeCatalog.find((c) => c.id === id);
    if (target && editPass) {
      const currentPriceInr = editPass.price ?? 0;
      const diffPaise = computeUpgradeDifferencePaise(currentPriceInr, target.price);
      setUpgradeAmount((diffPaise / 100).toFixed(2));
    }
  }
  async function uploadUpgradeProof(file: File) {
    setUpgradeProofUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("purpose", "payment_proof");
      const res = await fetch("/api/upload", { method: "POST", credentials: "include", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.url) throw new Error(json.error ?? "Upload failed");
      setUpgradeProofUrl(json.url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUpgradeProofUploading(false);
    }
  }
  async function saveUpgrade() {
    if (!editPass || !member) return;
    if (!upgradeTargetId) return toast.error("Select a target package");
    const amountPaise = Math.round(Number(upgradeAmount) * 100);
    if (!Number.isFinite(amountPaise) || amountPaise < 0) return toast.error("Enter a valid amount");
    if (amountPaise > 0 && (!upgradeMethod || !upgradeProofUrl)) {
      return toast.error("Select a method and upload proof for a paid upgrade");
    }
    if (!upgradeReason.trim()) return toast.error("Reason required");
    setSavingUpgrade(true);
    try {
      const res = await fetch("/api/admin/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          profile_id: member.id,
          user_package_id: editPass.id,
          action: "upgrade_pass",
          target_package_type_id: upgradeTargetId,
          amount_paise: amountPaise,
          method: upgradeMethod || undefined,
          proof_url: upgradeProofUrl || undefined,
          reason: upgradeReason.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed");
      }
      toast.success("Pass upgraded");
      setEditPass(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not upgrade pass");
    } finally {
      setSavingUpgrade(false);
    }
  }

  /* — pause / resume active pass — */
  async function togglePause(next: boolean) {
    if (!member) return;
    try {
      const res = await fetch("/api/admin/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          profile_id: member.id,
          user_package_id: member.activePackageId ?? undefined,
          action: next ? "pause" : "resume",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed");
      }
      toast.success(next ? "Pass paused" : "Pass resumed");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update pass");
    }
  }

  return (
    <>
      <SEO title={`${member?.name ?? "Member"} — Admin`} description="Member profile and management" />
      <div className="min-h-screen bg-linear-to-br from-cream via-cream to-sage/10">
        <main className="min-h-screen">
          <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-6">
            <PageHeader
              title={member?.name ?? "Member"}
              subtitle={member?.email ?? "Member profile"}
              crumbs={[
                { label: "Dashboard", href: "/admin/dashboard" },
                { label: "Members", href: "/admin/members" },
                { label: member?.name ?? "—" },
              ]}
            />

            {(() => {
              if (notFound) {
                return (
                  <Card className="border-terracotta/30 bg-terracotta/5 rounded-2xl">
                    <CardContent className="p-8 text-center space-y-3">
                      <p className="font-body text-charcoal">This member could not be found.</p>
                      <Button variant="outline" onClick={() => router.push("/admin/members")} className="font-body">
                        <ArrowLeft className="h-4 w-4 mr-1.5" />
                        Back to members
                      </Button>
                    </CardContent>
                  </Card>
                );
              }
              if (loading || !member) return <DetailSkeleton />;
              return (
                <MemberBody
                  member={member}
                  noShowCount={noShowCount}
                  savingBookingId={savingBookingId}
                  onApplyOutcome={applyOutcome}
                  onCancelBooking={cancelBooking}
                  onTogglePause={togglePause}
                  onEditPass={openEditPass}
                  onReload={load}
                />
              );
            })()}
          </div>
        </main>
      </div>

      {/* Edit pass — tabbed: Expiry · Credits · Upgrade · Remove */}
      <ResponsiveDialog open={editPass !== null} onOpenChange={(o) => { if (!o) setEditPass(null); }}>
        <ResponsiveDialogContent className="sm:max-w-[520px] bg-white-warm border-sage/20">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="font-body font-semibold text-2xl text-charcoal">
              Edit pass{editPass ? ` · ${editPass.name}` : ""}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="font-body text-charcoal/60">
              Update expiry, adjust credits, upgrade, or remove this pass.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          {editPass && (
            <Tabs value={editTab} onValueChange={(v) => setEditTab(v as typeof editTab)}>
              <TabsList className="bg-cream/50 border border-sage/15 p-1 gap-1 h-auto w-full justify-start">
                <TabsTrigger value="expiry" className="font-body text-charcoal/60 data-[state=active]:bg-sage data-[state=active]:text-cream data-[state=active]:shadow-xs">Expiry</TabsTrigger>
                <TabsTrigger value="credits" className="font-body text-charcoal/60 data-[state=active]:bg-sage data-[state=active]:text-cream data-[state=active]:shadow-xs">Credits</TabsTrigger>
                <TabsTrigger value="upgrade" className="font-body text-charcoal/60 data-[state=active]:bg-sage data-[state=active]:text-cream data-[state=active]:shadow-xs">Upgrade</TabsTrigger>
                <TabsTrigger value="remove" className="font-body text-charcoal/60 data-[state=active]:bg-terracotta data-[state=active]:text-cream data-[state=active]:shadow-xs">Remove</TabsTrigger>
              </TabsList>

              {/* Expiry */}
              <TabsContent value="expiry" className="space-y-4 pt-4">
                <div className="space-y-2 rounded-xl border border-sage/20 bg-sage/5 px-4 py-3 font-body text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-charcoal/55">Pass</span>
                    <span className="font-medium text-charcoal">{editPass.name}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-charcoal/55">Classes left</span>
                    <span className="font-medium text-charcoal">
                      {editPass.isUnlimited ? "Unlimited" : `${editPass.creditsRemaining ?? 0} left`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-charcoal/55">Status</span>
                    <Pill {...memberStatusPill(editPass.status)} size="sm">
                      {editPass.status.charAt(0).toUpperCase() + editPass.status.slice(1).replace(/_/g, " ")}
                    </Pill>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-charcoal/55">Current expiry</span>
                    <span className="font-medium text-charcoal">{editPass.expiresAt ? fmtDate(editPass.expiresAt) : "No expiry"}</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="font-body text-sm text-charcoal/80">New expiry date</label>
                  <DatePicker value={expiryDraft} onChange={setExpiryDraft} placeholder="Select expiry date" className="h-11" />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="sage"
                    onClick={saveExpiry}
                    disabled={savingExpiry || !expiryDraft || expiryDraft === (editPass.expiresAt?.slice(0, 10) ?? "")}
                    className="font-body"
                  >
                    {savingExpiry ? "Saving…" : "Update expiry"}
                  </Button>
                </div>
              </TabsContent>

              {/* Credits */}
              <TabsContent value="credits" className="space-y-4 pt-4">
                <div className="space-y-1.5">
                  <Label className="font-body text-sm text-charcoal/70">New credit balance</Label>
                  <Input type="number" min={0} step={1} value={adjustCredits} onChange={(e) => setAdjustCredits(e.target.value)} className="font-body" />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-body text-sm text-charcoal/70">Reason (required)</Label>
                  <Textarea value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} className="font-body" rows={3} />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button onClick={() => void saveAdjust()} disabled={savingAdjust || !adjustReason.trim()} variant="sage" className="font-body">
                    {savingAdjust ? "Saving…" : "Save"}
                  </Button>
                </div>
              </TabsContent>

              {/* Upgrade */}
              <TabsContent value="upgrade" className="space-y-4 pt-4">
                <div className="space-y-1.5">
                  <Label className="font-body text-sm text-charcoal/70">Upgrade to</Label>
                  <Select value={upgradeTargetId} onValueChange={onUpgradeTargetChange} disabled={eligibleUpgradeCatalog.length === 0}>
                    <SelectTrigger className="border-sage/20 font-body">
                      <SelectValue placeholder={eligibleUpgradeCatalog.length === 0 ? "No eligible upgrade" : "Select target package"} />
                    </SelectTrigger>
                    <SelectContent>
                      {eligibleUpgradeCatalog.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name} · {formatINR(Math.round(c.price * 100))}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="font-body text-sm text-charcoal/70">Amount to collect (₹)</Label>
                  <Input type="number" min={0} step="0.01" value={upgradeAmount} onChange={(e) => setUpgradeAmount(e.target.value)} className="font-body" />
                </div>
                {Number(upgradeAmount) > 0 && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="font-body text-sm text-charcoal/70">Method</Label>
                      <Select value={upgradeMethod} onValueChange={setUpgradeMethod}>
                        <SelectTrigger className="border-sage/20 font-body"><SelectValue placeholder="Select method" /></SelectTrigger>
                        <SelectContent>
                          {PAYMENT_METHODS.map((m) => (
                            <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="font-body text-sm text-charcoal/70">Proof of payment</Label>
                      <Input
                        type="file"
                        accept="image/*"
                        disabled={upgradeProofUploading}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadUpgradeProof(f); }}
                        className="font-body"
                      />
                      {upgradeProofUrl && <a href={upgradeProofUrl} target="_blank" rel="noreferrer" className="text-xs text-sage underline">view uploaded proof</a>}
                    </div>
                  </>
                )}
                <div className="space-y-1.5">
                  <Label className="font-body text-sm text-charcoal/70">Reason (required)</Label>
                  <Textarea value={upgradeReason} onChange={(e) => setUpgradeReason(e.target.value)} className="font-body" rows={3} />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    onClick={() => void saveUpgrade()}
                    disabled={savingUpgrade || !upgradeTargetId || !upgradeReason.trim() || (Number(upgradeAmount) > 0 && (!upgradeMethod || !upgradeProofUrl))}
                    variant="sage"
                    className="font-body"
                  >
                    {savingUpgrade ? "Upgrading…" : "Upgrade"}
                  </Button>
                </div>
              </TabsContent>

              {/* Remove */}
              <TabsContent value="remove" className="space-y-4 pt-4">
                <p className="font-body text-sm text-charcoal/60">This deactivates the pass. It stays in history.</p>
                <div className="space-y-1.5">
                  <Label className="font-body text-sm text-charcoal/70">Reason (required)</Label>
                  <Textarea value={removeReason} onChange={(e) => setRemoveReason(e.target.value)} className="font-body" rows={3} />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-body text-sm text-charcoal/70">Refund?</Label>
                  <Select value={refundKind} onValueChange={(v) => setRefundKind(v as "none" | "comp" | "money")}>
                    <SelectTrigger className="border-sage/20 font-body"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No refund</SelectItem>
                      <SelectItem value="comp">Comp pass (free classes)</SelectItem>
                      <SelectItem value="money">Money refund</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {refundKind === "comp" && (
                  <div className="space-y-1.5">
                    <Label className="font-body text-sm text-charcoal/70">Comp classes to grant</Label>
                    <Input type="number" min={1} step={1} value={refundClasses} onChange={(e) => setRefundClasses(e.target.value)} className="font-body" />
                  </div>
                )}
                {refundKind === "money" && (
                  <>
                    <p className="font-body text-xs text-charcoal/60">
                      Audit note only — this records what you refunded outside the app. It does not move money or create a finance-ledger entry.
                    </p>
                    <div className="space-y-1.5">
                      <Label className="font-body text-sm text-charcoal/70">Refund amount (₹)</Label>
                      <Input type="number" min={0} step="0.01" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} className="font-body" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="font-body text-sm text-charcoal/70">Method</Label>
                      <Select value={refundMethod} onValueChange={setRefundMethod}>
                        <SelectTrigger className="border-sage/20 font-body"><SelectValue placeholder="Select method" /></SelectTrigger>
                        <SelectContent>
                          {PAYMENT_METHODS.map((m) => (
                            <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="font-body text-sm text-charcoal/70">Proof (optional)</Label>
                      <Input
                        type="file"
                        accept="image/*"
                        disabled={refundProofUploading}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadRefundProof(f); }}
                        className="font-body"
                      />
                      {refundProofUrl && <a href={refundProofUrl} target="_blank" rel="noreferrer" className="text-xs text-sage underline">view uploaded proof</a>}
                    </div>
                  </>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <Button onClick={() => void saveRemove()} disabled={savingRemove || !removeReason.trim()} variant="destructive" className="font-body">
                    {savingRemove ? "Removing…" : "Remove pass"}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          )}

          <ResponsiveDialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setEditPass(null)} className="font-body">
              Close
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ResponsiveDialog open={cancelTargetId !== null} onOpenChange={(o) => { if (!o) setCancelTargetId(null); }}>
        <ResponsiveDialogContent className="sm:max-w-[440px] bg-white-warm border-sage/20">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="font-body font-semibold text-2xl text-charcoal">Cancel this booking?</ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="font-body text-charcoal/60">
              The seat is released and a 1 Class Pass refund is granted (unlimited members excepted). This cannot be undone.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogFooter>
            <Button variant="outline" onClick={() => setCancelTargetId(null)} className="border-charcoal/20 text-charcoal hover:bg-charcoal/5 font-body">
              Keep booking
            </Button>
            <Button variant="destructive" onClick={() => void confirmCancelBooking()} className="font-body">
              Cancel &amp; refund
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}

/* ──────────────────────────  Body  ────────────────────────── */

function MemberBody({
  member,
  noShowCount,
  savingBookingId,
  onApplyOutcome,
  onCancelBooking,
  onTogglePause,
  onEditPass,
  onReload,
}: {
  member: MemberDetail;
  noShowCount: number;
  savingBookingId: string | null;
  onApplyOutcome: (id: string, o: "on_time" | "late" | "no_show" | "not_checked_in") => void;
  onCancelBooking: (id: string) => void;
  onTogglePause: (next: boolean) => void;
  onEditPass: (p: PackageRow) => void;
  onReload: () => Promise<void>;
}) {
  const [manageOpen, setManageOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const passLabel = passLabelFor(member.passCategory);

  return (
    <>
      {/* Identity band */}
      <section className="overflow-hidden rounded-2xl border border-sage/20 bg-linear-to-br from-sage/[0.08] via-card to-cream/40 shadow-xs">
        <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-[auto_1fr_auto] md:items-center">
          <ListAvatar name={member.name} src={member.avatarUrl} size="lg" />
          <div className="min-w-0">
            <h2 className="font-body font-semibold text-3xl text-charcoal truncate">{member.name}</h2>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-body text-xs text-charcoal/65">
              {member.email && (
                <a href={`mailto:${member.email}`} className="inline-flex items-center gap-1.5 transition-colors hover:text-sage">
                  <Mail className="h-3.5 w-3.5" />
                  {member.email}
                </a>
              )}
              {member.phone && (
                <a href={`tel:${member.phone}`} className="inline-flex items-center gap-1.5 transition-colors hover:text-sage">
                  <Phone className="h-3.5 w-3.5" />
                  {member.phone}
                </a>
              )}
              {member.whatsappPhone && (
                <span className="inline-flex items-center gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5" />
                  {member.whatsappPhone}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 md:items-end">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setEditOpen(true)}
                className="font-body flex-1 border-sage/30 text-sage hover:bg-sage hover:text-cream"
              >
                <Pencil className="h-4 w-4 mr-1.5" />
                Edit
              </Button>
              {member.activePackageId && (
                <Button
                  variant="outline"
                  onClick={() => onTogglePause(!member.activePaused)}
                  className="font-body flex-1 border-sage/30 text-sage hover:bg-sage hover:text-cream"
                >
                  {member.activePaused ? <Play className="h-4 w-4 mr-1.5" /> : <Pause className="h-4 w-4 mr-1.5" />}
                  {member.activePaused ? "Resume" : "Pause"}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Stat bar — engagement at a glance */}
        <div className="grid grid-cols-2 divide-x divide-sage/10 border-t border-sage/10 sm:grid-cols-4">
          <StatCell icon={Trophy} label="Classes" value={member.stats.totalClasses} />
          <StatCell icon={Flame} label="Streak" value={member.stats.currentStreak} hint={`best ${member.stats.longestStreak}`} />
          <StatCell icon={UserX} label="No-shows" value={noShowCount} tone={noShowCount > 0 ? "clay" : "sage"} />
          <StatCell icon={Calendar} label="Member since" value={fmtDate(member.createdAt)} small />
        </div>
      </section>

      {/* Two-column workspace */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          <SectionCard title="Class history" icon={Calendar} count={member.bookings.length}>
            {member.bookings.length === 0 ? (
              <EmptyNote text="No class history yet." />
            ) : (
              <ResponsiveTable stack>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Class</TableHead>
                      <TableHead>When</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Check-in</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {member.bookings.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-body text-charcoal">{row.name}</TableCell>
                        <TableCell className="font-body text-charcoal/60 whitespace-nowrap">{fmtDateTime(row.when)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Pill {...bookingStatusPill(row.lifecycle)}>{bookingStatusPill(row.lifecycle).label}</Pill>
                            {(row.lifecycle === "payment_pending" || row.lifecycle === "expired") && (
                              <Pill {...bookingPaymentPill(row.lifecycle)}>{bookingPaymentPill(row.lifecycle).label}</Pill>
                            )}
                            {row.invoiceAvailable && (
                              <a
                                href={`/api/bookings/${row.id}/invoice`}
                                className="inline-flex items-center gap-1 font-body text-xs text-sage transition-colors hover:text-terracotta active:scale-[0.96]"
                              >
                                <ReceiptText className="h-3.5 w-3.5" /> Invoice
                              </a>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {savingBookingId === row.id && <Spinner className="size-3" />}
                            <Select
                              value={
                                row.checkedIn
                                  ? row.checkInOutcome === "late" ? "late" : "on_time"
                                  : row.checkInOutcome === "no_show" ? "no_show" : "not_checked_in"
                              }
                              onValueChange={(v) => onApplyOutcome(row.id, v as "on_time" | "late" | "no_show" | "not_checked_in")}
                              disabled={savingBookingId === row.id}
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
                            {(row.lifecycle === "confirmed" || row.lifecycle === "payment_pending") && !row.checkedIn && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={savingBookingId === row.id}
                                onClick={() => onCancelBooking(row.id)}
                                className="h-8 border-terracotta/30 text-terracotta hover:bg-terracotta/5 hover:text-terracotta! font-body text-xs"
                              >
                                Cancel
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ResponsiveTable>
            )}
          </SectionCard>

          <SectionCard title="Payments" icon={ReceiptText} count={member.payments.length}>
            {member.payments.length === 0 ? (
              <EmptyNote text="No payments recorded." />
            ) : (
              <ResponsiveTable stack>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Recorded by</TableHead>
                      <TableHead className="text-right">Proof</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {member.payments.map((p) => {
                      const pm = paymentMethodPill(p.method);
                      return (
                        <TableRow key={p.id}>
                          <TableCell>
                            <Pill
                              tone={pm.tone}
                              brand={pm.brand}
                              icon={pm.label === "Cash" ? <Banknote className="h-3 w-3" /> : undefined}
                              className="font-body"
                            >
                              {pm.label}
                            </Pill>
                            {p.reference && <div className="font-body text-xs text-charcoal/50 mt-1">{p.reference}</div>}
                          </TableCell>
                          <TableCell className="text-right font-body text-charcoal tabular-nums whitespace-nowrap">{rupees(p.amountPaise)}</TableCell>
                          <TableCell className="font-body text-charcoal/60 whitespace-nowrap">{fmtDate(p.createdAt)}</TableCell>
                          <TableCell className="font-body text-charcoal/60">{p.recordedBy ?? "—"}</TableCell>
                          <TableCell className="text-right">
                            {p.proofUrl ? (
                              <a href={p.proofUrl} target="_blank" rel="noreferrer" className="font-body text-xs text-sage underline">view</a>
                            ) : (
                              <span className="font-body text-xs text-charcoal/30">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ResponsiveTable>
            )}
          </SectionCard>

          <SectionCard title="Packages" icon={CreditCard} count={member.packages.length}>
            {member.packages.length === 0 ? (
              <EmptyNote text="No packages purchased." />
            ) : (() => {
              const active = member.packages.filter((p) => p.isActive);
              const inactive = member.packages.filter((p) => !p.isActive);
              const anyUnlimited = active.some((p) => p.isUnlimited);
              const totalRemaining = active.reduce((s, p) => s + Math.max(0, p.creditsRemaining ?? 0), 0);
              const card = (p: PackageRow, i: number, dim: boolean) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: dim ? 0.6 : 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1], delay: Math.min(i, 6) * 0.06 }}
                >
                  {p.isActive ? (
                    <button
                      type="button"
                      onClick={() => onEditPass(p)}
                      title="Edit pass"
                      aria-label={`Edit ${p.name}`}
                      className="block w-full cursor-pointer rounded-2xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2"
                    >
                      <PassCard
                        name={p.name}
                        isUnlimited={p.isUnlimited}
                        classesRemaining={p.creditsRemaining}
                        expiry={p.expiresAt}
                        durationMonths={p.durationMonths}
                        status={p.status}
                        className="w-full"
                      />
                    </button>
                  ) : (
                    <PassCard
                      name={p.name}
                      isUnlimited={p.isUnlimited}
                      classesRemaining={p.creditsRemaining}
                      expiry={p.expiresAt}
                      durationMonths={p.durationMonths}
                      status={p.status}
                      className="w-full"
                    />
                  )}
                </motion.div>
              );
              return (
                <div className="space-y-5">
                  {/* Aggregate summary — true total across every active pass, like the member portal. */}
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-lg bg-muted/40 px-4 py-3">
                    <span className="font-body text-2xl font-semibold tabular-nums text-charcoal">
                      {anyUnlimited ? "∞" : totalRemaining}
                    </span>
                    <span className="font-body text-sm text-charcoal/55">
                      {anyUnlimited ? "unlimited classes" : "classes remaining"}
                    </span>
                    <span className="ml-auto font-body text-xs text-charcoal/45">
                      {active.length} active · {inactive.length} expired/used
                    </span>
                  </div>

                  {active.length > 0 && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {active.map((p, i) => card(p, i, false))}
                    </div>
                  )}

                  {inactive.length > 0 && (
                    <details className="group">
                      <summary className="flex cursor-pointer items-center gap-1.5 font-body text-sm text-charcoal/55 transition-colors hover:text-charcoal">
                        <span className="transition-transform group-open:rotate-90">›</span>
                        Expired / used-up ({inactive.length})
                      </summary>
                      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {inactive.map((p, i) => card(p, i, true))}
                      </div>
                    </details>
                  )}
                </div>
              );
            })()}
          </SectionCard>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <SectionCard title="Café orders" icon={Coffee} count={member.food.length}>
              {member.food.length === 0 ? (
                <EmptyNote text="No café orders." />
              ) : (
                <ul className="divide-y divide-sage/10">
                  {member.food.map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <div className="font-body font-medium text-charcoal truncate">
                          {o.item} <span className="text-charcoal/50 font-normal">× {o.quantity}</span>
                        </div>
                        <div className="font-body text-xs text-charcoal/50">{fmtDate(o.orderedAt)}</div>
                      </div>
                      <Pill tone="neutral" className="font-body capitalize">{o.status}</Pill>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard title="Badges" icon={Sparkles} count={member.badges.length}>
              {member.badges.length === 0 ? (
                <EmptyNote text="No badges earned yet." />
              ) : (
                <ul className="divide-y divide-sage/10">
                  {member.badges.map((b) => (
                    <li key={b.id} className="flex items-center gap-3 py-3">
                      <span className="text-2xl leading-none">{b.icon || "🏆"}</span>
                      <div className="min-w-0">
                        <div className="font-body font-medium text-charcoal truncate">{b.name}</div>
                        {b.description && <div className="font-body text-xs text-charcoal/50 truncate">{b.description}</div>}
                        {b.earnedAt && <div className="font-body text-xs text-charcoal/40">Earned {fmtDate(b.earnedAt)}</div>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>
        </div>

        {/* Rail */}
        <aside className="space-y-6">
          {/* Current pass — single source of truth */}
          <Card className="rounded-2xl shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="font-body font-semibold text-lg text-charcoal flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-sage" /> Current pass
              </CardTitle>
            </CardHeader>
            <CardContent>
              {member.activePackageId ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="font-body font-semibold text-2xl text-charcoal">{passLabel}</span>
                    {member.activePaused && <Pill tone="warning" className="font-body">Paused</Pill>}
                  </div>
                  <dl className="space-y-0 divide-y divide-sage/10 text-sm">
                    <RailRow label="Remaining" value={member.unlimited ? "Unlimited" : `${member.credits} classes`} />
                    <RailRow label="Expires" value={member.expiry ? fmtDate(member.expiry) : "—"} />
                  </dl>
                  <Button
                    variant="outline"
                    onClick={() => setManageOpen(true)}
                    className="font-body w-full border-sage/30 text-sage hover:bg-sage hover:text-cream"
                  >
                    <CreditCard className="h-4 w-4 mr-1.5" /> Assign a new pass
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="font-body text-sm text-charcoal/45 italic">No active pass.</p>
                  <Button variant="sage" onClick={() => setManageOpen(true)} className="font-body w-full">
                    <CreditCard className="h-4 w-4 mr-1.5" /> Assign a new pass
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Profile details */}
          <Card className="rounded-2xl shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="font-body font-semibold text-lg text-charcoal flex items-center gap-2">
                <UserIcon className="h-4 w-4 text-sage" /> Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-0 divide-y divide-sage/10 text-sm">
                <RailRow icon={Cake} label="Date of birth" value={member.dob ? fmtDate(member.dob) : null} />
                <RailRow icon={UserIcon} label="Gender" value={member.gender} capitalize />
                <RailRow icon={Calendar} label="Start date" value={member.startDate ? fmtDate(member.startDate) : null} />
                <RailRow icon={MessageCircle} label="WhatsApp" value={member.whatsappPhone} />
              </dl>
            </CardContent>
          </Card>

          {/* Support tickets */}
          <SectionCard title="Support tickets" icon={Ticket} count={member.tickets.length}>
            {member.tickets.length === 0 ? (
              <EmptyNote text="No support tickets." />
            ) : (
              <ul className="divide-y divide-sage/10">
                {member.tickets.map((t) => (
                  <li key={t.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <div className="font-body font-medium text-charcoal capitalize">{t.type.replace(/_/g, " ")}</div>
                      {t.reason && <div className="font-body text-xs text-charcoal/60 truncate">{t.reason}</div>}
                      <div className="font-body text-xs text-charcoal/40">
                        {fmtDate(t.createdAt)}
                        {t.pauseFrom ? ` · pause ${fmtDate(t.pauseFrom)}→${fmtDate(t.pauseTo)}` : ""}
                      </div>
                    </div>
                    <Pill tone={ticketStatusPill(t.status).tone} className="font-body capitalize shrink-0">
                      {t.status.replace(/_/g, " ")}
                    </Pill>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </aside>
      </div>

      <ManagePassDialog member={member} open={manageOpen} onOpenChange={setManageOpen} onDone={onReload} />
      <EditProfileDialog member={member} open={editOpen} onOpenChange={setEditOpen} onDone={onReload} />
    </>
  );
}

/* ──────────────────────────  Edit profile dialog  ────────────────────────── */

function EditProfileDialog({
  member,
  open,
  onOpenChange,
  onDone,
}: {
  member: MemberDetail;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => Promise<void>;
}) {
  const [fullName, setFullName] = useState(member.name);
  const [phone, setPhone] = useState(member.phone ?? "");
  const [whatsapp, setWhatsapp] = useState(member.whatsappPhone ?? "");
  const [gender, setGender] = useState(member.gender ?? "");
  const [dob, setDob] = useState(member.dob ? member.dob.slice(0, 10) : "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setFullName(member.name);
      setPhone(member.phone ?? "");
      setWhatsapp(member.whatsappPhone ?? "");
      setGender(member.gender ?? "");
      setDob(member.dob ? member.dob.slice(0, 10) : "");
    }
  }, [open, member]);

  async function save() {
    if (!fullName.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          profile_id: member.id,
          profile_fields: {
            full_name: fullName,
            phone,
            whatsapp_phone: whatsapp,
            gender,
            dob,
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Update failed");
      }
      toast.success("Profile updated");
      onOpenChange(false);
      await onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-[440px] bg-white-warm border-sage/20">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="font-body font-semibold text-2xl text-charcoal">Edit profile</ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="font-body text-charcoal/60">
            Update {member.name}&apos;s contact details. Email and login are unchanged.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <Label className="font-body text-charcoal/80 mb-1.5 block text-sm">Full name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="border-sage/20 focus:border-sage font-body" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="font-body text-charcoal/80 mb-1.5 block text-sm">Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="border-sage/20 focus:border-sage font-body" placeholder="+91 …" />
            </div>
            <div>
              <Label className="font-body text-charcoal/80 mb-1.5 block text-sm">WhatsApp</Label>
              <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="border-sage/20 focus:border-sage font-body" placeholder="+91 …" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="font-body text-charcoal/80 mb-1.5 block text-sm">Gender</Label>
              <Select value={gender || "unset"} onValueChange={(v) => setGender(v === "unset" ? "" : v)}>
                <SelectTrigger className="border-sage/20 font-body">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unset">—</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="font-body text-charcoal/80 mb-1.5 block text-sm">Date of birth</Label>
              <DatePicker value={dob} onChange={setDob} placeholder="Select date" />
            </div>
          </div>
        </div>

        <ResponsiveDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="border-charcoal/20 text-charcoal hover:bg-charcoal/5 font-body">
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving} variant="sage">
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

/* ──────────────────────────  Manage pass dialog (shared engine)  ────────────────────────── */

function ManagePassDialog({
  member,
  open,
  onOpenChange,
  onDone,
}: {
  member: MemberDetail;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => Promise<void>;
}) {
  const ctx: PassMemberContext = {
    id: member.id,
    name: member.name,
    passCategory: member.passCategory === "none" ? "none" : member.passCategory,
    activePackageId: member.activePackageId,
    credits: member.credits,
    startDate: member.startDate,
  };
  const s = usePassPaymentState(ctx);
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setStep("form");
      s.reset();
      s.loadDefaults();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const { finalPaise, isFree } = priceBreakdown(s);
  const formValid = !validateConfig(s) && !validatePayment(s);

  function goToConfirm() {
    const err = validateConfig(s) ?? validatePayment(s);
    if (err) {
      toast.error(err);
      return;
    }
    setStep("confirm");
  }

  async function commit() {
    const err = validateConfig(s) ?? validatePayment(s);
    if (err) {
      toast.error(err);
      return;
    }
    setSubmitting(true);
    try {
      await persistStartDate(member.id, s, member.startDate);
      if (!isFree) await recordPayment(member.id, s, member.activePackageId);
      await applyPassConfig(member.id, s);
      toast.success(isFree ? `Free pass assigned to ${member.name}` : `Pass assigned · ${formatINR(finalPaise)} recorded`);
      onOpenChange(false);
      await onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not assign pass");
    } finally {
      setSubmitting(false);
    }
  }

  const pkg = selectedPackageOf(s);

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-[520px] bg-white-warm border-sage/20">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="font-body font-semibold text-2xl text-charcoal">
            {step === "form" ? `Assign pass · ${member.name}` : "Review & confirm"}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="font-body text-charcoal/60">
            {step === "form" ? "Pick a package, apply any discount, attach proof." : "Check the details, then confirm."}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="max-h-[60vh] overflow-y-auto px-1 py-2">
          {step === "form" ? (
            <div className="space-y-6">
              <PassConfigSection state={s} currentCredits={member.credits} />
              <PaymentSection state={s} />
            </div>
          ) : (
            <div className="space-y-2 font-body text-sm">
              <ConfirmRow label="Member" value={member.name} />
              <ConfirmRow label="Package" value={passSummary(s)} />
              <ConfirmRow label="Expiry" value={s.expiry || "—"} />
              <ConfirmRow label="Start date" value={s.startDate || "—"} />
              {pkg && <ConfirmRow label="Package price" value={formatINR(Math.round(pkg.price * 100))} />}
              {isFree ? (
                <>
                  <ConfirmRow label="Amount" value="Free (no payment)" />
                  {s.grantNote.trim() && <ConfirmRow label="Reason" value={s.grantNote.trim()} />}
                </>
              ) : (
                <>
                  <ConfirmRow label="Discount" value={s.discountValue ? `${s.discountValue}${s.discountUnit === "pct" ? "%" : " ₹"}` : "—"} />
                  <ConfirmRow label="Amount payable" value={formatINR(finalPaise)} strong />
                  <ConfirmRow label="Method" value={s.method || "—"} />
                  <div className="flex items-center justify-between border-b border-sage/10 py-2">
                    <span className="text-charcoal/55">Proof</span>
                    {s.proofUrl ? (
                      <a href={s.proofUrl} target="_blank" rel="noreferrer" className="text-sage underline">view image</a>
                    ) : (
                      <span className="text-terracotta">missing</span>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <ResponsiveDialogFooter className="gap-2 sm:gap-2">
          {step === "form" ? (
            <>
              {pkg && (
                <div className="mr-auto flex flex-col justify-center font-body leading-tight">
                  <span className="text-[11px] uppercase tracking-wide text-charcoal/45">Payable</span>
                  <span className="font-body font-semibold text-lg text-charcoal tabular-nums">{isFree ? "Free" : formatINR(finalPaise)}</span>
                </div>
              )}
              <Button variant="outline" onClick={() => onOpenChange(false)} className="border-charcoal/20 text-charcoal hover:bg-charcoal/5 font-body">
                Cancel
              </Button>
              <Button onClick={goToConfirm} disabled={!formValid || s.proofUploading} variant="sage">
                Review →
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep("form")} className="border-charcoal/20 text-charcoal hover:bg-charcoal/5 font-body">
                Back
              </Button>
              <Button onClick={() => void commit()} disabled={submitting} variant="sage">
                {submitting ? "Assigning…" : "Confirm & assign"}
              </Button>
            </>
          )}
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function ConfirmRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-sage/10 py-2">
      <span className="text-charcoal/55">{label}</span>
      <span className={strong ? "font-body font-semibold text-base text-charcoal tabular-nums" : "text-charcoal"}>{value}</span>
    </div>
  );
}

/* ──────────────────────────  Small components  ────────────────────────── */

function StatCell({
  icon: Icon,
  label,
  value,
  hint,
  tone = "sage",
  small,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  hint?: string;
  tone?: "sage" | "clay";
  small?: boolean;
}) {
  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-1.5 font-body text-[11px] uppercase tracking-[0.12em] text-charcoal/45">
        <Icon className={`h-3.5 w-3.5 ${tone === "clay" ? "text-terracotta" : "text-sage"}`} />
        {label}
      </div>
      <div className={`mt-1 font-body font-semibold tabular-nums text-charcoal ${small ? "text-base" : "text-2xl"} ${tone === "clay" && typeof value === "number" && value > 0 ? "text-terracotta" : ""}`}>
        {value}
      </div>
      {hint && <div className="font-body text-[11px] text-charcoal/40">{hint}</div>}
    </div>
  );
}

function SectionCard({
  title,
  icon: Icon,
  count,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-2xl shadow-xs">
      <CardHeader className="pb-3">
        <CardTitle className="font-body font-semibold text-lg text-charcoal flex items-center gap-2">
          <Icon className="h-4 w-4 text-sage" />
          {title}
          <span className="font-body text-sm text-charcoal/40">({count})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function RailRow({
  icon: Icon,
  label,
  value,
  capitalize,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null;
  capitalize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 font-body text-sm">
      <span className="flex items-center gap-2 text-charcoal/55">
        {Icon && <Icon className="h-3.5 w-3.5 text-sage shrink-0" />}
        {label}
      </span>
      {value ? (
        <span className={`text-charcoal/85 text-right truncate ${capitalize ? "capitalize" : ""}`}>{value}</span>
      ) : (
        <span className="text-charcoal/35 italic">—</span>
      )}
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <p className="font-body text-sm text-charcoal/40 italic py-4">{text}</p>;
}

function DetailSkeleton() {
  return (
    <>
      <div className="rounded-2xl border border-sage/15 bg-white-warm p-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[auto_1fr_auto] md:items-center">
          <Skeleton className="size-24 rounded-full bg-sage/10" />
          <div className="space-y-2 min-w-0">
            <Skeleton className="h-8 w-56 bg-sage/15" />
            <Skeleton className="h-4 w-64 bg-sage/10" />
          </div>
          <Skeleton className="h-9 w-40 bg-sage/10" />
        </div>
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-sage/10 pt-4">
          {["s1", "s2", "s3", "s4"].map((s) => (
            <div key={s} className="space-y-2">
              <Skeleton className="h-3 w-16 bg-sage/10" />
              <Skeleton className="h-6 w-10 bg-sage/15" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {["c1", "c2"].map((s) => (
            <Card key={s} className="rounded-2xl shadow-xs">
              <CardHeader><Skeleton className="h-5 w-32 bg-sage/10" /></CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full bg-sage/10" />
                <Skeleton className="h-4 w-5/6 bg-sage/10" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="space-y-6">
          {["r1", "r2"].map((s) => (
            <Card key={s} className="rounded-2xl shadow-xs">
              <CardHeader><Skeleton className="h-5 w-28 bg-sage/10" /></CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full bg-sage/10" />
                <Skeleton className="h-4 w-2/3 bg-sage/10" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}