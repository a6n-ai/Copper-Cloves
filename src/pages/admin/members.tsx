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
  Search, 
  Plus, 
  Minus, 
  Edit2, 
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  Calendar,
  Mail,
  Phone,
  Flame,
  Trophy
} from "lucide-react";
import { SEO } from "@/components/SEO";
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
  streak: number;
  totalClasses: number;
  lastVisit: string;
  status: "active" | "expiring" | "expired";
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
  const [members, setMembers] = useState<Member[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creditAmount, setCreditAmount] = useState("");
  const [newExpiryDate, setNewExpiryDate] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

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
    const filtered = members.filter(member =>
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.phone.includes(searchQuery)
    );
    setFilteredMembers(filtered);
  }, [searchQuery, members]);

  const loadMembers = async () => {
    try {
      const res = await fetch("/api/admin/members");
      if (!res.ok) throw new Error("load failed");
      const profiles: Array<{
        id: string;
        full_name: string | null;
        email: string;
        phone: string | null;
        pass_type: string | null;
        user_packages: Array<{
          id: string;
          is_active: boolean;
          credits_remaining: number | null;
          expiration_date: string;
          package_type: { name: string; is_unlimited: boolean };
        }>;
        user_stats: {
          current_streak?: number;
          total_classes_attended?: number;
          last_class_date?: string | null;
        } | null;
      }> = await res.json();

      const mapped: Member[] = profiles.map((p) => {
        const pkg = p.user_packages?.[0];
        const pt = pkg?.package_type;
        const unlimited = Boolean(pt?.is_unlimited || p.pass_type === "studio_pass");
        const credits = unlimited
          ? pkg?.credits_remaining ?? 0
          : pkg?.credits_remaining ?? 0;
        const expiryRaw = pkg?.expiration_date
          ? new Date(pkg.expiration_date)
          : new Date();
        const expiryDate = expiryRaw.toISOString().slice(0, 10);
        const stats = p.user_stats;

        return {
          id: p.id,
          userPackageId: pkg?.id ?? null,
          name: p.full_name || p.email || "Member",
          email: p.email,
          phone: p.phone || "—",
          package: pt?.name ?? "No active package",
          credits,
          unlimited,
          expiryDate,
          streak: stats?.current_streak ?? 0,
          totalClasses: stats?.total_classes_attended ?? 0,
          lastVisit: formatRelativeDay(stats?.last_class_date ?? null),
          status: deriveMemberStatus(expiryRaw, credits, unlimited),
        };
      });

      setMembers(mapped);
    } catch {
      setMembers([]);
    }
  };

  const handleManageCredits = (member: Member) => {
    setSelectedMember(member);
    setCreditAmount("");
    setNewExpiryDate(member.expiryDate);
    setDialogOpen(true);
  };

  const patchMember = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/admin/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error ?? "Update failed");
    }
  };

  const handleAddCredits = async () => {
    if (!selectedMember || !creditAmount) return;
    const amount = parseInt(creditAmount, 10);
    if (Number.isNaN(amount) || amount <= 0) return;
    try {
      if (!selectedMember.userPackageId) {
        alert("Member has no active package to attach credits to.");
        return;
      }
      await patchMember({
        profile_id: selectedMember.id,
        user_package_id: selectedMember.userPackageId,
        credits_delta: amount,
      });
      await loadMembers();
      setSuccessMessage(`Added ${amount} credits to ${selectedMember.name}`);
      setDialogOpen(false);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not update credits");
    }
  };

  const handleDeductCredits = async () => {
    if (!selectedMember || !creditAmount) return;
    const amount = parseInt(creditAmount, 10);
    if (Number.isNaN(amount) || amount <= 0) return;
    try {
      if (!selectedMember.userPackageId) {
        alert("Member has no active package.");
        return;
      }
      await patchMember({
        profile_id: selectedMember.id,
        user_package_id: selectedMember.userPackageId,
        credits_delta: -amount,
      });
      await loadMembers();
      setSuccessMessage(`Deducted ${amount} credits from ${selectedMember.name}`);
      setDialogOpen(false);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not update credits");
    }
  };

  const handleUpdateExpiry = async () => {
    if (!selectedMember || !newExpiryDate) return;
    try {
      if (!selectedMember.userPackageId) {
        alert("Member has no active package.");
        return;
      }
      await patchMember({
        profile_id: selectedMember.id,
        user_package_id: selectedMember.userPackageId,
        expiration_date: newExpiryDate,
      });
      await loadMembers();
      setSuccessMessage(`Updated expiry date for ${selectedMember.name}`);
      setDialogOpen(false);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not update expiry");
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
    activeMembers: members.filter((m) => m.status === "active").length,
    expiringMembers: members.filter((m) => m.status === "expiring").length,
    avgStreak:
      members.length === 0
        ? 0
        : Math.round(members.reduce((sum, m) => sum + m.streak, 0) / members.length),
  };

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
                      Avg Streak
                    </CardTitle>
                    <Flame className="h-5 w-5 text-terracotta" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="font-display text-4xl text-charcoal">
                    {stats.avgStreak}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Search Bar */}
            <Card className="border-sage/20 bg-white/95 backdrop-blur-xl">
              <CardContent className="p-6">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-charcoal/40" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, email, or phone..."
                    className="h-14 pl-12 border-charcoal/20 focus:border-sage font-body text-lg"
                  />
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
                  {filteredMembers.map((member) => (
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
                              {member.unlimited ? "Unlimited pass" : `${member.credits} credits`}
                            </span>
                          </div>
                        </div>

                        {/* Stats */}
                        <div>
                          <div className="font-body text-sm text-charcoal/60 mb-2">
                            Performance
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm">
                              <Flame className="h-3.5 w-3.5 text-terracotta" />
                              <span className="font-body text-charcoal">{member.streak} day streak</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Trophy className="h-3.5 w-3.5 text-sage" />
                              <span className="font-body text-charcoal">{member.totalClasses} classes</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="h-3.5 w-3.5 text-charcoal/40" />
                              <span className="font-body text-charcoal/60">Last: {member.lastVisit}</span>
                            </div>
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
              </CardContent>
            </Card>

          </div>
        </main>
      </div>

      {/* Manage Credits Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px] bg-white border-sage/20">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-charcoal">
              Manage {selectedMember?.name}
            </DialogTitle>
            <DialogDescription className="font-body text-charcoal/60">
              Update credits and subscription details
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Current Credits Display */}
            <div className="p-4 rounded-xl bg-sage/5 border border-sage/20">
              <div className="font-body text-sm text-charcoal/60 mb-1">
                Current Credits
              </div>
              <div className="font-display text-3xl text-charcoal">
                {selectedMember?.credits}
              </div>
            </div>

            {/* Credit Amount Input */}
            <div>
              <Label className="font-body text-charcoal/80 mb-2">
                Credit Amount
              </Label>
              <Input
                type="number"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                placeholder="Enter amount"
                className="h-12 border-charcoal/20 focus:border-sage font-body"
              />
            </div>

            {/* Credit Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handleAddCredits}
                disabled={!creditAmount}
                className="flex-1 bg-sage hover:bg-sage/90 text-white font-body"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Credits
              </Button>
              <Button
                onClick={handleDeductCredits}
                disabled={!creditAmount}
                variant="outline"
                className="flex-1 border-terracotta/20 text-terracotta hover:bg-terracotta/10 font-body"
              >
                <Minus className="h-4 w-4 mr-2" />
                Deduct Credits
              </Button>
            </div>

            {/* Expiry Date */}
            <div>
              <Label className="font-body text-charcoal/80 mb-2">
                Subscription Expiry
              </Label>
              <Input
                type="date"
                value={newExpiryDate}
                onChange={(e) => setNewExpiryDate(e.target.value)}
                className="h-12 border-charcoal/20 focus:border-sage font-body"
              />
            </div>

            <Button
              onClick={handleUpdateExpiry}
              variant="outline"
              className="w-full border-sage/20 text-sage hover:bg-sage/10 font-body"
            >
              Update Expiry Date
            </Button>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="border-charcoal/20 text-charcoal hover:bg-charcoal/5 font-body"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}