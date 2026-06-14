import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import { requireSessionSSP } from "@/lib/requireSessionSSP";

export const getServerSideProps = requireSessionSSP({ roles: ["admin"] });
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { FilterBar, FilterSearch, FilterSelect, useFilterState } from "@/components/filters";
import {
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertCircle,
  Calendar,
  User,
  Activity,
  Loader2,
} from "lucide-react";
import { SEO } from "@/components/SEO";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "next-auth/react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import { Pagination, usePagination } from "@/components/Pagination";
import { MetricCard } from "@/components/admin/MetricCard";
import { SortableHeader } from "@/components/admin/sortable-table";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogDescription,
  ResponsiveDialogFooter, ResponsiveDialogHeader, ResponsiveDialogTitle,
} from "@/components/responsive/ResponsiveDialog";

interface CreditTransaction {
  id: string;
  memberId: string;
  memberName: string;
  type: "added" | "deducted" | "used" | "expired";
  amount: number;
  reason: string;
  date: string;
  adminName: string;
  userPackageId?: string;
  packageTypePriceInr?: number;
  movedToMoneyIn?: boolean;
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
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const f = useFilterState({ search: "", type: "all" }, { urlSync: true });
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
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
      void loadTransactions().finally(() => setLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, userRole]);

  const filteredTransactions = useMemo(() => {
    let filtered: CreditTransaction[] = transactions;

    if (f.values.type !== "all") {
      filtered = filtered.filter((t) => t.type === f.values.type);
    }

    if (f.values.search) {
      const q = f.values.search.toLowerCase();
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
  }, [f.values.search, f.values.type, transactions, sortKey, sortDir]);

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
    `${f.values.search}|${f.values.type}|${sortKey}|${sortDir}`,
  );

  const loadTransactions = async () => {
    try {
      const res = await fetch("/api/admin/class-ledger");
      if (!res.ok) throw new Error("failed");
      const rows: CreditTransaction[] = await res.json();
      setTransactions(rows);
    } catch {
      setTransactions([]);
    }
  };

  const [moveRow, setMoveRow] = useState<CreditTransaction | null>(null);
  const [moveAmount, setMoveAmount] = useState("");
  const [moveMethod, setMoveMethod] = useState("cash");
  const [movingSaving, setMovingSaving] = useState(false);

  const openMove = (t: CreditTransaction) => {
    setMoveRow(t);
    setMoveAmount(String(Math.round(t.packageTypePriceInr ?? 0)));
    setMoveMethod("cash");
  };

  const submitMove = async () => {
    if (!moveRow?.userPackageId) return;
    const amt = Number(moveAmount);
    if (!Number.isFinite(amt) || amt <= 0) { toast.error("Enter a valid amount."); return; }
    setMovingSaving(true);
    try {
      const r = await fetch("/api/admin/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: moveRow.memberId,
          user_package_id: moveRow.userPackageId,
          method: moveMethod,
          amount_paise: Math.round(amt * 100),
          notes: `Moved from class grant: ${moveRow.reason}`,
        }),
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); toast.error(e.error ?? "Could not move to money in."); return; }
      toast.success("Moved to money in.");
      setMoveRow(null);
      await loadTransactions();
    } finally { setMovingSaving(false); }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "added":
        return <TrendingUp className="h-4 w-4 text-sage" />;
      case "deducted":
        return <TrendingDown className="h-4 w-4 text-terracotta" />;
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
        return <Pill tone="success">Added</Pill>;
      case "deducted":
        return <Pill tone="danger">Deducted</Pill>;
      case "used":
        return <Pill tone="neutral">Used</Pill>;
      case "expired":
        return <Pill tone="neutral">Expired</Pill>;
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
        title="Class Ledger - Admin"
        description="Monitor and manage member classes"
      />
      
      <div className="min-h-screen bg-linear-to-br from-cream via-cream to-sage/10">
        
        <main className="min-h-screen">
          <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-8">
            <AdminPageHeader
              title="Class Ledger"
              subtitle="Class grants, usage, and moving grants to money-in"
              actions={
                <Button onClick={() => router.push("/admin/members")} variant="sage">
                  <User className="h-5 w-5 mr-2" />
                  Manage Members
                </Button>
              }
            />

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard label="Classes Added" value={stats.totalAdded} icon={TrendingUp} tone="sage" prefix="+" />
              <MetricCard label="Classes Used" value={stats.totalUsed} icon={CheckCircle2} tone="charcoal" prefix="-" />
              <MetricCard label="Classes Deducted" value={stats.totalDeducted} icon={TrendingDown} tone="terracotta" prefix="-" />
              <MetricCard label="Classes Expired" value={stats.totalExpired} icon={AlertCircle} tone="clay" prefix="-" />
            </div>

            {/* Transactions Table */}
            <Card className="border-sage/20 bg-white-warm">
              <CardHeader className="space-y-4">
                <div>
                  <CardTitle className="font-display text-2xl text-charcoal">
                    Transaction History <span className="font-body text-base text-charcoal/40">({filteredTransactions.length})</span>
                  </CardTitle>
                  <CardDescription className="font-body text-charcoal/60">
                    Complete audit trail of all class movements
                  </CardDescription>
                </div>

                <FilterBar reset={f.isActive ? f.reset : undefined} className="mb-4">
                  <FilterSearch
                    value={f.values.search}
                    onChange={(v) => f.set("search", v)}
                    placeholder="Search member or reason…"
                    aria-label="Search transactions"
                  />
                  <FilterSelect
                    ariaLabel="Type"
                    placeholder="Type"
                    value={f.values.type}
                    onChange={(v) => f.set("type", v)}
                    options={[
                      { value: "all", label: "All types" },
                      { value: "added", label: "Added" },
                      { value: "used", label: "Used" },
                      { value: "deducted", label: "Deducted" },
                      { value: "expired", label: "Expired" },
                    ]}
                  />
                </FilterBar>
              </CardHeader>
              <CardContent>
                {filteredTransactions.length === 0 ? (
                  <div className="text-center py-12">
                    <Activity className="h-12 w-12 text-charcoal/20 mx-auto mb-3" />
                    <p className="font-body text-charcoal/40">No transactions found</p>
                    <Button
                      onClick={f.reset}
                      variant="outline"
                      className="mt-4 border-sage/20 text-sage hover:bg-sage/10 font-body hover:text-sage!"
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
                            <TableRow>
                              <SortableHeader sortKey="type" active={sortKey} dir={sortDir} onToggle={toggleSort} className="w-[130px]">Type</SortableHeader>
                              <SortableHeader sortKey="amount" active={sortKey} dir={sortDir} onToggle={toggleSort} className="w-[110px]">Amount</SortableHeader>
                              <SortableHeader sortKey="member" active={sortKey} dir={sortDir} onToggle={toggleSort} className="w-[180px]">Member</SortableHeader>
                              <TableHead>Reason</TableHead>
                              <SortableHeader sortKey="date" active={sortKey} dir={sortDir} onToggle={toggleSort} className="w-[200px]">Date &amp; Admin</SortableHeader>
                              <TableHead className="w-[140px] text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {txPg.pageItems.map((transaction) => (
                              <TableRow key={transaction.id}>
                                <TableCell>
                                  <div className="flex items-center gap-2.5">
                                    <div className={`p-2 rounded-lg shrink-0 ${
                                      transaction.type === "added" ? "bg-sage/10" :
                                      transaction.type === "deducted" ? "bg-terracotta/10" :
                                      transaction.type === "used" ? "bg-charcoal/5" :
                                      "bg-charcoal/5"
                                    }`}>
                                      {getTypeIcon(transaction.type)}
                                    </div>
                                    {getTypeBadge(transaction.type)}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <span className={`font-body font-semibold tabular-nums ${
                                    transaction.type === "added" ? "text-sage" :
                                    transaction.type === "expired" ? "text-charcoal/50" :
                                    "text-charcoal"
                                  }`}>
                                    {transaction.type === "added" ? "+" : "-"}{transaction.amount}
                                  </span>
                                  <span className="font-body text-xs text-charcoal/50 ml-1">cr</span>
                                </TableCell>
                                <TableCell>
                                  <span className="font-body font-medium text-charcoal">{transaction.memberName}</span>
                                </TableCell>
                                <TableCell>
                                  <span className="font-body text-sm text-charcoal/80">{transaction.reason}</span>
                                </TableCell>
                                <TableCell>
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
                                <TableCell className="text-right">
                                  {transaction.type === "added" && transaction.userPackageId ? (
                                    transaction.movedToMoneyIn ? (
                                      <Pill tone="success">Moved</Pill>
                                    ) : (
                                      <Button type="button" variant="sage-outline" size="sm" onClick={() => openMove(transaction)}>
                                        Move to money in
                                      </Button>
                                    )
                                  ) : (
                                    <span className="font-body text-xs text-charcoal/25">—</span>
                                  )}
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

      <ResponsiveDialog open={moveRow !== null} onOpenChange={(o) => { if (!o) setMoveRow(null); }}>
        <ResponsiveDialogContent className="border-sage/20 bg-white-warm sm:max-w-md">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="font-display text-charcoal">Move to money in</ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="font-body text-charcoal/60">
              {moveRow ? `Record a manual payment for ${moveRow.memberName}'s grant (${moveRow.reason}).` : ""}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-body text-xs text-charcoal/60">Amount (₹)</Label>
                <Input type="number" min="0" inputMode="decimal" value={moveAmount}
                  onChange={(e) => setMoveAmount(e.target.value)} className="border-sage/20 bg-white-warm" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-body text-xs text-charcoal/60">Method</Label>
                <Select value={moveMethod} onValueChange={setMoveMethod}>
                  <SelectTrigger className="border-sage/20 bg-white-warm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="direct_upi">UPI</SelectItem>
                    <SelectItem value="pine_lab_card">Card (Pine Lab)</SelectItem>
                    <SelectItem value="pine_lab_upi">UPI (Pine Lab)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <ResponsiveDialogFooter>
            <Button type="button" variant="outline" className="border-sage/20" onClick={() => setMoveRow(null)} disabled={movingSaving}>Cancel</Button>
            <Button type="button" variant="sage" onClick={submitMove} disabled={movingSaving}>
              {movingSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Move
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}