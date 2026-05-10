import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { AdminNavigation } from "@/components/AdminNavigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  CreditCard, 
  Search, 
  TrendingUp, 
  TrendingDown,
  CheckCircle2,
  AlertCircle,
  Calendar,
  User,
  Package,
  Activity
} from "lucide-react";
import { SEO } from "@/components/SEO";
import { useSession } from "next-auth/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CreditTransaction {
  id: string;
  memberId: string;
  memberName: string;
  type: "added" | "deducted" | "used" | "expired";
  amount: number;
  reason: string;
  date: string;
  adminName: string;
}

export default function AdminCredits() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<CreditTransaction[]>([]);
  const [filterType, setFilterType] = useState("all");
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
      void loadTransactions().finally(() => setLoading(false));
    }
  }, [status, session, router]);

  useEffect(() => {
    let filtered = transactions;

    if (filterType !== "all") {
      filtered = filtered.filter(t => t.type === filterType);
    }

    if (searchQuery) {
      filtered = filtered.filter(t =>
        t.memberName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.reason.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredTransactions(filtered);
  }, [searchQuery, filterType, transactions]);

  const loadTransactions = async () => {
    try {
      const res = await fetch("/api/admin/credit-transactions");
      if (!res.ok) throw new Error("failed");
      const rows: CreditTransaction[] = await res.json();
      setTransactions(rows);
    } catch {
      setTransactions([]);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "added":
        return <TrendingUp className="h-4 w-4 text-sage" />;
      case "deducted":
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      case "used":
        return <CheckCircle2 className="h-4 w-4 text-charcoal" />;
      case "expired":
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
      default:
        return null;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "added":
        return <Badge className="bg-sage/10 text-sage border-sage/20">Added</Badge>;
      case "deducted":
        return <Badge variant="destructive">Deducted</Badge>;
      case "used":
        return <Badge variant="outline" className="border-charcoal/20 text-charcoal">Used</Badge>;
      case "expired":
        return <Badge variant="outline" className="border-amber-500/20 text-amber-600 bg-amber-50">Expired</Badge>;
      default:
        return null;
    }
  };

  const stats = {
    totalAdded: transactions.filter(t => t.type === "added").reduce((sum, t) => sum + t.amount, 0),
    totalUsed: transactions.filter(t => t.type === "used").reduce((sum, t) => sum + t.amount, 0),
    totalDeducted: transactions.filter(t => t.type === "deducted").reduce((sum, t) => sum + t.amount, 0),
    totalExpired: transactions.filter(t => t.type === "expired").reduce((sum, t) => sum + t.amount, 0),
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
        title="Credit Tracking - Admin"
        description="Monitor and manage member credits"
      />
      
      <div className="min-h-screen bg-gradient-to-br from-cream via-cream to-sage/10">
        <AdminNavigation />
        
        <main className="md:pl-64 min-h-screen pt-20">
          <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-8">
            
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-display text-4xl md:text-5xl text-charcoal mb-2">
                  Credit Tracking
                </h1>
                <p className="font-body text-charcoal/60 text-lg">
                  Monitor all credit transactions and package purchases
                </p>
              </div>
              <Button onClick={() => router.push("/admin/members")} className="bg-sage hover:bg-sage/90 text-white font-body">
                <User className="h-5 w-5 mr-2" />
                Manage Members
              </Button>
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
                      Credits Added
                    </CardTitle>
                    <TrendingUp className="h-5 w-5 text-sage" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="font-display text-4xl text-charcoal">
                    +{stats.totalAdded}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-sage/20 bg-white/95 backdrop-blur-xl hover:shadow-2xl transition-all duration-600">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-body text-sm text-charcoal/60 font-medium">
                      Credits Used
                    </CardTitle>
                    <CheckCircle2 className="h-5 w-5 text-charcoal" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="font-display text-4xl text-charcoal">
                    -{stats.totalUsed}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-sage/20 bg-white/95 backdrop-blur-xl hover:shadow-2xl transition-all duration-600">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-body text-sm text-charcoal/60 font-medium">
                      Credits Deducted
                    </CardTitle>
                    <TrendingDown className="h-5 w-5 text-red-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="font-display text-4xl text-charcoal">
                    -{stats.totalDeducted}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-sage/20 bg-white/95 backdrop-blur-xl hover:shadow-2xl transition-all duration-600">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-body text-sm text-charcoal/60 font-medium">
                      Credits Expired
                    </CardTitle>
                    <AlertCircle className="h-5 w-5 text-amber-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="font-display text-4xl text-charcoal">
                    -{stats.totalExpired}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <Card className="border-sage/20 bg-white/95 backdrop-blur-xl">
              <CardContent className="p-6">
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-charcoal/40" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by member name or reason..."
                      className="h-12 pl-12 border-charcoal/20 focus:border-sage font-body"
                    />
                  </div>

                  {/* Type Filter */}
                  <div>
                    <Select value={filterType} onValueChange={setFilterType}>
                      <SelectTrigger className="h-12 border-charcoal/20 focus:border-sage font-body">
                        <SelectValue placeholder="Filter by type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Transactions</SelectItem>
                        <SelectItem value="added">Added Only</SelectItem>
                        <SelectItem value="used">Used Only</SelectItem>
                        <SelectItem value="deducted">Deducted Only</SelectItem>
                        <SelectItem value="expired">Expired Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Transactions Table */}
            <Card className="border-sage/20 bg-white/95 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="font-display text-2xl text-charcoal">
                  Transaction History ({filteredTransactions.length})
                </CardTitle>
                <CardDescription className="font-body text-charcoal/60">
                  Complete audit trail of all credit movements
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredTransactions.map((transaction) => (
                    <div 
                      key={transaction.id}
                      className="p-6 rounded-xl border border-charcoal/10 hover:border-sage/30 hover:bg-sage/5 transition-all duration-600"
                    >
                      <div className="grid md:grid-cols-5 gap-4 items-center">
                        
                        {/* Type & Amount */}
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-lg ${
                            transaction.type === "added" ? "bg-sage/10" :
                            transaction.type === "deducted" ? "bg-red-50" :
                            transaction.type === "used" ? "bg-charcoal/5" :
                            "bg-amber-50"
                          }`}>
                            {getTypeIcon(transaction.type)}
                          </div>
                          <div>
                            <div className="font-display text-2xl text-charcoal">
                              {transaction.type === "added" ? "+" : "-"}{transaction.amount}
                            </div>
                            <div className="font-body text-xs text-charcoal/60">
                              Credits
                            </div>
                          </div>
                        </div>

                        {/* Member */}
                        <div>
                          <div className="font-body text-sm text-charcoal/60 mb-1">
                            Member
                          </div>
                          <div className="font-body font-medium text-charcoal">
                            {transaction.memberName}
                          </div>
                        </div>

                        {/* Reason */}
                        <div>
                          <div className="font-body text-sm text-charcoal/60 mb-1">
                            Reason
                          </div>
                          <div className="font-body text-sm text-charcoal">
                            {transaction.reason}
                          </div>
                        </div>

                        {/* Date & Admin */}
                        <div>
                          <div className="font-body text-sm text-charcoal/60 mb-1">
                            Date & Time
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-3.5 w-3.5 text-charcoal/40" />
                            <span className="font-body text-charcoal">
                              {new Date(transaction.date).toLocaleString()}
                            </span>
                          </div>
                          <div className="font-body text-xs text-charcoal/50 mt-1">
                            By: {transaction.adminName}
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="flex justify-end">
                          {getTypeBadge(transaction.type)}
                        </div>
                      </div>
                    </div>
                  ))}

                  {filteredTransactions.length === 0 && (
                    <div className="text-center py-12">
                      <Activity className="h-12 w-12 text-charcoal/20 mx-auto mb-3" />
                      <p className="font-body text-charcoal/40">No transactions found</p>
                      <Button 
                        onClick={() => { setSearchQuery(""); setFilterType("all"); }}
                        variant="outline"
                        className="mt-4 border-sage/20 text-sage hover:bg-sage/10 font-body"
                      >
                        Clear Filters
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

          </div>
        </main>
      </div>
    </>
  );
}