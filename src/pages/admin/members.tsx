import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import { requireSessionSSP } from "@/lib/requireSessionSSP";
import { passCategoryForPackageType } from "@/lib/couponHelpers";

export const getServerSideProps = requireSessionSSP({ roles: ["admin"] });
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MetricCard } from "@/components/admin/MetricCard";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { SortableHeader } from "@/components/admin/sortable-table";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Users,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  Calendar,
  Mail,
  Phone,
  Trophy,
  Search,
  Plus,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { SEO } from "@/components/SEO";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination, usePagination } from "@/components/Pagination";
import { ListAvatar } from "@/components/admin/ListAvatar";
import { useSession } from "next-auth/react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogFooter,
} from "@/components/responsive/ResponsiveDialog";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface Member {
  id: string;
  userPackageId: string | null;
  name: string;
  email: string;
  phone: string;
  avatarUrl: string | null;
  package: string;
  credits: number;
  unlimited: boolean;
  expiryDate: string;
  totalClasses: number;
  lastVisit: string;
  lastVisitTs: number | null;
  status: "active" | "expiring" | "expired";
  /** Studio pass vs class pass vs no current pass */
  passCategory: "studio_pass" | "class_pass" | "none";
  /** Active = holding a package; inactive = lapsed 14+ days; grace = between */
  accountFilter: "active" | "inactive" | "grace";
  startDate: string | null;
}

interface HistoryRow {
  id: string;
  name: string;
  when: number | null;
  status: "attended" | "no_show" | "missed" | "upcoming";
  checkedIn: boolean;
  checkInOutcome: string | null;
}

interface PackageRow {
  id: string;
  name: string;
  purchasedAt: string | null;
  expiresAt: string | null;
  creditsRemaining: number | null;
  isActive: boolean;
  isUnlimited: boolean;
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

function formatRelativeDay(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  const diff = (Date.now() - d.getTime()) / 86400000;
  if (diff >= 0 && diff < 1) return "Today";
  if (diff >= 1 && diff < 2) return "Yesterday";
  if (diff < 0) return "Soon";
  return `${Math.floor(diff)} days ago`;
}

function deriveMemberStatus(
  expiry: Date,
  credits: number,
  unlimited: boolean
): Member["status"] {
  const now = new Date();
  if (expiry < now) return "expired";
  const days = (expiry.getTime() - now.getTime()) / 86400000;
  if (days <= 14 || (!unlimited && credits <= 2)) return "expiring";
  return "active";
}

function MembersLoadingSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>

