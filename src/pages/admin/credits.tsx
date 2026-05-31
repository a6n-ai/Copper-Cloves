import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import { requireSessionSSP } from "@/lib/requireSessionSSP";

export const getServerSideProps = requireSessionSSP({ roles: ["admin"] });
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Search,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertCircle,
  Calendar,
  User,
  Activity,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
} from "lucide-react";
import { SEO } from "@/components/SEO";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "next-auth/react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import { Pagination, usePagination } from "@/components/Pagination";
import { MetricCard } from "@/components/admin/MetricCard";
import { SortableHeader } from "@/components/admin/sortable-table";

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

type SortKey = "type" | "amount" | "member" | "date";

function CreditsLoadingSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>

      {/* Stats grid — 4 credit summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-sage/20 bg-white-warm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-5 w-5 rounded" />
              </div>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-10 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters bar — search + type select */}
      <Card className="border-sage/20 bg-white-warm">
        <CardContent className="p-6">
          <div className="grid md:grid-cols-2 gap-4">
            <Skeleton className="h-12 w-full rounded-md" />
            <Skeleton className="h-12 w-full rounded-md" />
          </div>
        </CardContent>
      </Card>

      {/* Transaction history table */}
      <Card className="border-sage/20 bg-white-warm">
        <CardHeader className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-sage/15 bg-white-warm overflow-hidden">
            <div className="flex items-center gap-4 bg-sage/5 px-5 py-3 border-b border-sage/10">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 flex-1" />
              <Skeleton className="h-3 w-20" />
            </div>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-sage/10 last:border-0">
                <div className="flex items-center gap-2.5 w-[130px]">
                  <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
                <Skeleton className="h-7 w-12" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 flex-1" />
                <div className="w-[200px] space-y-1.5">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminCredits() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [filterType, setFilterType] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [successMessage, setSuccessMessage] = useState("");

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
      void loadTransactions().finally(() => setLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, userRole]);

  const filteredTransactions = useMemo(() => {
    let filtered: CreditTransaction[] = transactions;

    if (filterType !== "all") {
      filtered = filtered.filter((t) => t.type === filterType);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.memberName.toLowerCase().includes(q) ||
          t.reason.toLowerCase().includes(q),
      );
    }

    if (sortKey) {
      const dir = sortDir === "asc" ? 1 : -1;
      filtered = [...filtered].sort((a, b) => {
        switch (sortKey) {
          case "amount":
            return (a.amount - b.amount) * dir;
          case "member":
            return a.memberName.localeCompare(b.memberName) * dir;
          case "type":
            return a.type.localeCompare(b.type) * dir;
          case "date":
            return a.date.localeCompare(b.date) * dir;
          default:
            return 0;
        }
      });
    }

    return filtered;
  }, [searchQuery, filterType, transactions, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "member" || key === "type" ? "asc" : "desc");
    }
  };

  const txPg = usePagination(
    filteredTransactions,
    10,
    `${searchQuery}|${filterType}|${sortKey}|${sortDir}`,
  );

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
        return <TrendingDown className="h-4 w-4 text-[#a05e38]" />;
      case "used":
        return <CheckCircle2 className="h-4 w-4 text-charcoal" />;
      case "expired":
        return <AlertCircle className="h-4 w-4 text-charcoal/50" />;
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
        return <Badge variant="outline" className="border-charcoal/15 text-charcoal/60 bg-charcoal/5">Expired</Badge>;
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
      <div className="min-h-screen bg-linear-to-br from-cream via-cream to-sage/10">
        <main className="min-h-screen">
          <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-8">
            <CreditsLoadingSkeleton />
          </div>
        </main>
      </div>
    );
  }

  return (
    <>
      <SEO 
        title="Class Tracking - Admin"
        description="Monitor and manage member classes"
      />
      
      <div className="min-h-screen bg-linear-to-br from-cream via-cream to-sage/10">
        
        <main className="min-h-screen">
          <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-8">
            <AdminPageHeader
              title="Class Tracking"
              subtitle="Monitor all class transactions and package purchases"
              actions={
                <Button onClick={() => router.push("/admin/members")} variant="sage">
                  <User className="h-5 w-5 mr-2" />
                  Manage Members
                </Button>
              }
            />

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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard label="Classes Added" value={stats.totalAdded} icon={TrendingUp} tone="sage" prefix="+" />
              <MetricCard label="Classes Used" value={stats.totalUsed} icon={CheckCircle2} tone="charcoal" prefix="-" />
              <MetricCard label="Classes Deducted" value={stats.totalDeducted} icon={TrendingDown} tone="terracotta" prefix="-" />
              <MetricCard label="Classes Expired" value={stats.totalExpired} icon={AlertCircle} tone="amber" prefix="-" />
            </div>

            {/* Transactions Table */}
            <Card className="border-sage/20 bg-white-warm">
              <CardHeader className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="font-display text-2xl text-charcoal">
                      Transaction History <span className="font-body text-base text-charcoal/40">({filteredTransactions.length})</span>
                    </CardTitle>
                    <CardDescription className="font-body text-charcoal/60">
                      Complete audit trail of all class movements
                    </CardDescription>
                  </div>
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-charcoal/40" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search member or reason…"
                      className="h-9 pl-9 border-sage/20 focus:border-sage font-body"
                    />
                  </div>
                </div>

                {/* Type filter: tab strip */}
                <div className="flex items-center justify-between flex-wrap gap-3 border-b border-sage/10">
                  <div className="flex items-center gap-1 -mb-px overflow-x-auto">
                    {[
                      { v: "all", l: "All" },
                      { v: "added", l: "Added" },
                      { v: "used", l: "Used" },
                      { v: "deducted", l: "Deducted" },
                      { v: "expired", l: "Expired" },
                    ].map((o) => {
                      const active = filterType === o.v;
                      return (
                        <button
                          key={o.v}
                          type="button"
                          onClick={() => setFilterType(o.v)}
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
                  {(filterType !== "all" || searchQuery) && (
                    <button
                      type="button"
                      onClick={() => { setFilterType("all"); setSearchQuery(""); }}
                      className="font-body text-xs text-terracotta hover:underline pb-2"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {filteredTransactions.length === 0 ? (
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
                ) : (
                  <>
                    <ResponsiveTable>
                      <div className="rounded-xl border border-sage/15 bg-white-warm overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-sage/5 hover:bg-sage/5 border-sage/10">
                              <SortableHeader sortKey="type" active={sortKey} dir={sortDir} onToggle={toggleSort} className="w-[130px]">Type</SortableHeader>
                              <SortableHeader sortKey="amount" active={sortKey} dir={sortDir} onToggle={toggleSort} className="w-[110px]">Amount</SortableHeader>
                              <SortableHeader sortKey="member" active={sortKey} dir={sortDir} onToggle={toggleSort} className="w-[180px]">Member</SortableHeader>
                              <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3">Reason</TableHead>
                              <SortableHeader sortKey="date" active={sortKey} dir={sortDir} onToggle={toggleSort} className="w-[200px]">Date &amp; Admin</SortableHeader>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {txPg.pageItems.map((transaction) => (
                              <TableRow key={transaction.id} className="border-sage/10 hover:bg-sage/5">
                                <TableCell className="px-5 py-4">
                                  <div className="flex items-center gap-2.5">
                                    <div className={`p-2 rounded-lg shrink-0 ${
                                      transaction.type === "added" ? "bg-sage/10" :
                                      transaction.type === "deducted" ? "bg-[#a05e38]/10" :
                                      transaction.type === "used" ? "bg-charcoal/5" :
                                      "bg-charcoal/5"
                                    }`}>
                                      {getTypeIcon(transaction.type)}
                                    </div>
                                    {getTypeBadge(transaction.type)}
                                  </div>
                                </TableCell>
                                <TableCell className="px-5 py-4">
                                  <span className={`font-display text-2xl tabular-nums ${
                                    transaction.type === "added" ? "text-sage" :
                                    transaction.type === "expired" ? "text-charcoal/50" :
                                    "text-charcoal"
                                  }`}>
                                    {transaction.type === "added" ? "+" : "-"}{transaction.amount}
                                  </span>
                                  <span className="font-body text-xs text-charcoal/50 ml-1">cr</span>
                                </TableCell>
                                <TableCell className="px-5 py-4">
                                  <span className="font-body font-medium text-charcoal">{transaction.memberName}</span>
                                </TableCell>
                                <TableCell className="px-5 py-4">
                                  <span className="font-body text-sm text-charcoal/80">{transaction.reason}</span>
                                </TableCell>
                                <TableCell className="px-5 py-4">
                                  <div className="flex items-center gap-2 text-sm">
                                    <Calendar className="h-3.5 w-3.5 text-charcoal/40 shrink-0" />
                                    <span className="font-body text-charcoal">
                                      {new Date(transaction.date).toLocaleString()}
                                    </span>
                                  </div>
                                  <div className="font-body text-xs text-charcoal/50 mt-1">
                                    By: {transaction.adminName}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </ResponsiveTable>
                    <Pagination
                      page={txPg.page}
                      total={txPg.total}
                      onChange={txPg.setPage}
                    />
                  </>
                )}
              </CardContent>
            </Card>

          </div>
        </main>
      </div>
    </>
  );
}