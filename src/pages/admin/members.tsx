import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { AdminNavigation } from "@/components/AdminNavigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";
import { SEO } from "@/components/SEO";
import { Pagination, usePagination } from "@/components/Pagination";
import { useSession } from "next-auth/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Member {
  id: string;
  userPackageId: string | null;
  name: string;
  email: string;
  phone: string;
  package: string;
  credits: number;
  unlimited: boolean;
  expiryDate: string;
  totalClasses: number;
  lastVisit: string;
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

export default function AdminMembers() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [packageFilter, setPackageFilter] = useState<"all" | "studio" | "class" | "none">("all");
  const [accountStatusFilter, setAccountStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [members, setMembers] = useState<Member[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogPassType, setDialogPassType] = useState<"class_pass" | "studio_pass">("class_pass");
  const [selectedCredits, setSelectedCredits] = useState<number | null>(null);
  const [selectedDays, setSelectedDays] = useState<number | null>(null);
  const [newStartDate, setNewStartDate] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  // Offline payment recording
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentReference, setPaymentReference] = useState<string>("");
  const [paymentProofUrl, setPaymentProofUrl] = useState<string>("");
  const [proofUploading, setProofUploading] = useState(false);
  const [dialogStep, setDialogStep] = useState<"config" | "payment">("config");
  const [submitting, setSubmitting] = useState(false);

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
    if (status === "authenticated") {
      setLoading(true);
      void loadMembers().finally(() => setLoading(false));
    }
  }, [status, session, router]);

  useEffect(() => {
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
    setFilteredMembers(filtered);
  }, [searchQuery, members, packageFilter, accountStatusFilter]);

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
      if (!Array.isArray(raw)) {
        setLoadError("Members list response was invalid.");
        setMembers([]);
        return;
      }
      const profiles = raw as Array<{
        id: string;
        full_name: string | null;
        email: string;
        phone: string | null;
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
          const pass = (pkg.pass_type || p.pass_type || "").toLowerCase();
          const pt = pkg.package_type;
          const t = (pt?.type || "").toLowerCase();
          if (pass === "studio_pass" || pt?.is_unlimited || t.includes("studio")) {
            passCategory = "studio_pass";
          } else {
            passCategory = "class_pass";
          }
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
          package: activePkg?.package_type?.name ?? lastPkg?.package_type?.name ?? "No active package",
          credits,
          unlimited,
          expiryDate,
          // Prefer real check-in count from bookings; fall back to user_stats if relation count missing.
          totalClasses: p._count?.bookings ?? stats?.total_classes_attended ?? 0,
          lastVisit: formatRelativeDay(stats?.last_class_date ?? null),
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
      alert("Select number of classes first"); return;
    }
    if (dialogPassType === "studio_pass" && selectedDays === null) {
      alert("Select number of days first"); return;
    }
    setDialogStep("payment");
  };

  const uploadProof = async (file: File) => {
    setProofUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", credentials: "include", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.url) throw new Error(json.error ?? "Upload failed");
      setPaymentProofUrl(json.url);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setProofUploading(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!selectedMember) return;
    if (!paymentMethod) { alert("Select a payment method"); return; }
    const rupees = Number(paymentAmount);
    if (!Number.isFinite(rupees) || rupees <= 0) { alert("Enter a valid amount in INR"); return; }
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
      alert(e instanceof Error ? e.message : "Could not record payment");
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
        alert("Select a value before applying.");
        return;
      }

      for (const p of patches) await patchMember(p);
      await loadMembers();
      setSuccessMessage(`Updated ${selectedMember.name}`);
      setDialogOpen(false);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not update member");
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
      alert(e instanceof Error ? e.message : "Could not update start date");
    }
  };

  const handleToggleUnlimited = async (memberId: string) => {
    const member = members.find((m) => m.id === memberId);
    if (!member) return;
    const nextPass = member.unlimited ? "class_pass" : "studio_pass";
    try {
      await patchMember({ profile_id: member.id, pass_type: nextPass });
      await loadMembers();
      setSuccessMessage("Pass type updated (unlimited uses studio pass in your app)");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not update pass");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-sage/10 text-sage border-sage/20">Active</Badge>;
      case "expiring":
        return <Badge variant="outline" className="border-amber-500/20 text-amber-600 bg-amber-50">Expiring Soon</Badge>;
      case "expired":
        return <Badge variant="destructive">Expired</Badge>;
      default:
        return null;
    }
  };

  const stats = {
    totalMembers: members.length,
    activeMembers: members.filter((m) => m.accountFilter === "active").length,
    expiringMembers: members.filter((m) => m.status === "expiring").length,
    inactiveLong: members.filter((m) => m.accountFilter === "inactive").length,
  };

  const membersPg = usePagination(
    filteredMembers,
    10,
    `${searchQuery}|${packageFilter}|${accountStatusFilter}`,
  );

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
        title="Member Management - Admin"
        description="Manage members, credits, and subscriptions"
      />
      
      <div className="min-h-screen bg-gradient-to-br from-cream via-cream to-sage/10">
        <AdminNavigation />
        
        <main className="md:pl-64 min-h-screen pt-20">
          <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-8">
            
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-display text-4xl md:text-5xl text-charcoal mb-2">
                  Member Management
                </h1>
                <p className="font-body text-charcoal/60 text-lg">
                  Manage credits, subscriptions, and member data
                </p>
              </div>
            </div>

            {loadError && (
              <Card className="border-terracotta/30 bg-terracotta/5 backdrop-blur-xl">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 text-terracotta">
                    <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                    <p className="font-body text-charcoal">{loadError}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Success Message */}
            {successMessage && (
              <Card className="border-sage/20 bg-sage/10 backdrop-blur-xl animate-in slide-in-from-top duration-600">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 text-sage">
                    <CheckCircle2 className="h-5 w-5" />
                    <p className="font-body">{successMessage}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
                  <div className="font-display text-4xl text-charcoal">
                    {stats.totalMembers}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-sage/20 bg-white/95 backdrop-blur-xl hover:shadow-2xl transition-all duration-600">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-body text-sm text-charcoal/60 font-medium">
                      Active Members
                    </CardTitle>
                    <CheckCircle2 className="h-5 w-5 text-sage" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="font-display text-4xl text-charcoal">
                    {stats.activeMembers}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-sage/20 bg-white/95 backdrop-blur-xl hover:shadow-2xl transition-all duration-600">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-body text-sm text-charcoal/60 font-medium">
                      Expiring Soon
                    </CardTitle>
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="font-display text-4xl text-charcoal">
                    {stats.expiringMembers}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-sage/20 bg-white/95 backdrop-blur-xl hover:shadow-2xl transition-all duration-600">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-body text-sm text-charcoal/60 font-medium">
                      Inactive (14d+)
                    </CardTitle>
                    <AlertTriangle className="h-5 w-5 text-charcoal/50" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="font-display text-4xl text-charcoal">
                    {stats.inactiveLong}
                  </div>
                  <p className="text-xs text-charcoal/50 font-body mt-1">No package for over 14 days</p>
                </CardContent>
              </Card>
            </div>

            {/* Search Bar */}
            <Card className="border-sage/20 bg-white/95 backdrop-blur-xl">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-charcoal/40" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by name, email, or phone..."
                      className="h-14 pl-12 border-charcoal/20 focus:border-sage font-body text-lg"
                    />
                  </div>
                  <Select value={packageFilter} onValueChange={(v) => setPackageFilter(v as typeof packageFilter)}>
                    <SelectTrigger className="h-14 w-full md:w-[200px] border-charcoal/20">
                      <SelectValue placeholder="Package" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All packages</SelectItem>
                      <SelectItem value="studio">Studio pass</SelectItem>
                      <SelectItem value="class">Class pass</SelectItem>
                      <SelectItem value="none">No pass</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={accountStatusFilter}
                    onValueChange={(v) => setAccountStatusFilter(v as typeof accountStatusFilter)}
                  >
                    <SelectTrigger className="h-14 w-full md:w-[200px] border-charcoal/20">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Members Table */}
            <Card className="border-sage/20 bg-white/95 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="font-display text-2xl text-charcoal">
                  Members ({filteredMembers.length})
                </CardTitle>
                <CardDescription className="font-body text-charcoal/60">
                  Click on a member to manage credits and subscription
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {membersPg.pageItems.map((member) => (
                    <div 
                      key={member.id}
                      className="p-6 rounded-xl border border-charcoal/10 hover:border-sage/30 hover:bg-sage/5 transition-all duration-600"
                    >
                      <div className="grid md:grid-cols-5 gap-6">
                        
                        {/* Member Info */}
                        <div className="md:col-span-2">
                          <div className="flex items-start gap-4">
                            <div className="h-12 w-12 rounded-full bg-sage/10 flex items-center justify-center text-sage font-display text-xl">
                              {member.name.charAt(0)}
                            </div>
                            <div className="flex-1">
                              <div className="font-body font-medium text-charcoal mb-1">
                                {member.name}
                              </div>
                              <div className="space-y-1 text-sm text-charcoal/60 font-body">
                                <div className="flex items-center gap-2">
                                  <Mail className="h-3.5 w-3.5" />
                                  {member.email}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Phone className="h-3.5 w-3.5" />
                                  {member.phone}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Package & Credits */}
                        <div>
                          <div className="font-body text-sm text-charcoal/60 mb-2">
                            Package
                          </div>
                          <Badge variant="outline" className="border-sage/20 text-sage bg-sage/5 mb-3">
                            {member.package}
                          </Badge>
                          {member.unlimited && (
                            <Badge className="bg-terracotta/10 text-terracotta border-terracotta/20 ml-2">
                              Unlimited
                            </Badge>
                          )}
                          <div className="mt-2 flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-charcoal/40" />
                            <span className="font-body font-medium text-charcoal">
                              {member.totalClasses} classes taken
                            </span>
                          </div>
                        </div>

                        {/* Pass & activity */}
                        <div>
                          <div className="font-body text-sm text-charcoal/60 mb-2">
                            Pass & activity
                          </div>
                          <div className="space-y-2 text-sm font-body">
                            <div>
                              <span className="text-charcoal/50">Pass: </span>
                              <span className="text-charcoal font-medium">
                                {member.passCategory === "studio_pass"
                                  ? "Studio pass"
                                  : member.passCategory === "class_pass"
                                    ? "Class pass"
                                    : "No pass"}
                              </span>
                            </div>
                            <div>
                              <span className="text-charcoal/50">Account: </span>
                              <span className="text-charcoal font-medium">
                                {member.accountFilter === "active"
                                  ? "Active"
                                  : member.accountFilter === "inactive"
                                    ? "Inactive"
                                    : "Lapsed (<14 d)"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Trophy className="h-3.5 w-3.5 text-sage" />
                              <span className="text-charcoal">{member.totalClasses} classes attended</span>
                            </div>
                            <div className="flex items-center gap-2 text-charcoal/60">
                              <Calendar className="h-3.5 w-3.5" />
                              <span>Last visit: {member.lastVisit}</span>
                            </div>
                            {member.startDate && (
                              <div className="flex items-center gap-2 text-charcoal/60">
                                <Calendar className="h-3.5 w-3.5 text-sage/60" />
                                <span>Started: {new Date(member.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2">
                          {getStatusBadge(member.status)}
                          <div className="text-sm font-body text-charcoal/60 mt-2">
                            Expires: {new Date(member.expiryDate).toLocaleDateString()}
                          </div>
                          <Button
                            onClick={() => handleManageCredits(member)}
                            variant="outline"
                            size="sm"
                            className="border-sage/20 text-sage hover:bg-sage/10 font-body mt-2"
                          >
                            <Edit2 className="h-3.5 w-3.5 mr-2" />
                            Manage
                          </Button>
                          <Button
                            onClick={() => handleToggleUnlimited(member.id)}
                            variant="outline"
                            size="sm"
                            className={`font-body ${
                              member.unlimited 
                                ? "border-terracotta/20 text-terracotta hover:bg-terracotta/10" 
                                : "border-charcoal/20 text-charcoal hover:bg-charcoal/5"
                            }`}
                          >
                            {member.unlimited ? "Remove Unlimited" : "Make Unlimited"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
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

      {/* Manage Member Dialog — 2-step: pass config → payment */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[480px] bg-white border-sage/20">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-charcoal">
              Manage {selectedMember?.name}
            </DialogTitle>
            <DialogDescription className="font-body text-charcoal/60">
              {dialogStep === "config" ? "Step 1 of 2 — pass configuration" : "Step 2 of 2 — payment"}
            </DialogDescription>
          </DialogHeader>

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
                  <div className="grid grid-cols-4 gap-2">
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
                  <div className="grid grid-cols-4 gap-2">
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

          <DialogFooter className="gap-2 sm:gap-2">
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
                  className="bg-sage hover:bg-sage/90 text-white font-body"
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
                  className="bg-sage hover:bg-sage/90 text-white font-body"
                >
                  {submitting ? "Processing…" : "Record Payment & Apply Pass"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}