      {/* Stats grid — mirrors MetricCard row */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <Card key={i} className="border-sage/20 bg-white-warm">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
              <Skeleton className="h-7 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Members table card */}
      <Card className="border-sage/20 bg-white-warm">
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-7 w-40" />
              <Skeleton className="h-4 w-64" />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Skeleton className="h-9 flex-1 sm:w-72 rounded-md" />
              <Skeleton className="h-9 w-32 shrink-0 rounded-md" />
            </div>
          </div>
          <div className="flex items-center gap-4 border-b border-sage/10 pb-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-16" />
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-sage/15 bg-white overflow-hidden">
            {/* Header row */}
            <div className="flex items-center gap-4 bg-sage/5 px-5 py-3 border-b border-sage/10">
              <Skeleton className="h-3 flex-1" />
              <Skeleton className="hidden md:block h-3 w-[180px]" />
              <Skeleton className="hidden md:block h-3 w-[100px]" />
              <Skeleton className="hidden lg:block h-3 w-[100px]" />
              <Skeleton className="hidden lg:block h-3 w-[120px]" />
              <Skeleton className="hidden md:block h-3 w-[140px]" />
              <Skeleton className="h-3 w-[60px]" />
            </div>
            {/* Body rows — mirror Member / Pass / Account / Classes / Last Visit / Status / Actions */}
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 px-5 py-4 border-b border-sage/10 last:border-b-0"
              >
                {/* Member: avatar + 3 lines */}
                <div className="flex flex-1 items-center gap-3 min-w-0">
                  <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                  <div className="min-w-0 space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                {/* Pass: badge + package line */}
                <div className="hidden md:block w-[180px] space-y-1.5">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-3 w-28" />
                </div>
                {/* Account */}
                <Skeleton className="hidden md:block h-4 w-14" />
                {/* Classes: icon + number */}
                <div className="hidden lg:flex w-[100px] items-center gap-1.5">
                  <Skeleton className="h-3.5 w-3.5 rounded" />
                  <Skeleton className="h-4 w-6" />
                </div>
                {/* Last Visit */}
                <Skeleton className="hidden lg:block h-4 w-[120px]" />
                {/* Status: badge + exp line */}
                <div className="hidden md:block w-[140px] space-y-1.5">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-3 w-16" />
                </div>
                {/* Actions */}
                <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminMembers() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [packageFilter, setPackageFilter] = useState<"all" | "studio" | "class" | "none">("all");
  const [accountStatusFilter, setAccountStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [members, setMembers] = useState<Member[]>([]);
  const [checkInsThisMonth, setCheckInsThisMonth] = useState(0);
  const [sortKey, setSortKey] = useState<"name" | "pass" | "account" | "classes" | "lastVisit" | "status" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyMember, setHistoryMember] = useState<Member | null>(null);
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);
  const [historyPackages, setHistoryPackages] = useState<PackageRow[]>([]);
  const [historyFood, setHistoryFood] = useState<FoodRow[]>([]);
  const [historyBadges, setHistoryBadges] = useState<BadgeRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySavingId, setHistorySavingId] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogPassType, setDialogPassType] = useState<"class_pass" | "studio_pass">("class_pass");
  const [selectedCredits, setSelectedCredits] = useState<number | null>(null);
  const [selectedDays, setSelectedDays] = useState<number | null>(null);
  const [newStartDate, setNewStartDate] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  // Offline payment recording
  // Add Member dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [addSubmitting, setAddSubmitting] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentReference, setPaymentReference] = useState<string>("");
  const [paymentProofUrl, setPaymentProofUrl] = useState<string>("");
  const [proofUploading, setProofUploading] = useState(false);
  const [dialogStep, setDialogStep] = useState<"config" | "payment">("config");
  const [submitting, setSubmitting] = useState(false);

  const { data: session, status } = useSession();

  const userRole = (session?.user as { role?: string })?.role;
  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      router.push("/admin/login");
      return;
    }
    if (status === "authenticated" && userRole !== "admin") {
      router.push("/admin/login");
      return;
    }
    if (status === "authenticated") {
      setLoading(true);
      void loadMembers().finally(() => setLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, userRole]);

  const filteredMembers = useMemo(() => {
    const qRaw = searchQuery.trim();
    const q = qRaw.toLowerCase();
    const filtered = members.filter((member) => {
      const matchesSearch =
        q === "" ||
        member.name.toLowerCase().includes(q) ||
        (member.email ?? "").toLowerCase().includes(q) ||
        (member.phone ?? "").toLowerCase().includes(qRaw);
      if (!matchesSearch) return false;
      if (packageFilter === "studio" && member.passCategory !== "studio_pass") return false;
      if (packageFilter === "class" && member.passCategory !== "class_pass") return false;
      if (packageFilter === "none" && member.passCategory !== "none") return false;
      if (accountStatusFilter === "active" && member.accountFilter !== "active") return false;
      if (accountStatusFilter === "inactive" && member.accountFilter !== "inactive") return false;
      return true;
    });

    if (sortKey) {
      const dir = sortDir === "asc" ? 1 : -1;
      const statusRank = { active: 0, expiring: 1, expired: 2 } as const;
      const passRank = { studio_pass: 0, class_pass: 1, none: 2 } as const;
      const accountRank = { active: 0, grace: 1, inactive: 2 } as const;
      filtered.sort((a, b) => {
        let cmp = 0;
        switch (sortKey) {
          case "name":
            cmp = a.name.localeCompare(b.name);
            break;
          case "pass":
            cmp = passRank[a.passCategory] - passRank[b.passCategory];
            break;
          case "account":
            cmp = accountRank[a.accountFilter] - accountRank[b.accountFilter];
            break;
          case "classes":
            cmp = a.totalClasses - b.totalClasses;
            break;
          case "lastVisit":
            cmp = (a.lastVisitTs ?? -Infinity) - (b.lastVisitTs ?? -Infinity);
            break;
          case "status":
            cmp = statusRank[a.status] - statusRank[b.status];
            break;
        }
        return cmp * dir;
      });
    }

    return filtered;
  }, [searchQuery, members, packageFilter, accountStatusFilter, sortKey, sortDir]);

  const loadMembers = async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/admin/members", { credentials: "include" });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const msg =
          typeof (errBody as { error?: string }).error === "string"
            ? (errBody as { error: string }).error
            : `HTTP ${res.status}`;
        setLoadError(`Could not load members: ${msg}`);
        setMembers([]);
        return;
      }
      const raw: unknown = await res.json();
      const payload = raw as { members?: unknown; checkInsThisMonth?: number };
      const list = Array.isArray(payload?.members)
        ? payload.members
        : Array.isArray(raw)
        ? raw
        : null;
      if (!list) {
        setLoadError("Members list response was invalid.");
        setMembers([]);
        return;
      }
      setCheckInsThisMonth(
        typeof payload?.checkInsThisMonth === "number" ? payload.checkInsThisMonth : 0,
      );
      const profiles = list as Array<{
        id: string;
        full_name: string | null;
        email: string;
        phone: string | null;
        avatar_url: string | null;
        pass_type: string | null;
        start_date: string | null;
        user_packages: Array<{
          id: string;
          is_active: boolean;
          pass_type: string | null;
          credits_remaining: number | null;
          expiration_date: string;
          package_type: { name: string; is_unlimited: boolean; type: string };
        }>;
        user_stats: {
          total_classes_attended?: number;
          last_class_date?: string | null;
        } | null;
        _count?: { bookings?: number };
      }>;

      const now = new Date();
      const fourteenAgo = new Date(now);
      fourteenAgo.setDate(fourteenAgo.getDate() - 14);

      const mapped: Member[] = profiles.map((p) => {
        const pkgs = p.user_packages ?? [];
        const activePkg = pkgs.find((up) => up.is_active && new Date(up.expiration_date) > now);
        const lastPkg = pkgs[0];
        const pkg = activePkg ?? lastPkg;
        const expiryRaw = pkg?.expiration_date ? new Date(pkg.expiration_date) : new Date();
        const expiryDate = expiryRaw.toISOString().slice(0, 10);

        const holdingPackage = Boolean(activePkg);
        const lastExp = lastPkg ? new Date(lastPkg.expiration_date) : null;
        let accountFilter: Member["accountFilter"] = "grace";
        if (holdingPackage) accountFilter = "active";
        else if (!lastExp || lastExp.getTime() < fourteenAgo.getTime()) accountFilter = "inactive";

        let passCategory: Member["passCategory"] = "none";
        if (pkg) {
          passCategory = passCategoryForPackageType(pkg.package_type);
        }

        const unlimited = Boolean(pkg?.package_type?.is_unlimited || passCategory === "studio_pass");
        const credits = pkg?.credits_remaining ?? 0;
        const stats = p.user_stats;

        return {
          id: p.id,
          userPackageId: activePkg?.id ?? lastPkg?.id ?? null,
          name: p.full_name || p.email || "Member",
          email: p.email,
          phone: p.phone || "—",
          avatarUrl: p.avatar_url ?? null,
          package: activePkg?.package_type?.name ?? lastPkg?.package_type?.name ?? "No active package",
          credits,
          unlimited,
          expiryDate,
          // Prefer real check-in count from bookings; fall back to user_stats if relation count missing.
          totalClasses: p._count?.bookings ?? stats?.total_classes_attended ?? 0,
          lastVisit: formatRelativeDay(stats?.last_class_date ?? null),
          lastVisitTs: stats?.last_class_date ? new Date(stats.last_class_date).getTime() : null,
          status: deriveMemberStatus(expiryRaw, credits, unlimited),
          passCategory,
          accountFilter,
          startDate: p.start_date ? new Date(p.start_date).toISOString().slice(0, 10) : null,
        };
      });

      setMembers(mapped);
    } catch {
      setLoadError("Could not load members. Check your connection and try again.");
      setMembers([]);
    }
  };

  const handleManageCredits = (member: Member) => {
    setSelectedMember(member);
    const pt = member.passCategory === "studio_pass" ? "studio_pass" : "class_pass";
    setDialogPassType(pt);
    setSelectedCredits(null);
    setSelectedDays(null);
    setNewStartDate(member.startDate ?? "");
    setPaymentMethod("");
    setPaymentAmount("");
    setPaymentReference("");
    setPaymentProofUrl("");
    setDialogStep("config");
    setDialogOpen(true);
  };

  const goToPaymentStep = () => {
    if (dialogPassType === "class_pass" && selectedCredits === null) {
      toast.error("Select number of classes first"); return;
    }
    if (dialogPassType === "studio_pass" && selectedDays === null) {
      toast.error("Select number of days first"); return;
    }
    setDialogStep("payment");
  };

  const uploadProof = async (file: File) => {
    setProofUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("purpose", "payment_proof");
      const res = await fetch("/api/upload", { method: "POST", credentials: "include", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.url) throw new Error(json.error ?? "Upload failed");
      setPaymentProofUrl(json.url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setProofUploading(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!selectedMember) return;
    if (!paymentMethod) { toast.error("Select a payment method"); return; }
    const rupees = Number(paymentAmount);
    if (!Number.isFinite(rupees) || rupees <= 0) { toast.error("Enter a valid amount in INR"); return; }
    try {
      const res = await fetch("/api/admin/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          user_id: selectedMember.id,
          user_package_id: selectedMember.userPackageId ?? undefined,
          method: paymentMethod,
          amount_paise: Math.round(rupees * 100),
          reference: paymentReference || undefined,
          proof_url: paymentProofUrl || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to record payment");
      }
      // Save start date if changed
      if (newStartDate && newStartDate !== (selectedMember.startDate ?? "")) {
        await patchMember({ profile_id: selectedMember.id, start_date: newStartDate });
      }

      // Apply the pass config in the same submit if a selection is made
      if ((dialogPassType === "class_pass" && selectedCredits !== null) ||
          (dialogPassType === "studio_pass" && selectedDays !== null)) {
        await handleApplyPassConfig();
      } else {
        await loadMembers();
        setSuccessMessage(`Payment recorded for ${selectedMember.name}`);
        setDialogOpen(false);
        setTimeout(() => setSuccessMessage(""), 3000);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not record payment");
    }
  };

  const patchMember = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/admin/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error ?? "Update failed");
    }
  };

  const handleApplyPassConfig = async () => {
    if (!selectedMember) return;
    try {
      const patches: Record<string, unknown>[] = [];

      if (dialogPassType === "class_pass" && selectedCredits !== null) {
        // No userPackageId → API auto-creates a UserPackage with the chosen credits.
        const delta = selectedMember.userPackageId
          ? selectedCredits - selectedMember.credits
          : selectedCredits;
        patches.push({
          profile_id: selectedMember.id,
          user_package_id: selectedMember.userPackageId ?? undefined,
          credits_delta: delta,
          pass_type: "class_pass",
        });
      } else if (dialogPassType === "studio_pass" && selectedDays !== null) {
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + selectedDays);
        const expiryStr = expiry.toISOString().slice(0, 10);
        patches.push({
          profile_id: selectedMember.id,
          user_package_id: selectedMember.userPackageId ?? undefined,
          expiration_date: expiryStr,
          pass_type: "studio_pass",
        });
      } else {
        toast.error("Select a value before applying.");
        return;
      }

      for (const p of patches) await patchMember(p);
      await loadMembers();
      setSuccessMessage(`Updated ${selectedMember.name}`);
      setDialogOpen(false);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update member");
    }
  };

  const handleUpdateStartDate = async () => {
    if (!selectedMember || !newStartDate) return;
    try {
      await patchMember({ profile_id: selectedMember.id, start_date: newStartDate });
      await loadMembers();
      setSuccessMessage(`Updated start date for ${selectedMember.name}`);
      setDialogOpen(false);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update start date");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-sage/10 text-sage border-sage/20 whitespace-nowrap font-body">Active</Badge>;
      case "expiring":
        return <Badge variant="outline" className="border-amber-500/20 text-amber-600 bg-amber-50 whitespace-nowrap font-body">Expiring</Badge>;
      case "expired":
        return <Badge variant="destructive" className="whitespace-nowrap font-body">Expired</Badge>;
      default:
        return null;
    }
  };

  const stats = {
    totalMembers: members.length,
    activeMembers: members.filter((m) => m.accountFilter === "active").length,
    expiringMembers: members.filter((m) => m.status === "expiring").length,
    inactiveLong: members.filter((m) => m.accountFilter === "inactive").length,
    studioPass: members.filter((m) => m.passCategory === "studio_pass").length,
    classPass: members.filter((m) => m.passCategory === "class_pass").length,
    checkInsThisMonth,
  };

  const openHistory = async (member: Member) => {
    setHistoryMember(member);
    setHistoryRows([]);
    setHistoryPackages([]);
    setHistoryFood([]);
    setHistoryBadges([]);
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/admin/members?id=${encodeURIComponent(member.id)}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      const data = await res.json();

      const pkgs = Array.isArray(data?.user_packages)
        ? (data.user_packages as Array<{
            id: string;
            purchase_date?: string | null;
            expiration_date?: string | null;
            credits_remaining?: number | null;
            is_active?: boolean;
            package_type?: { name?: string | null; is_unlimited?: boolean } | null;
          }>)
        : [];
      setHistoryPackages(
        pkgs.map((p) => ({
          id: p.id,
          name: p.package_type?.name ?? "Package",
          purchasedAt: p.purchase_date ?? null,
          expiresAt: p.expiration_date ?? null,
          creditsRemaining: p.credits_remaining ?? null,
          isActive: !!p.is_active && (p.expiration_date ? new Date(p.expiration_date) > new Date() : true),
          isUnlimited: !!p.package_type?.is_unlimited,
        })),
      );

      const food = Array.isArray(data?.cafe_orders)
        ? (data.cafe_orders as Array<{
            id: string;
            quantity?: number | null;
            order_date?: string | null;
            status?: string | null;
            cafe_item?: { name?: string | null } | null;
          }>)
        : [];
      setHistoryFood(
        food.map((o) => ({
          id: o.id,
          item: o.cafe_item?.name ?? "Item",
          quantity: o.quantity ?? 1,
          orderedAt: o.order_date ?? null,
          status: o.status ?? "—",
        })),
      );

      const badges = Array.isArray(data?.user_badges)
        ? (data.user_badges as Array<{
            id: string;
            badge_name?: string | null;
            badge_description?: string | null;
            icon?: string | null;
            earned_at?: string | null;
          }>)
        : [];
      setHistoryBadges(
        badges.map((b) => ({
          id: b.id,
          name: b.badge_name ?? "Badge",
          description: b.badge_description ?? null,
          icon: b.icon ?? null,
          earnedAt: b.earned_at ?? null,
        })),
      );

      const bookings = Array.isArray(data?.bookings)
        ? (data.bookings as Array<{
            id: string;
            class_name?: string | null;
            class_time?: string | null;
            booking_date?: string | null;
            checked_in?: boolean;
            check_in_outcome?: string | null;
            class_schedule?: {
              start_time?: string | null;
              class_model?: { name?: string | null } | null;
            } | null;
          }>)
        : [];
      const rows: HistoryRow[] = bookings.map((b) => {
        const startRaw = b.class_schedule?.start_time ?? b.class_time ?? b.booking_date ?? null;
        const when = startRaw ? new Date(startRaw).getTime() : null;
        const name = b.class_schedule?.class_model?.name ?? b.class_name ?? "Class";
        let status: HistoryRow["status"];
        if (b.checked_in) status = "attended";
        else if (b.check_in_outcome === "no_show") status = "no_show";
        else if (when != null && when < Date.now()) status = "missed";
        else status = "upcoming";
        return { id: b.id, name, when, status, checkedIn: !!b.checked_in, checkInOutcome: b.check_in_outcome ?? null };
      });
      rows.sort((a, b) => (b.when ?? 0) - (a.when ?? 0));
      setHistoryRows(rows);
    } catch {
      setHistoryRows([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const applyHistoryOutcome = async (
    rowId: string,
    outcome: "on_time" | "late" | "no_show" | "not_checked_in",
  ) => {
    setHistorySavingId(rowId);
    try {
      const res = await fetch("/api/admin/manual-check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: rowId, outcome }),
      });
      if (!res.ok) throw new Error();
      setHistoryRows((rows) =>
        rows.map((r) => {
          if (r.id !== rowId) return r;
          const checkedIn = outcome === "on_time" || outcome === "late";
          let status: HistoryRow["status"];
          if (checkedIn) status = "attended";
          else if (outcome === "no_show") status = "no_show";
          else status = r.when != null && r.when < Date.now() ? "missed" : "upcoming";
          return {
            ...r,
            checkedIn,
            checkInOutcome: outcome === "not_checked_in" ? null : outcome,
            status,
          };
        }),
      );
    } catch {
      toast.error("Could not update status");
    } finally {
      setHistorySavingId(null);
    }
  };

  type MemberSortKey = "name" | "pass" | "account" | "classes" | "lastVisit" | "status";
  const toggleSort = (key: MemberSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" || key === "pass" || key === "account" ? "asc" : "desc");
    }
  };

  const membersPg = usePagination(
    filteredMembers,
    10,
    `${searchQuery}|${packageFilter}|${accountStatusFilter}|${sortKey}|${sortDir}`,
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-cream via-cream to-sage/10">
        <main className="min-h-screen">
          <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-8">
            <MembersLoadingSkeleton />
          </div>
        </main>
      </div>
    );
  }

  return (
    <>
      <SEO 
        title="Member Management - Admin"
        description="Manage members, classes, and subscriptions"
      />
      
      <div className="min-h-screen bg-linear-to-br from-cream via-cream to-sage/10">
        
        <main className="min-h-screen">
          <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-8">
            <AdminPageHeader
              title="Member Management"
              subtitle="Manage classes, subscriptions, and member data"
            />

            {loadError && (
              <Card className="border-terracotta/30 bg-terracotta/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 text-terracotta">
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    <p className="font-body text-charcoal">{loadError}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Success Message */}
            {successMessage && (
              <Card className="border-sage/20 bg-sage/10 animate-in slide-in-from-top duration-600">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 text-sage">
                    <CheckCircle2 className="h-5 w-5" />
                    <p className="font-body">{successMessage}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4">
              <MetricCard label="Total Members" value={stats.totalMembers} icon={Users} tone="sage" />
              <MetricCard label="Active" value={stats.activeMembers} icon={CheckCircle2} tone="sage" hint="Holding an active pass" />
              <MetricCard label="Expiring" value={stats.expiringMembers} icon={AlertTriangle} tone="amber" hint="≤14 days left" />
              <MetricCard label="Inactive" value={stats.inactiveLong} icon={AlertTriangle} tone="charcoal" hint="No pass 14d+" />
              <MetricCard label="Studio Pass" value={stats.studioPass} icon={Trophy} tone="sage" hint="Active studio passes" />
              <MetricCard label="Class Pass" value={stats.classPass} icon={CreditCard} tone="sage" hint="Active class passes" />
              <MetricCard label="Check-ins (mo)" value={stats.checkInsThisMonth} icon={Calendar} tone="amber" hint="This month" />
            </div>

            {/* Members Table */}
            <Card className="border-sage/20 bg-white-warm">
              <CardHeader className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="font-display text-2xl text-charcoal">
                      Members <span className="font-body text-base text-charcoal/40">({filteredMembers.length})</span>
                    </CardTitle>
                    <CardDescription className="font-body text-charcoal/60">
                      Click Manage to update classes and subscription
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-72">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-charcoal/40" />
                      <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search name, email, phone…"
                        className="h-9 pl-9 border-sage/20 focus:border-sage font-body"
                      />
                    </div>
                    <Button
                      onClick={() => {
                        setAddName("");
                        setAddEmail("");
                        setAddPhone("");
                        setAddPassword("");
                        setAddError(null);
                        setAddOpen(true);
                      }}
                      variant="sage"
                      className="h-9 shrink-0"
                    >
                      <Plus className="h-4 w-4 mr-1.5" />
                      Add Member
                    </Button>
                  </div>
                </div>

                {/* Primary filter: tab strip with underline */}
                <div className="flex items-center justify-between flex-wrap gap-3 border-b border-sage/10">
                  <div className="flex items-center gap-1 -mb-px overflow-x-auto">
                    {[
                      { v: "all", l: "All" },
                      { v: "studio", l: "Studio" },
                      { v: "class", l: "Class pass" },
                      { v: "none", l: "No pass" },
                    ].map((o) => {
                      const active = packageFilter === o.v;
                      return (
                        <button
                          key={o.v}
                          type="button"
                          onClick={() => setPackageFilter(o.v as typeof packageFilter)}
                          className={`relative px-4 py-2 font-body text-sm whitespace-nowrap transition-colors ${
                            active ? "text-sage" : "text-charcoal/60 hover:text-charcoal"
                          }`}
                        >
                          {o.l}
                          {active && (
                            <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-sage rounded-full" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2 pb-2 flex-wrap">
                    <div className="flex items-center gap-1 rounded-full bg-cream/50 p-1 border border-sage/15">
                      {[
                        { v: "all", l: "All" },
                        { v: "active", l: "Active" },
                        { v: "inactive", l: "Inactive" },
                      ].map((o) => (
                        <button
                          key={o.v}
                          type="button"
                          onClick={() => setAccountStatusFilter(o.v as typeof accountStatusFilter)}
                          className={`px-3 h-7 rounded-full font-body text-xs transition-colors ${
                            accountStatusFilter === o.v
                              ? "bg-sage text-white shadow-xs"
                              : "text-charcoal/60 hover:text-charcoal hover:bg-sage/10"
                          }`}
                        >
                          {o.l}
                        </button>
                      ))}
                    </div>
                    {(packageFilter !== "all" || accountStatusFilter !== "all" || searchQuery) && (
                      <button
                        type="button"
                        onClick={() => {
                          setPackageFilter("all");
                          setAccountStatusFilter("all");
                          setSearchQuery("");
                        }}
                        className="font-body text-xs text-terracotta hover:underline"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveTable>
                <div className="rounded-xl border border-sage/15 bg-white overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-sage/5 hover:bg-sage/5 border-sage/10">
                        <SortableHeader sortKey="name" active={sortKey} dir={sortDir} onToggle={toggleSort}>Member</SortableHeader>
                        <SortableHeader sortKey="pass" active={sortKey} dir={sortDir} onToggle={toggleSort} className="w-[180px]">Pass</SortableHeader>
                        <SortableHeader sortKey="account" active={sortKey} dir={sortDir} onToggle={toggleSort} className="w-[100px]">Account</SortableHeader>
                        <SortableHeader sortKey="classes" active={sortKey} dir={sortDir} onToggle={toggleSort} className="w-[100px]">Classes</SortableHeader>
                        <SortableHeader sortKey="lastVisit" active={sortKey} dir={sortDir} onToggle={toggleSort} className="w-[120px]">Last Visit</SortableHeader>
                        <SortableHeader sortKey="status" active={sortKey} dir={sortDir} onToggle={toggleSort} className="w-[140px]">Status</SortableHeader>
                        <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3 w-[60px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {membersPg.pageItems.map((member) => (
                        <TableRow key={member.id} className="border-sage/10 hover:bg-sage/5">
                          <TableCell className="px-5 py-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <ListAvatar name={member.name} src={member.avatarUrl} size="md" />
                              <div className="min-w-0">
                                <div className="font-body font-medium text-charcoal truncate">{member.name}</div>
                                <div className="font-body text-xs text-charcoal/60 truncate">{member.email}</div>
                                <div className="font-body text-xs text-charcoal/50 truncate">{member.phone}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="px-5 py-4">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {member.passCategory === "studio_pass" ? (
                                <Badge className="bg-sage text-white border-transparent font-body">
                                  Studio
                                </Badge>
                              ) : member.passCategory === "class_pass" ? (
                                <Badge variant="outline" className="border-sage/30 text-sage bg-sage/5 font-body">
                                  Class pass
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="border-charcoal/15 text-charcoal/40 bg-cream/30 font-body">
                                  No pass
                                </Badge>
                              )}
                              {member.unlimited && (
                                <Badge className="bg-terracotta/10 text-terracotta border-terracotta/30 font-body">
                                  ∞ Unlimited
                                </Badge>
                              )}
                            </div>
                            <div className="font-body text-xs text-charcoal/50 mt-1 truncate" title={member.package}>
                              {member.package}
                            </div>
                          </TableCell>
                          <TableCell className="px-5 py-4">
                            <span className={`font-body text-sm font-medium ${
                              member.accountFilter === "active"
                                ? "text-sage"
                                : member.accountFilter === "inactive"
                                ? "text-charcoal/40"
                                : "text-amber-600"
                            }`}>
                              {member.accountFilter === "active"
                                ? "Active"
                                : member.accountFilter === "inactive"
                                ? "Inactive"
                                : "Lapsed"}
                            </span>
                          </TableCell>
                          <TableCell className="px-5 py-4">
                            <div className="flex items-center gap-1.5">
                              <Trophy className="h-3.5 w-3.5 text-sage/60" />
                              <span className="font-body font-medium text-charcoal tabular-nums">{member.totalClasses}</span>
                            </div>
                          </TableCell>
                          <TableCell className="px-5 py-4">
                            <span className="font-body text-sm text-charcoal/70">{member.lastVisit}</span>
                          </TableCell>
                          <TableCell className="px-5 py-4">
                            {getStatusBadge(member.status)}
                            <div className="font-body text-xs text-charcoal/50 mt-1">
                              Exp {new Date(member.expiryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                            </div>
                          </TableCell>
                          <TableCell className="px-5 py-4 text-right">
                            <DropdownMenu modal={false}>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-charcoal/60 hover:bg-sage/10 hover:text-charcoal"
                                  aria-label="Member actions"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem
                                  onSelect={() => openHistory(member)}
                                  className="cursor-pointer gap-2"
                                >
                                  <Calendar className="h-3.5 w-3.5" />
                                  Manage
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={!(member.status === "expired" || member.passCategory === "none")}
                                  onSelect={() => handleManageCredits(member)}
                                  className="cursor-pointer gap-2"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                  Assign pass
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                </ResponsiveTable>
                <Pagination
                  page={membersPg.page}
                  total={membersPg.total}
                  onChange={membersPg.setPage}
                />
              </CardContent>
            </Card>

          </div>
        </main>
      </div>

      {/* Add Member Dialog */}
      <ResponsiveDialog open={addOpen} onOpenChange={setAddOpen}>
        <ResponsiveDialogContent className="sm:max-w-[440px] bg-white border-sage/20">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="font-display text-2xl text-charcoal">Add Member</ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="font-body text-charcoal/60">
              Create a new member account. They can sign in with the email + password.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="font-body text-charcoal/80 mb-1.5 block text-sm">Full name</Label>
              <Input
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="Jane Doe"
                className="border-sage/20 focus:border-sage font-body"
              />
            </div>
            <div>
              <Label className="font-body text-charcoal/80 mb-1.5 block text-sm">Email</Label>
              <Input
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="jane@example.com"
                className="border-sage/20 focus:border-sage font-body"
              />
            </div>
            <div>
              <Label className="font-body text-charcoal/80 mb-1.5 block text-sm">Phone</Label>
              <Input
                value={addPhone}
                onChange={(e) => setAddPhone(e.target.value)}
                placeholder="+91 9876543210"
                className="border-sage/20 focus:border-sage font-body"
              />
            </div>
            <div>
              <Label className="font-body text-charcoal/80 mb-1.5 block text-sm">Temporary password</Label>
              <Input
                type="text"
                value={addPassword}
                onChange={(e) => setAddPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="border-sage/20 focus:border-sage font-body"
              />
            </div>
            {addError && (
              <p className="text-sm font-body text-terracotta">{addError}</p>
            )}
          </div>
          <ResponsiveDialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddOpen(false)}
              className="border-charcoal/20 text-charcoal hover:bg-charcoal/5 font-body"
              disabled={addSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                setAddError(null);
                if (!addEmail || !addPassword) {
                  setAddError("Email and password are required.");
                  return;
                }
                if (addPassword.length < 8) {
                  setAddError("Password must be at least 8 characters.");
                  return;
                }
                setAddSubmitting(true);
                try {
                  const res = await fetch("/api/auth/signup", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      email: addEmail.trim(),
                      password: addPassword,
                      full_name: addName.trim() || undefined,
                      phone: addPhone.trim() || undefined,
                    }),
                  });
                  const body = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    setAddError((body as { error?: string }).error ?? `Signup failed (HTTP ${res.status}).`);
                    return;
                  }
                  setAddOpen(false);
                  setSuccessMessage(`Member ${addEmail} created`);
                  await loadMembers();
                  setTimeout(() => setSuccessMessage(""), 3000);
                } catch (err) {
                  setAddError(err instanceof Error ? err.message : "Could not create member.");
                } finally {
                  setAddSubmitting(false);
                }
              }}
              disabled={addSubmitting}
              variant="sage"
            >
              {addSubmitting ? "Adding…" : "Add Member"}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {/* Manage Member Dialog — 2-step: pass config → payment */}
      <ResponsiveDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ResponsiveDialogContent className="sm:max-w-[480px] bg-white border-sage/20">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="font-display text-2xl text-charcoal">
              Manage {selectedMember?.name}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="font-body text-charcoal/60">
              {dialogStep === "config" ? "Step 1 of 2 — pass configuration" : "Step 2 of 2 — payment"}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          {/* Step indicator */}
          <div className="flex items-center gap-2 px-1">
            <div className={`h-1.5 flex-1 rounded-full ${dialogStep === "config" ? "bg-sage" : "bg-sage"}`} />
            <div className={`h-1.5 flex-1 rounded-full ${dialogStep === "payment" ? "bg-sage" : "bg-sage/20"}`} />
          </div>

          {dialogStep === "config" && (
            <div className="space-y-6 py-4">
              <div>
                <Label className="font-body text-charcoal/80 mb-3 block">Pass Type</Label>
                <div className="flex gap-2">
                  {(["class_pass", "studio_pass"] as const).map((pt) => (
                    <button
                      key={pt}
                      type="button"
                      onClick={() => { setDialogPassType(pt); setSelectedCredits(null); setSelectedDays(null); }}
                      className={`flex-1 py-2.5 rounded-full text-sm font-body font-medium border transition-colors ${
                        dialogPassType === pt
                          ? "bg-sage text-white border-sage"
                          : "bg-white text-charcoal/70 border-charcoal/20 hover:border-sage/40"
                      }`}
                    >
                      {pt === "class_pass" ? "Class Pass" : "Studio Pass"}
                    </button>
                  ))}
                </div>
              </div>

              {dialogPassType === "class_pass" && (
                <div>
                  <Label className="font-body text-charcoal/80 mb-3 block">
                    Classes Remaining
                    {selectedMember && (
                      <span className="ml-2 text-charcoal/40 font-normal">
                        (currently {selectedMember.credits})
                      </span>
                    )}
                  </Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[1, 4, 8, 12].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setSelectedCredits(n)}
                        className={`h-14 rounded-xl text-base font-display border transition-colors flex items-center justify-center ${
                          selectedCredits === n
                            ? "bg-sage text-white border-sage"
                            : "bg-sage/5 text-charcoal border-sage/20 hover:bg-sage/10"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {dialogPassType === "studio_pass" && (
                <div>
                  <Label className="font-body text-charcoal/80 mb-3 block">
                    Days Remaining (from today)
                  </Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[30, 90, 180, 365].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setSelectedDays(d)}
                        className={`h-14 rounded-xl text-base font-display border transition-colors flex items-center justify-center ${
                          selectedDays === d
                            ? "bg-sage text-white border-sage"
                            : "bg-sage/5 text-charcoal border-sage/20 hover:bg-sage/10"
                        }`}
                      >
                        {d}d
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-sage/10 pt-4">
                <Label className="font-body text-charcoal/80 mb-2 block">Member Start Date</Label>
                <Input
                  type="date"
                  value={newStartDate}
                  onChange={(e) => setNewStartDate(e.target.value)}
                  className="h-11 border-charcoal/20 focus:border-sage font-body w-full"
                />
                <p className="font-body text-xs text-charcoal/50 mt-1">Saved together with payment at the next step.</p>
              </div>
            </div>
          )}

          {dialogStep === "payment" && (
            <div className="space-y-4 py-4">
              {/* Summary of selected pass */}
              <div className="rounded-xl bg-sage/5 border border-sage/20 p-3">
                <div className="font-body text-xs text-charcoal/60 uppercase tracking-wide mb-1">Selected Pass</div>
                <div className="font-display text-lg text-charcoal">
                  {dialogPassType === "class_pass"
                    ? `Class Pass — ${selectedCredits} classes`
                    : `Studio Pass — ${selectedDays} days`}
                </div>
              </div>

              <div>
                <Label className="font-body text-charcoal/70 text-sm mb-2 block">Choose Payment Method</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { v: "razorpay_online", l: "Razorpay (Online)" },
                    { v: "pine_lab_card", l: "Pine Lab Card" },
                    { v: "pine_lab_upi", l: "Pine Lab UPI" },
                    { v: "direct_upi", l: "Direct UPI" },
                    { v: "razorpay_completed", l: "Razorpay Completed" },
                    { v: "cash", l: "Cash" },
                  ].map((m) => (
                    <button
                      key={m.v}
                      type="button"
                      onClick={() => setPaymentMethod(m.v)}
                      className={`h-11 rounded-lg text-sm font-body border transition-colors flex items-center justify-center px-2 ${
                        paymentMethod === m.v
                          ? "bg-sage text-white border-sage"
                          : "bg-sage/5 text-charcoal border-sage/20 hover:bg-sage/10"
                      }`}
                    >
                      {m.l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="font-body text-charcoal/70 text-sm mb-1 block">Amount (₹)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="h-11 border-charcoal/20 focus:border-sage font-body"
                    placeholder="e.g. 6015"
                  />
                </div>
                <div>
                  <Label className="font-body text-charcoal/70 text-sm mb-1 block">Reference (opt.)</Label>
                  <Input
                    type="text"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    className="h-11 border-charcoal/20 focus:border-sage font-body"
                    placeholder="txn id / slip #"
                  />
                </div>
              </div>

              <div>
                <Label className="font-body text-charcoal/70 text-sm mb-1 block">
                  Proof of Payment (optional)
                </Label>
                <Input
                  type="file"
                  accept="image/*"
                  disabled={proofUploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadProof(f);
                  }}
                  className="h-11 border-charcoal/20 focus:border-sage font-body file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-sage/10 file:text-sage"
                />
                {proofUploading && (
                  <p className="font-body text-xs text-charcoal/50 mt-1">Uploading…</p>
                )}
                {paymentProofUrl && !proofUploading && (
                  <p className="font-body text-xs text-sage mt-1">
                    Proof uploaded ✓ <a href={paymentProofUrl} target="_blank" rel="noreferrer" className="underline">view</a>
                  </p>
                )}
              </div>
            </div>
          )}

          <ResponsiveDialogFooter className="gap-2 sm:gap-2">
            {dialogStep === "config" ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  className="border-charcoal/20 text-charcoal hover:bg-charcoal/5 font-body"
                >
                  Cancel
                </Button>
                <Button
                  onClick={goToPaymentStep}
                  variant="sage"
                >
                  Continue
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => setDialogStep("config")}
                  className="border-charcoal/20 text-charcoal hover:bg-charcoal/5 font-body"
                >
                  Back
                </Button>
                <Button
                  onClick={async () => {
                    setSubmitting(true);
                    try { await handleRecordPayment(); } finally { setSubmitting(false); }
                  }}
                  disabled={proofUploading || submitting}
                  variant="sage"
                >
                  {submitting ? "Processing…" : "Record Payment & Apply Pass"}
                </Button>
              </>
            )}
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {/* Member Profile Dialog */}
      <ResponsiveDialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <ResponsiveDialogContent className="sm:max-w-[640px] bg-white border-sage/20">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="font-display text-2xl text-charcoal">Manage Member</ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="font-body text-charcoal/60">
              {historyMember?.name ?? "Member"}
              {historyMember?.email ? ` · ${historyMember.email}` : ""}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          {historyLoading ? (
            <p className="font-body text-sm text-charcoal/50 py-10 text-center">Loading…</p>
          ) : (
            <Tabs defaultValue="classes" className="w-full">
              <TabsList className="grid grid-cols-4 w-full bg-cream/50">
                <TabsTrigger value="classes" className="font-body text-xs data-[state=active]:bg-sage data-[state=active]:text-white">
                  Classes ({historyRows.length})
                </TabsTrigger>
                <TabsTrigger value="packages" className="font-body text-xs data-[state=active]:bg-sage data-[state=active]:text-white">
                  Packages ({historyPackages.length})
                </TabsTrigger>
                <TabsTrigger value="food" className="font-body text-xs data-[state=active]:bg-sage data-[state=active]:text-white">
                  Food ({historyFood.length})
                </TabsTrigger>
                <TabsTrigger value="badges" className="font-body text-xs data-[state=active]:bg-sage data-[state=active]:text-white">
                  Badges ({historyBadges.length})
                </TabsTrigger>
              </TabsList>

              <div className="max-h-[55vh] overflow-y-auto mt-3 -mx-1 px-1">
                {/* Classes */}
                <TabsContent value="classes" className="mt-0">
                  {historyRows.length === 0 ? (
                    <p className="font-body text-sm text-charcoal/50 py-8 text-center">No class history yet.</p>
                  ) : (
                    <ul className="divide-y divide-sage/10">
                      {historyRows.map((row) => (
                        <li key={row.id} className="flex items-center justify-between gap-3 py-3">
                          <div className="min-w-0">
                            <div className="font-body font-medium text-charcoal truncate">{row.name}</div>
                            <div className="font-body text-xs text-charcoal/50">
                              {row.when
                                ? new Date(row.when).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })
                                : "—"}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {historySavingId === row.id && (
                              <Spinner className="size-3" />
                            )}
                            <Select
                              value={
                                row.checkedIn
                                  ? row.checkInOutcome === "late" ? "late" : "on_time"
                                  : row.checkInOutcome === "no_show" ? "no_show" : "not_checked_in"
                              }
                              onValueChange={(v) => applyHistoryOutcome(row.id, v as "on_time" | "late" | "no_show" | "not_checked_in")}
                              disabled={historySavingId === row.id}
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
                        </li>
                      ))}
                    </ul>
                  )}
                </TabsContent>

                {/* Packages */}
                <TabsContent value="packages" className="mt-0">
                  {historyPackages.length === 0 ? (
                    <p className="font-body text-sm text-charcoal/50 py-8 text-center">No packages purchased.</p>
                  ) : (
                    <ul className="divide-y divide-sage/10">
                      {historyPackages.map((p) => (
                        <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                          <div className="min-w-0">
                            <div className="font-body font-medium text-charcoal truncate">{p.name}</div>
                            <div className="font-body text-xs text-charcoal/50">
                              Purchased {p.purchasedAt ? new Date(p.purchasedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                              {p.expiresAt ? ` · expires ${new Date(p.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-body text-xs text-charcoal/60">
                              {p.isUnlimited ? "Unlimited" : `${p.creditsRemaining ?? 0} left`}
                            </span>
                            <Badge
                              variant="outline"
                              className={p.isActive ? "border-sage/30 text-sage bg-sage/5 font-body" : "border-charcoal/15 text-charcoal/40 bg-cream/30 font-body"}
                            >
                              {p.isActive ? "Active" : "Expired"}
                            </Badge>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </TabsContent>

                {/* Food */}
                <TabsContent value="food" className="mt-0">
                  {historyFood.length === 0 ? (
                    <p className="font-body text-sm text-charcoal/50 py-8 text-center">No café orders.</p>
                  ) : (
                    <ul className="divide-y divide-sage/10">
                      {historyFood.map((o) => (
                        <li key={o.id} className="flex items-center justify-between gap-3 py-3">
                          <div className="min-w-0">
                            <div className="font-body font-medium text-charcoal truncate">
                              {o.item} <span className="text-charcoal/50 font-normal">× {o.quantity}</span>
                            </div>
                            <div className="font-body text-xs text-charcoal/50">
                              {o.orderedAt ? new Date(o.orderedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                            </div>
                          </div>
                          <Badge variant="outline" className="border-charcoal/15 text-charcoal/60 font-body capitalize">{o.status}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </TabsContent>

                {/* Badges */}
                <TabsContent value="badges" className="mt-0">
                  {historyBadges.length === 0 ? (
                    <p className="font-body text-sm text-charcoal/50 py-8 text-center">No badges earned yet.</p>
                  ) : (
                    <ul className="divide-y divide-sage/10">
                      {historyBadges.map((b) => (
                        <li key={b.id} className="flex items-center gap-3 py-3">
                          <span className="text-2xl leading-none">{b.icon || "🏆"}</span>
                          <div className="min-w-0">
                            <div className="font-body font-medium text-charcoal truncate">{b.name}</div>
                            {b.description && (
                              <div className="font-body text-xs text-charcoal/50 truncate">{b.description}</div>
                            )}
                            <div className="font-body text-xs text-charcoal/40">
                              {b.earnedAt ? `Earned ${new Date(b.earnedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </TabsContent>
              </div>
            </Tabs>
          )}
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}
