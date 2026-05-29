import { memo, useCallback, useMemo, useState } from "react";
import { SortableHeader, useTableSort } from "@/components/admin/sortable-table";
import {
  DollarSign,
  Download,
  FileText,
  Filter,
  Search,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/responsive/ResponsiveDialog";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { MetricCard } from "@/components/admin/MetricCard";
import { Pagination, usePagination } from "@/components/Pagination";
import { transactionInExportPeriod, type FinanceReportPeriod } from "@/lib/financeReportExport";

// Recharts MUST be static (see InstructorsTab.tsx comment). Tab itself is dynamic-loaded.
import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";

// Placeholder bar heights for the "Revenue Trend" mock chart. Hoisted so the
// 26-element array isn't re-allocated on every parent rerender.
const REVENUE_TREND_PLACEHOLDER: readonly number[] = [
  45, 52, 48, 61, 55, 58, 63, 59, 67, 64, 71, 68, 75, 72, 78, 82, 79, 85, 88, 84, 91, 87, 94, 92, 98, 99,
];

export type FinanceBreakdownDetail = {
  packageListInr?: number;
  couponDiscountInr?: number;
  classOrStudioPassInr?: number;
  cafeNetInr?: number;
  taxInr?: number;
  totalInr?: number;
};

export type FinanceDetailLine = {
  role: string;
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
};

export type DashboardFinanceDetail = {
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

export type DashboardTxn = {
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

export interface FinanceStats {
  totalRevenue: number;
  totalExpenses: number;
  profit: number;
  coachPayments: number;
  studioExpenses: number;
  memberPayments: number;
  growthRate: number;
}

export interface FinanceTrendRow {
  month: string;
  monthIso: string;
  revenue: number;
  expenses: number;
  profit: number;
}

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

interface Props {
  financeStats: FinanceStats;
  overviewLoaded: boolean;
  financeLedgerTransactions: DashboardTxn[];
  financeTrend: FinanceTrendRow[];
  onExport: (period: FinanceReportPeriod, filtered: DashboardTxn[]) => void;
}

function FinanceTabImpl({
  financeStats,
  overviewLoaded,
  financeLedgerTransactions,
  financeTrend,
  onExport,
}: Props) {
  const [transactionFilter, setTransactionFilter] = useState("all");
  const [transactionDateRange, setTransactionDateRange] = useState("all");
  const [transactionType, setTransactionType] = useState("all");
  const [transactionSearch, setTransactionSearch] = useState("");
  const [financeDetailOpen, setFinanceDetailOpen] = useState(false);
  const [selectedFinanceDetail, setSelectedFinanceDetail] = useState<DashboardFinanceDetail | null>(null);

  const handleSelectFinance = useCallback((detail: DashboardFinanceDetail | undefined) => {
    if (detail) setSelectedFinanceDetail(detail);
    setFinanceDetailOpen(true);
  }, []);

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

  type TxnSortKey = "category" | "member" | "date" | "method" | "amount";
  const getTxnSortValue = useCallback((row: DashboardTxn, key: TxnSortKey): number | string => {
    switch (key) {
      case "category": return row.category;
      case "member": return row.memberFull ?? row.member ?? row.instructor ?? "";
      case "date": return row.sortKey ?? row.date;
      case "method": return row.method;
      case "amount": return row.type === "expense" ? -Math.abs(row.amount) : Math.abs(row.amount);
    }
  }, []);
  const { sorted: sortedFinanceTxns, sortKey: txnSortKey, sortDir: txnSortDir, toggle: toggleTxn } = useTableSort(
    filteredFinanceTransactions,
    {
      initialKey: "date",
      initialDir: "desc",
      getValue: getTxnSortValue,
      defaultDirFor: (k) => (k === "category" || k === "member" || k === "method" ? "asc" : "desc"),
    },
  );
  const financeTxnPg = usePagination(
    sortedFinanceTxns,
    10,
    `${transactionFilter}|${transactionDateRange}|${transactionType}|${transactionSearch}|${txnSortKey}|${txnSortDir}`,
  );

  const handleExport = (period: FinanceReportPeriod) => {
    let rows: DashboardTxn[];
    if (period === "filtered") rows = filteredFinanceTransactions;
    else if (period === "all") rows = financeLedgerTransactions;
    else rows = financeLedgerTransactions.filter((t) => transactionInExportPeriod(t.date, period));
    onExport(period, rows);
  };

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        <MetricCard
          label="Total Revenue"
          value={Math.round(financeStats.totalRevenue)}
          prefix="₹"
          icon={TrendingUp}
          tone="sage"
          loading={!overviewLoaded}
          hint={`+${financeStats.growthRate}% growth`}
        />
        <MetricCard
          label="Total Expenses"
          value={Math.round(financeStats.totalExpenses)}
          prefix="₹"
          icon={TrendingDown}
          tone="terracotta"
          loading={!overviewLoaded}
          hint={`Coach ₹${Math.round(financeStats.coachPayments).toLocaleString("en-IN")} · Studio ₹${Math.round(financeStats.studioExpenses).toLocaleString("en-IN")}`}
        />
        <MetricCard
          label="Net Profit"
          value={Math.round(financeStats.profit)}
          prefix="₹"
          icon={DollarSign}
          tone="sage"
          loading={!overviewLoaded}
          hint={financeStats.totalRevenue > 0
            ? `${((financeStats.profit / financeStats.totalRevenue) * 100).toFixed(0)}% margin`
            : "—"}
        />
      </div>

      <Card className="border-sage/20 bg-white-warm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-display text-2xl text-charcoal">Generate Reports</CardTitle>
              <CardDescription className="font-body text-charcoal/60 mt-1">
                Download financial reports for any time period
              </CardDescription>
            </div>
            <FileText className="h-8 w-8 text-sage/40" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button type="button" variant="sage" className="h-12" onClick={() => handleExport("week")}>
              <Download className="h-4 w-4 mr-2" />
              Weekly Report
            </Button>
            <Button type="button" variant="sage" className="h-12" onClick={() => handleExport("month")}>
              <Download className="h-4 w-4 mr-2" />
              Monthly Report
            </Button>
            <Button type="button" variant="sage" className="h-12" onClick={() => handleExport("quarter")}>
              <Download className="h-4 w-4 mr-2" />
              Quarterly Report
            </Button>
            <Button type="button" variant="sage" className="h-12" onClick={() => handleExport("year")}>
              <Download className="h-4 w-4 mr-2" />
              Annual Report
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-sage/20 bg-white-warm">
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <div>
              <CardTitle className="font-display text-2xl text-charcoal">Recent Transactions</CardTitle>
              <CardDescription className="font-body text-charcoal/60">All financial activities tracked</CardDescription>
            </div>
            <Button type="button" variant="outline" className="border-sage/20 text-sage hover:bg-sage/5 font-body" onClick={() => handleExport("filtered")}>
              <Download className="h-4 w-4 mr-2" />
              Export All
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 rounded-xl bg-cream/30 border border-sage/20">
            <div className="space-y-2">
              <Label className="font-body text-xs text-charcoal/60">Filter by Type</Label>
              <Select value={transactionFilter} onValueChange={setTransactionFilter}>
                <SelectTrigger className="border-sage/20 bg-white"><SelectValue /></SelectTrigger>
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
                <SelectTrigger className="border-sage/20 bg-white"><SelectValue /></SelectTrigger>
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
                <SelectTrigger className="border-sage/20 bg-white"><SelectValue /></SelectTrigger>
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
          <div className="rounded-xl border border-sage/15 bg-white overflow-hidden">
            <ResponsiveTable>
              <Table>
                <TableHeader>
                  <TableRow className="bg-sage/5 hover:bg-sage/5 border-sage/10">
                    <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3 w-[40px]" />
                    <SortableHeader sortKey="category" active={txnSortKey} dir={txnSortDir} onToggle={toggleTxn}>Category</SortableHeader>
                    <SortableHeader sortKey="member" active={txnSortKey} dir={txnSortDir} onToggle={toggleTxn}>Member</SortableHeader>
                    <SortableHeader sortKey="date" active={txnSortKey} dir={txnSortDir} onToggle={toggleTxn} className="w-[120px]">Date</SortableHeader>
                    <SortableHeader sortKey="method" active={txnSortKey} dir={txnSortDir} onToggle={toggleTxn} className="w-[120px]">Method</SortableHeader>
                    <SortableHeader sortKey="amount" active={txnSortKey} dir={txnSortDir} onToggle={toggleTxn} className="w-[140px] text-right" align="right">Amount</SortableHeader>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {financeTxnPg.pageItems.map((txn) => (
                    <FinanceRowView key={txn.id} txn={txn} onSelect={handleSelectFinance} />
                  ))}
                </TableBody>
              </Table>
            </ResponsiveTable>
          </div>
          <Pagination page={financeTxnPg.page} total={financeTxnPg.total} onChange={financeTxnPg.setPage} />

          {filteredFinanceTransactions.length === 0 && (
            <div className="text-center py-12">
              <Filter className="h-12 w-12 text-charcoal/20 mx-auto mb-3" />
              <div className="font-body text-charcoal/60">No transactions match your filters</div>
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

      <ResponsiveDialog
        open={financeDetailOpen}
        onOpenChange={(open) => {
          setFinanceDetailOpen(open);
          if (!open) setSelectedFinanceDetail(null);
        }}
      >
        <ResponsiveDialogContent className="max-h-[85vh] overflow-y-auto border-sage/20 bg-white sm:max-w-lg">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="font-display text-charcoal">Finance-1 — transaction detail</ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="font-body text-charcoal/70">
              Full breakdown (Razorpay, package vs café amounts, and attendees). Shown only when you open this dialog.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          {selectedFinanceDetail ? (
            <div className="space-y-4 font-body text-sm text-charcoal">
              <div>
                <div className="text-xs uppercase tracking-wide text-charcoal/50 mb-1">Transaction type</div>
                <ul className="list-disc pl-5 space-y-1">
                  {(selectedFinanceDetail.transactionKinds ?? ["—"]).map((k, i) => (<li key={i}>{k}</li>))}
                </ul>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-xs uppercase tracking-wide text-charcoal/50 mb-0.5">When</div>
                  <div>
                    {selectedFinanceDetail.source === "package"
                      ? selectedFinanceDetail.purchasedAtISO
                        ? new Date(selectedFinanceDetail.purchasedAtISO).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
                        : "—"
                      : selectedFinanceDetail.bookedAtISO
                        ? new Date(selectedFinanceDetail.bookedAtISO).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
                        : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-charcoal/50 mb-0.5">Payment</div>
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
                  <div className="text-charcoal/70">Seats (member + guests): {selectedFinanceDetail.groupHeadcount}</div>
                ) : null}
              </div>

              <div>
                <div className="font-medium text-charcoal mb-2">Razorpay</div>
                <div className="space-y-1 text-charcoal/80">
                  <div>Order ID: <span className="font-mono text-xs text-charcoal">{selectedFinanceDetail.razorpayOrderId ?? "—"}</span></div>
                  <div>
                    Payment ID(s):{" "}
                    {(selectedFinanceDetail.razorpayPaymentIds?.length ?? 0) > 0
                      ? selectedFinanceDetail.razorpayPaymentIds!.map((pid) => (
                          <span key={pid} className="font-mono text-xs block">{pid}</span>
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
                  {selectedFinanceDetail.breakdown?.couponDiscountInr != null && selectedFinanceDetail.breakdown.couponDiscountInr > 0 ? (
                    <div className="flex justify-between px-3 py-2">
                      <span className="text-charcoal/70">Coupon / discount</span>
                      <span>−{formatInrDetail(selectedFinanceDetail.breakdown.couponDiscountInr)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between px-3 py-2">
                    <span className="text-charcoal/70">
                      {selectedFinanceDetail.source === "package" ? "Studio pass / package" : "Class / pass (checkout)"}
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
                    {selectedFinanceDetail.cafeLines!.map((ln, idx) => (<li key={idx}>{ln.name} × {ln.quantity}</li>))}
                  </ul>
                </div>
              ) : null}

              <div>
                <div className="font-medium text-charcoal mb-2">Members &amp; guests (same checkout)</div>
                <div className="space-y-3">
                  {(selectedFinanceDetail.attendeeLines ?? []).map((row, idx) => (
                    <div key={`${row.role}-${row.name}-${idx}`} className="rounded-lg border border-charcoal/10 p-3 text-charcoal/80 space-y-1">
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
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-sage/20 bg-white-warm">
          <CardHeader>
            <CardTitle className="font-display text-xl text-charcoal">Revenue Trend</CardTitle>
            <CardDescription className="font-body text-charcoal/60">Daily revenue over the past 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="h-64 flex items-end justify-between gap-2">
                {REVENUE_TREND_PLACEHOLDER.map((value, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-linear-to-t from-sage to-sage/40 rounded-t-sm hover:from-sage/90 hover:to-sage/60 transition-all duration-300 cursor-pointer relative group"
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

        <Card className="border-sage/20 bg-white-warm">
          <CardHeader>
            <CardTitle className="font-display text-xl text-charcoal">Revenue Sources</CardTitle>
            <CardDescription className="font-body text-charcoal/60">Breakdown by revenue type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-8">
              <div className="relative w-48 h-48">
                <svg viewBox="0 0 100 100" className="transform -rotate-90">
                  <circle cx="50" cy="50" r="40" fill="transparent" stroke="#8F9779" strokeWidth="20" strokeDasharray="213 251" className="hover:opacity-80 transition-opacity cursor-pointer" />
                  <circle cx="50" cy="50" r="40" fill="transparent" stroke="#D4A574" strokeWidth="20" strokeDasharray="38 226" strokeDashoffset="-213" className="hover:opacity-80 transition-opacity cursor-pointer" />
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

        <Card className="border-sage/20 bg-white-warm lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-display text-xl text-charcoal">Monthly P&amp;L</CardTitle>
            <CardDescription className="font-body text-charcoal/60">Revenue vs expenses over the past 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            {financeTrend.length === 0 ? (
              <div className="h-[280px] flex items-center justify-center font-body text-sm text-charcoal/40">No data yet.</div>
            ) : (
              <ChartContainer
                config={{
                  revenue: { label: "Revenue", color: "#8F9779" },
                  expenses: { label: "Expenses", color: "#C17856" },
                  profit: { label: "Profit", color: "#6B8E73" },
                }}
                className="h-[300px] w-full"
              >
                <ComposedChart data={financeTrend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E5E5E0" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#6B6B6B" }} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: "#6B6B6B" }}
                    tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`}
                    width={48}
                  />
                  <ChartTooltip
                    cursor={{ fill: "rgba(143,151,121,0.05)" }}
                    content={<ChartTooltipContent formatter={(v) => `₹${Number(v).toLocaleString("en-IN")}`} />}
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[6, 6, 0, 0]} maxBarSize={36} />
                  <Bar dataKey="expenses" fill="var(--color-expenses)" radius={[6, 6, 0, 0]} maxBarSize={36} />
                  <Line type="monotone" dataKey="profit" stroke="var(--color-profit)" strokeWidth={2.5} dot={{ r: 4, fill: "var(--color-profit)" }} activeDot={{ r: 6 }} />
                </ComposedChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export const FinanceTab = memo(FinanceTabImpl);

const FinanceRowView = memo(function FinanceRowView({
  txn,
  onSelect,
}: {
  txn: DashboardTxn;
  onSelect: (detail: DashboardFinanceDetail | undefined) => void;
}) {
  const openFinance = txn.finance1Tag === true && txn.financeDetail != null;
  const displayMember = txn.memberFull ?? txn.member ?? txn.instructor ?? "Studio";
  const plus = txn.memberPlusLabel?.trim() ? ` ${txn.memberPlusLabel.trim()}` : "";
  const handleClick = openFinance ? () => onSelect(txn.financeDetail) : undefined;

  return (
    <TableRow
      className={`border-sage/10 ${openFinance ? "cursor-pointer hover:bg-sage/5" : ""}`}
      onClick={handleClick}
    >
      <TableCell className="px-5 py-3">
        <div className={`p-2 rounded-lg w-fit ${txn.type === "revenue" ? "bg-sage/10" : "bg-red-50"}`}>
          {txn.type === "revenue"
            ? <TrendingUp className="h-4 w-4 text-sage" />
            : <TrendingDown className="h-4 w-4 text-red-500" />}
        </div>
      </TableCell>
      <TableCell className="px-5 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-body font-medium text-charcoal">{txn.category}</span>
          {txn.isFinanceDemo && (
            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900 text-[10px] uppercase tracking-wide font-body">Sample</Badge>
          )}
        </div>
        {txn.foodOrderedLabel && txn.foodOrderedLabel !== "—" && (
          <div className="font-body text-xs text-charcoal/50 mt-0.5 truncate" title={txn.foodOrderedLabel}>{txn.foodOrderedLabel}</div>
        )}
      </TableCell>
      <TableCell className="px-5 py-3">
        <div className="font-body text-sm text-charcoal truncate">
          {displayMember}
          {plus && <span className="text-sage font-medium">{plus}</span>}
        </div>
      </TableCell>
      <TableCell className="px-5 py-3 font-body text-sm text-charcoal/60 whitespace-nowrap">{txn.date}</TableCell>
      <TableCell className="px-5 py-3">
        <Badge variant="outline" className="border-charcoal/15 text-charcoal/60 font-body whitespace-nowrap">{txn.method}</Badge>
      </TableCell>
      <TableCell className="px-5 py-3 text-right">
        <span className={`font-display text-base tabular-nums ${txn.type === "revenue" ? "text-sage" : "text-red-500"}`}>
          {formatTxnAmountRupee(txn.amount, txn.type)}
        </span>
      </TableCell>
    </TableRow>
  );
});
