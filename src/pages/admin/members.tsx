import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import { requireSessionSSP } from "@/lib/requireSessionSSP";
import { passCategoryForPackageType } from "@/lib/couponHelpers";

export const getServerSideProps = requireSessionSSP({ roles: ["admin"] });
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/admin/MetricCard";
import { MemberTable, type MemberTableMember } from "@/components/admin/MemberTable";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FilterBar, FilterSearch, FilterSelect, useFilterState } from "@/components/filters";
import {
  Users,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  Calendar,
  Trophy,
  Plus,
} from "lucide-react";
import { SEO } from "@/components/SEO";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination, usePagination } from "@/components/Pagination";
import { useSession } from "next-auth/react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogFooter,
} from "@/components/responsive/ResponsiveDialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  usePassPaymentState,
  PassConfigSection,
  PaymentSection,
  validateConfig,
  validatePayment,
  onboardMember,
} from "@/components/admin/managePass";

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
          <div className="rounded-xl border border-sage/15 bg-white-warm overflow-hidden">
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
  const f = useFilterState(
    { search: "", pkg: "all", account: "all" },
    { urlSync: true },
  );
  const [members, setMembers] = useState<Member[]>([]);
  const [checkInsThisMonth, setCheckInsThisMonth] = useState(0);
  const [sortKey, setSortKey] = useState<"name" | "pass" | "account" | "classes" | "lastVisit" | "status" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [successMessage, setSuccessMessage] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  // Add Member dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [assignPass, setAssignPass] = useState(false);
  const pass = usePassPaymentState();

  const { data: session, status } = useSession();

  const userRole = (session?.user as { role?: string })?.role;
  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status === "authenticated" && userRole !== "admin") {
      router.push("/login");
      return;
    }
    if (status === "authenticated") {
      setLoading(true);
      void loadMembers().finally(() => setLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, userRole]);

  const filteredMembers = useMemo(() => {
    const qRaw = f.values.search.trim();
    const q = qRaw.toLowerCase();
    const filtered = members.filter((member) => {
      const matchesSearch =
        q === "" ||
        member.name.toLowerCase().includes(q) ||
        (member.email ?? "").toLowerCase().includes(q) ||
        (member.phone ?? "").toLowerCase().includes(qRaw);
      if (!matchesSearch) return false;
      if (f.values.pkg === "studio" && member.passCategory !== "studio_pass") return false;
      if (f.values.pkg === "class" && member.passCategory !== "class_pass") return false;
      if (f.values.pkg === "none" && member.passCategory !== "none") return false;
      if (f.values.account === "active" && member.accountFilter !== "active") return false;
      if (f.values.account === "inactive" && member.accountFilter !== "inactive") return false;
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
  }, [f.values.search, f.values.pkg, f.values.account, members, sortKey, sortDir]);

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

  const stats = {
    totalMembers: members.length,
    activeMembers: members.filter((m) => m.accountFilter === "active").length,
    expiringMembers: members.filter((m) => m.status === "expiring").length,
    inactiveLong: members.filter((m) => m.accountFilter === "inactive").length,
    studioPass: members.filter((m) => m.passCategory === "studio_pass").length,
    classPass: members.filter((m) => m.passCategory === "class_pass").length,
    checkInsThisMonth,
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
    `${f.values.search}|${f.values.pkg}|${f.values.account}|${sortKey}|${sortDir}`,
  );

  const accountLabelFor = (f: Member["accountFilter"]) =>
    f === "active" ? "Active" : f === "inactive" ? "Inactive" : "Lapsed";

  const tableMembers: MemberTableMember[] = membersPg.pageItems.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    phone: m.phone,
    avatarUrl: m.avatarUrl,
    passLabel: m.package,
    passCategory: m.passCategory,
    unlimited: m.unlimited,
    credits: m.credits,
    totalClasses: m.totalClasses,
    lastVisit: m.lastVisit,
    status: m.status,
    accountLabel: accountLabelFor(m.accountFilter),
  }));

  async function handleAddSubmit() {
    setAddError(null);
    const email = addEmail.trim();
    if (!email || !addPassword) {
      setAddError("Email and password are required.");
      return;
    }
    if (addPassword.length < 8) {
      setAddError("Password must be at least 8 characters.");
      return;
    }
    if (assignPass) {
      const cfgErr = validateConfig(pass);
      if (cfgErr) {
        setAddError(cfgErr);
        return;
      }
      const payErr = validatePayment(pass);
      if (payErr) {
        setAddError(payErr);
        return;
      }
    }
    setAddSubmitting(true);
    try {
      // Single transactional call: account + pass + payment commit together or
      // not at all — no orphaned account on a mid-sequence failure.
      await onboardMember(
        { email, password: addPassword, full_name: addName, phone: addPhone },
        pass,
        assignPass,
      );
      setAddOpen(false);
      setSuccessMessage(assignPass ? `Member ${email} created with pass` : `Member ${email} created`);
      await loadMembers();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Could not create member.");
    } finally {
      setAddSubmitting(false);
    }
  }

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
              <MetricCard label="Expiring" value={stats.expiringMembers} icon={AlertTriangle} tone="clay" hint="≤14 days left" />
              <MetricCard label="Inactive" value={stats.inactiveLong} icon={AlertTriangle} tone="charcoal" hint="No pass 14d+" />
              <MetricCard label="Studio Pass" value={stats.studioPass} icon={Trophy} tone="sage" hint="Active studio passes" />
              <MetricCard label="Class Pass" value={stats.classPass} icon={CreditCard} tone="sage" hint="Active class passes" />
              <MetricCard label="Check-ins (mo)" value={stats.checkInsThisMonth} icon={Calendar} tone="clay" hint="This month" />
            </div>

            {/* Members Table */}
            <Card className="border-sage/20 bg-white-warm">
              <CardHeader className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="font-body font-semibold text-2xl text-charcoal">
                      Members <span className="font-body text-base text-charcoal/40">({filteredMembers.length})</span>
                    </CardTitle>
                    <CardDescription className="font-body text-charcoal/60">
                      Click a member to view their full profile and manage their pass
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => {
                      setAddName("");
                      setAddEmail("");
                      setAddPhone("");
                      setAddPassword("");
                      setAddError(null);
                      setAssignPass(false);
                      pass.reset();
                      pass.loadDefaults();
                      setAddOpen(true);
                    }}
                    variant="sage"
                    className="h-9 shrink-0"
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add Member
                  </Button>
                </div>

                <FilterBar reset={f.isActive ? f.reset : undefined} className="mb-4">
                  <FilterSearch
                    value={f.values.search}
                    onChange={(v) => f.set("search", v)}
                    placeholder="Search name, email, phone…"
                  />
                  <FilterSelect
                    ariaLabel="Package"
                    placeholder="Package"
                    value={f.values.pkg}
                    onChange={(v) => f.set("pkg", v)}
                    options={[
                      { value: "all", label: "All packages" },
                      { value: "studio", label: "Studio" },
                      { value: "class", label: "Class pass" },
                      { value: "none", label: "No pass" },
                    ]}
                  />
                  <FilterSelect
                    ariaLabel="Account status"
                    placeholder="Account"
                    value={f.values.account}
                    onChange={(v) => f.set("account", v)}
                    options={[
                      { value: "all", label: "All accounts" },
                      { value: "active", label: "Active" },
                      { value: "inactive", label: "Inactive" },
                    ]}
                  />
                </FilterBar>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border border-sage/15 bg-white-warm overflow-hidden">
                  <MemberTable
                    members={tableMembers}
                    columns={["member", "pass", "account", "classes", "lastVisit", "status"]}
                    sort={{
                      sortKey,
                      sortDir,
                      onToggle: (key) => toggleSort(key as MemberSortKey),
                      sortableKeys: ["name", "pass", "account", "classes", "lastVisit", "status"],
                    }}
                    onRowClick={(m) => router.push(`/admin/members/${m.id}`)}
                  />
                </div>
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
        <ResponsiveDialogContent className="sm:max-w-[480px] bg-white-warm border-sage/20">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="font-body font-semibold text-2xl text-charcoal">Add Member</ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="font-body text-charcoal/60">
              Create a member account, and optionally assign a pass right away.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="max-h-[60vh] space-y-4 overflow-y-auto py-2 pr-1">
            {/* Account */}
            <div className="space-y-3">
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="font-body text-charcoal/80 mb-1.5 block text-sm">Phone</Label>
                  <Input
                    value={addPhone}
                    onChange={(e) => setAddPhone(e.target.value)}
                    placeholder="+91 98765 …"
                    className="border-sage/20 focus:border-sage font-body"
                  />
                </div>
                <div>
                  <Label className="font-body text-charcoal/80 mb-1.5 block text-sm">Temp password</Label>
                  <Input
                    type="text"
                    value={addPassword}
                    onChange={(e) => setAddPassword(e.target.value)}
                    placeholder="8+ chars"
                    className="border-sage/20 focus:border-sage font-body"
                  />
                </div>
              </div>
            </div>

            {/* Assign-pass toggle */}
            <div className="rounded-xl border border-sage/15 bg-sage/[0.03] p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox checked={assignPass} onCheckedChange={(v) => setAssignPass(v === true)} className="mt-0.5" />
                <span>
                  <span className="font-body text-charcoal/90 text-sm block">Assign a pass now</span>
                  <span className="font-body text-charcoal/50 text-xs block mt-0.5">
                    Configure a class or studio pass and record payment at sign-up. Otherwise the account is created on its own.
                  </span>
                </span>
              </label>
            </div>

            {/* Pass + payment — shared engine, identical to the member-detail Manage dialog */}
            {assignPass && (
              <div className="space-y-5 rounded-xl border border-sage/15 p-4">
                <PassConfigSection state={pass} />
                <div className="border-t border-sage/10 pt-4">
                  <PaymentSection state={pass} />
                </div>
              </div>
            )}

            {addError && <p className="text-sm font-body text-terracotta">{addError}</p>}
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
              onClick={() => void handleAddSubmit()}
              disabled={addSubmitting || pass.proofUploading}
              variant="sage"
            >
              {addSubmitting ? "Adding…" : assignPass ? "Add member & assign pass" : "Add Member"}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

    </>
  );
}
