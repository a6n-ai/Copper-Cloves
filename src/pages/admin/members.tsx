import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { requireSessionSSP } from "@/lib/requireSessionSSP";

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
import { Pagination } from "@/components/Pagination";
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
import { hasRole } from "@/lib/auth/roles";
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

// Member-row derivation (status/passCategory/lastVisit/etc.) now runs server-side
// in /api/admin/members so filter/sort/pagination happen over the full population
// before one page is sent. The server returns rows already in the Member shape.

type MemberCounts = {
  totalMembers: number;
  activeMembers: number;
  expiringMembers: number;
  inactiveLong: number;
  studioPass: number;
  classPass: number;
};
const EMPTY_COUNTS: MemberCounts = {
  totalMembers: 0,
  activeMembers: 0,
  expiringMembers: 0,
  inactiveLong: 0,
  studioPass: 0,
  classPass: 0,
};

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
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<MemberCounts>(EMPTY_COUNTS);
  const [page, setPage] = useState(1);
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
    if (status === "authenticated" && !hasRole(userRole, "admin")) {
      router.push("/login");
      return;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, userRole]);

  // Reset to the first page whenever the filter/sort criteria change.
  useEffect(() => {
    setPage(1);
  }, [f.values.search, f.values.pkg, f.values.account, sortKey, sortDir]);

  // Server-driven list: refetch (debounced) on any page/filter/sort change. The
  // debounce coalesces rapid search keystrokes and the page-reset above into one
  // request. Owns the loading flag for the initial paint.
  useEffect(() => {
    if (status !== "authenticated" || !hasRole(userRole, "admin")) return;
    const t = setTimeout(() => {
      void loadMembers().finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, userRole, page, f.values.search, f.values.pkg, f.values.account, sortKey, sortDir]);

  const loadMembers = async () => {
    setLoadError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "10",
        search: f.values.search,
        pkg: f.values.pkg,
        account: f.values.account,
      });
      if (sortKey) {
        params.set("sort", sortKey);
        params.set("dir", sortDir);
      }
      const res = await fetch(`/api/admin/members?${params.toString()}`, { credentials: "include" });
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
      const payload = (await res.json()) as {
        members?: Member[];
        total?: number;
        counts?: MemberCounts;
        checkInsThisMonth?: number;
      };
      if (!Array.isArray(payload.members)) {
        setLoadError("Members list response was invalid.");
        setMembers([]);
        return;
      }
      setMembers(payload.members);
      setTotal(typeof payload.total === "number" ? payload.total : payload.members.length);
      setCounts(payload.counts ?? EMPTY_COUNTS);
      setCheckInsThisMonth(typeof payload.checkInsThisMonth === "number" ? payload.checkInsThisMonth : 0);
    } catch {
      setLoadError("Could not load members. Check your connection and try again.");
      setMembers([]);
    }
  };

  const stats = { ...counts, checkInsThisMonth };

  type MemberSortKey = "name" | "pass" | "account" | "classes" | "lastVisit" | "status";
  const toggleSort = (key: MemberSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" || key === "pass" || key === "account" ? "asc" : "desc");
    }
  };

  const accountLabelFor = (f: Member["accountFilter"]) =>
    f === "active" ? "Active" : f === "inactive" ? "Inactive" : "Lapsed";

  const tableMembers: MemberTableMember[] = members.map((m) => ({
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
                      Members <span className="font-body text-base text-charcoal/40">({total})</span>
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
                  page={page}
                  total={total}
                  pageSize={10}
                  onChange={setPage}
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
