import { memo, useCallback, useMemo, useState, type ReactNode } from "react";
import { SortableHeader, useTableSort } from "@/components/admin/sortable-table";
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Check,
  ChevronsUpDown,
  DollarSign,
  Download,
  FileText,
  Filter,
  PieChart,
  Search,
  Smartphone,
  TrendingDown,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Pill, type PillProps } from "@/components/ui/pill";
import { financeKindPill } from "@/lib/pillMaps";
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
import { FilterDateRange } from "@/components/filters";
import type { DateRange } from "react-day-picker";
import { Pagination, usePagination } from "@/components/Pagination";
import { transactionInExportPeriod, type FinanceReportPeriod } from "@/lib/financeReportExport";

// Recharts MUST be static (see InstructorsTab.tsx comment). Tab itself is dynamic-loaded.
import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";

// Compact rupee for insight readouts (₹1.24L / ₹12.5k / ₹940).
function compactInr(n: number): string {
  const abs = Math.abs(Math.round(n));
  if (abs >= 100000) return `₹${(abs / 100000).toFixed(2)}L`;
  if (abs >= 1000) return `₹${(abs / 1000).toFixed(1)}k`;
  return `₹${abs.toLocaleString("en-IN")}`;
}

type RevenueSourceSlice = { key: string; label: string; amount: number; color: string };

// Bucket ledger revenue by what the row actually is. Buckets are mutually
// exclusive per row (one transaction, one source), so the rupee split is honest
// rather than guessed. Café shows as a count, not a rupee slice, because café
// add-ons ride inside a package/booking total and can't be cleanly separated here.
function summarizeRevenueBySource(txns: DashboardTxn[]): {
  slices: RevenueSourceSlice[];
  total: number;
  cafeCount: number;
} {
  let pkg = 0;
  let cls = 0;
  let other = 0;
  let cafeCount = 0;
  for (const t of txns) {
    if (t.type !== "revenue") continue;
    const amt = Math.abs(t.amount);
    const id = String(t.id);
    const cat = t.category.toLowerCase();
    const isPackage = cat.includes("(package)") || id.startsWith("package-") || id.startsWith("demo-finance-package");
    const isClass = id.startsWith("booking-") || id.startsWith("demo-finance-booking");
    if (isPackage) pkg += amt;
    else if (isClass) cls += amt;
    else other += amt;
    const food = t.foodOrderedLabel?.toLowerCase() ?? "";
    if (food && food !== "—" && food.includes("food")) cafeCount += 1;
  }
  const slices = [
    { key: "package", label: "Package purchases", amount: pkg, color: "#8f9779" },
    { key: "class", label: "Class checkouts", amount: cls, color: "#c17856" },
    { key: "other", label: "Other revenue", amount: other, color: "#a8a296" },
  ]
    .filter((s) => s.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  return { slices, total: pkg + cls + other, cafeCount };
}

// Online (Razorpay) vs everything else (cash, Pine Lab, direct UPI) across the
// ledger's revenue rows.
function summarizePaymentMix(txns: DashboardTxn[]): { online: number; offline: number; total: number } {
  let online = 0;
  let offline = 0;
  for (const t of txns) {
    if (t.type !== "revenue") continue;
    const amt = Math.abs(t.amount);
    if (t.method.toLowerCase().includes("razorpay")) online += amt;
    else offline += amt;
  }
  return { online, offline, total: online + offline };
}

// Month-over-month and best-month read from the authoritative finance trend.
function summarizeTrend(trend: FinanceTrendRow[]): {
  current: FinanceTrendRow;
  momPct: number | null;
  best: FinanceTrendRow;
} | null {
  if (trend.length === 0) return null;
  const current = trend[trend.length - 1];
  const prev = trend.length > 1 ? trend[trend.length - 2] : null;
  const momPct = prev && prev.revenue > 0 ? ((current.revenue - prev.revenue) / prev.revenue) * 100 : null;
  const best = trend.reduce((a, b) => (b.revenue > a.revenue ? b : a), trend[0]);
  return { current, momPct, best };
}

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

function txnPassesDateRange(displayDateYYYYMMDD: string, range: string, custom?: DateRange): boolean {
  if (range === "all") return true;
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
  if (range === "custom") {
    if (!custom?.from) return true;
    const from = new Date(custom.from.getFullYear(), custom.from.getMonth(), custom.from.getDate());
    const toSrc = custom.to ?? custom.from;
    const to = new Date(toSrc.getFullYear(), toSrc.getMonth(), toSrc.getDate());
    return txnDay >= from && txnDay <= to; // `to` inclusive (whole selected end day)
  }
  return true;
}

function formatTxnAmountRupee(amount: number, type: string): string {
  const rounded = Math.round(amount);
  const abs = Math.abs(rounded);
  let prefix = "";
  if (type === "revenue") prefix = "+";
  else if (type === "expense") prefix = "-";
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

function formatFinanceDetailWhen(detail: DashboardFinanceDetail): string {
  const iso = detail.source === "package" ? detail.purchasedAtISO : detail.bookedAtISO;
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

// Categorical tag for what a transaction is. Returns a stable label; the pill
// tone is derived from the label via `financeKindPill`.
function txnKind(txn: DashboardTxn): { label: string } {
  const id = String(txn.id);
  const cat = txn.category.toLowerCase();
  const food = txn.foodOrderedLabel?.toLowerCase() ?? "";
  const hasCafe = (food.includes("food") && !food.includes("no food")) || cat.includes("café") || cat.includes("cafe");

  if (txn.type === "expense") {
    let label = "Expense";
    if (cat.includes("coach")) label = "Coach payout";
    else if (cat.includes("rent") || cat.includes("studio")) label = "Studio";
    return { label };
  }
  const isPackage = cat.includes("(package)") || id.startsWith("pkg-") || id.startsWith("demo-finance-package");
  const isClass = id.startsWith("booking-") || id.startsWith("demo-finance-booking");
  if (isPackage) return { label: "Package" };
  if (isClass) return { label: hasCafe ? "Class + Café" : "Class" };
  if (hasCafe) return { label: "Café" };
  return { label: "Revenue" };
}

// Resolve a payment-method pill (tone + brand tint) from the row's display
// label. `txn.method` is a human label ("Razorpay", "Pine Labs UPI", "Cash",
// "—"), not the enum, so we match on the string rather than `paymentMethodPill`.
function methodPill(method: string): { tone?: PillProps["tone"]; brand?: PillProps["brand"]; isCash: boolean } {
  const m = method.toLowerCase().trim();
  if (m.includes("razorpay") || m === "online") return { brand: "razorpay", isCash: false };
  if (m.includes("pine")) return { brand: "pinelabs", isCash: false };
  if (m.includes("upi")) return { brand: "upi", isCash: false };
  if (m.includes("cash")) return { tone: "success", isCash: true };
  return { tone: "neutral", isCash: false };
}

// Time-of-day from the row's ISO sort key (the date column only shows the day).
function formatTxnTime(sortKey?: string): string | null {
  if (!sortKey) return null;
  const d = new Date(sortKey);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

// Resolve which rows to hand to the export, shared by both sections so the
// Overview "Generate Reports" buttons and the Transactions "Export" button
// can't drift on what each period means.
function buildExportRows(
  period: FinanceReportPeriod,
  ledger: DashboardTxn[],
  filtered: DashboardTxn[],
): DashboardTxn[] {
  if (period === "filtered") return filtered;
  if (period === "all") return ledger;
  return ledger.filter((t) => transactionInExportPeriod(t.date, period));
}

// ──────────────────────────────────────────────────────────────────────────
// Overview section: headline metrics, report downloads, P&L / trend charts.
// ──────────────────────────────────────────────────────────────────────────

export interface FinanceOverviewSectionProps {
  financeStats: FinanceStats;
  overviewLoaded: boolean;
  financeLedgerTransactions: DashboardTxn[];
  financeTrend: FinanceTrendRow[];
  onExport: (period: FinanceReportPeriod, rows: DashboardTxn[]) => void;
}

interface MomPresentation {
  hint: string;
  pillTone: "success" | "danger" | "neutral";
  pillIcon: ReactNode;
  pillText: string;
}

// Plain-language month-over-month readout + pill styling from the trend's momPct.
function deriveMomPresentation(hasTrend: boolean, momPct: number | null | undefined): MomPresentation {
  if (momPct == null) {
    return {
      hint: hasTrend ? "first month tracked" : "—",
      pillTone: "neutral",
      pillIcon: null,
      pillText: "First month tracked",
    };
  }
  const up = momPct >= 0;
  const magnitude = Math.abs(momPct).toFixed(0);
  return {
    hint: `${up ? "▲" : "▼"} ${magnitude}% vs last month`,
    pillTone: up ? "success" : "danger",
    pillIcon: up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />,
    pillText: `${magnitude}% vs last month`,
  };
}

function FinanceOverviewSectionImpl({
  financeStats,
  overviewLoaded,
  financeLedgerTransactions,
  financeTrend,
  onExport,
}: Readonly<FinanceOverviewSectionProps>) {
  const handleExport = useCallback(
    (period: FinanceReportPeriod) => {
      onExport(period, buildExportRows(period, financeLedgerTransactions, financeLedgerTransactions));
    },
    [financeLedgerTransactions, onExport],
  );

  const sources = useMemo(() => summarizeRevenueBySource(financeLedgerTransactions), [financeLedgerTransactions]);
  const methods = useMemo(() => summarizePaymentMix(financeLedgerTransactions), [financeLedgerTransactions]);
  const trend = useMemo(() => summarizeTrend(financeTrend), [financeTrend]);
  const revenueTxnCount = useMemo(
    () => financeLedgerTransactions.filter((t) => t.type === "revenue").length,
    [financeLedgerTransactions],
  );

  // Real month-over-month from the trend; replaces the old hardcoded growth hint.
  const { hint: momHint, pillTone: momPillTone, pillIcon: momPillIcon, pillText: momPillText } =
    deriveMomPresentation(!!trend, trend?.momPct);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        <MetricCard
          label="Total Revenue"
          value={Math.round(financeStats.totalRevenue)}
          prefix="₹"
          icon={TrendingUp}
          tone="sage"
          loading={!overviewLoaded}
          hint={momHint}
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

      {/* Hero: the authoritative monthly trend with a plain-language readout. */}
      <Card className="border-sage/20 bg-white-warm">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="font-display text-xl text-charcoal">Revenue, expenses &amp; profit</CardTitle>
              <CardDescription className="font-body text-charcoal/60">Last 6 months, from recorded payments and instructor payouts</CardDescription>
            </div>
            {trend ? (
              <Pill tone={momPillTone} size="md" icon={momPillIcon}>
                {momPillText}
              </Pill>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {financeTrend.length === 0 || !trend ? (
            <div className="h-[300px] flex flex-col items-center justify-center gap-2 font-body text-sm text-charcoal/40">
              <TrendingUp className="h-8 w-8 text-charcoal/15" />
              No revenue recorded yet.
            </div>
          ) : (
            <>
              <div className="mb-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-sage/15 bg-sage/5 px-4 py-3">
                  <div className="font-body text-xs uppercase tracking-wide text-charcoal/50">This month</div>
                  <div className="font-display text-2xl text-charcoal tabular-nums">{compactInr(trend.current.revenue)}</div>
                </div>
                <div className="rounded-xl border border-charcoal/10 bg-white px-4 py-3">
                  <div className="font-body text-xs uppercase tracking-wide text-charcoal/50">This month profit</div>
                  <div className={`font-display text-2xl tabular-nums ${trend.current.profit >= 0 ? "text-sage" : "text-terracotta"}`}>{compactInr(trend.current.profit)}</div>
                </div>
                <div className="col-span-2 sm:col-span-1 rounded-xl border border-charcoal/10 bg-white px-4 py-3">
                  <div className="font-body text-xs uppercase tracking-wide text-charcoal/50 flex items-center gap-1"><Trophy className="h-3.5 w-3.5 text-sage" /> Best month</div>
                  <div className="font-display text-2xl text-charcoal tabular-nums">
                    {compactInr(trend.best.revenue)} <span className="font-body text-sm text-charcoal/50">{trend.best.month}</span>
                  </div>
                </div>
              </div>
              <ChartContainer
                config={{
                  revenue: { label: "Revenue", color: "#8F9779" },
                  expenses: { label: "Expenses", color: "#C17856" },
                  profit: { label: "Profit", color: "#6B8E73" },
                }}
                className="h-[280px] w-full"
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
            </>
          )}
        </CardContent>
      </Card>

      {/* Real revenue mix + payment split, both computed from the ledger. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-sage/20 bg-white-warm">
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="font-display text-xl text-charcoal">Where revenue comes from</CardTitle>
                <CardDescription className="font-body text-charcoal/60">
                  Across {revenueTxnCount} transaction{revenueTxnCount === 1 ? "" : "s"} in view
                </CardDescription>
              </div>
              <PieChart className="h-5 w-5 text-sage/40 shrink-0" />
            </div>
          </CardHeader>
          <CardContent>
            {sources.total === 0 ? (
              <div className="py-10 text-center font-body text-sm text-charcoal/40">No revenue to break down yet.</div>
            ) : (
              <div className="space-y-4">
                {sources.slices.map((s) => {
                  const pct = (s.amount / sources.total) * 100;
                  return (
                    <div key={s.key}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-2">
                        <span className="flex items-center gap-2 font-body text-sm text-charcoal">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                          {s.label}
                        </span>
                        <span className="font-body text-sm tabular-nums text-charcoal/60">
                          <span className="font-medium text-charcoal">{compactInr(s.amount)}</span> · {pct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-charcoal/5">
                        <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: s.color }} />
                      </div>
                    </div>
                  );
                })}
                {sources.cafeCount > 0 ? (
                  <p className="pt-1 font-body text-xs text-charcoal/45">
                    {sources.cafeCount} included café items, counted inside their parent sale.
                  </p>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-sage/20 bg-white-warm">
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="font-display text-xl text-charcoal">How members pay</CardTitle>
                <CardDescription className="font-body text-charcoal/60">Online vs in-studio, by amount collected</CardDescription>
              </div>
              <Banknote className="h-5 w-5 text-sage/40 shrink-0" />
            </div>
          </CardHeader>
          <CardContent>
            {methods.total === 0 ? (
              <div className="py-10 text-center font-body text-sm text-charcoal/40">No payments to split yet.</div>
            ) : (
              <div className="space-y-5">
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-charcoal/5">
                  <div className="h-full bg-sage" style={{ width: `${(methods.online / methods.total) * 100}%` }} />
                  <div className="h-full bg-terracotta" style={{ width: `${(methods.offline / methods.total) * 100}%` }} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-sage/15 bg-sage/5 px-4 py-3">
                    <div className="flex items-center gap-1 font-body text-xs uppercase tracking-wide text-charcoal/50">
                      <Smartphone className="h-3.5 w-3.5 text-sage" /> Online
                    </div>
                    <div className="font-display text-xl text-charcoal tabular-nums">{compactInr(methods.online)}</div>
                    <div className="font-body text-xs text-charcoal/50">{((methods.online / methods.total) * 100).toFixed(0)}% · Razorpay</div>
                  </div>
                  <div className="rounded-xl border border-terracotta/15 bg-terracotta/5 px-4 py-3">
                    <div className="flex items-center gap-1 font-body text-xs uppercase tracking-wide text-charcoal/50">
                      <Banknote className="h-3.5 w-3.5 text-terracotta" /> In-studio
                    </div>
                    <div className="font-display text-xl text-charcoal tabular-nums">{compactInr(methods.offline)}</div>
                    <div className="font-body text-xs text-charcoal/50">{((methods.offline / methods.total) * 100).toFixed(0)}% · cash / card / UPI</div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Reports last: an action surface, not an insight. */}
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
    </div>
  );
}

export const FinanceOverviewSection = memo(FinanceOverviewSectionImpl);

// Searchable single-select for the long, dynamic filters (member, method).
// shadcn Select has no search, so this pairs Popover + cmdk Command like the
// schedule page's class/instructor pickers.
function FilterCombobox({
  value,
  onValueChange,
  options,
  allLabel,
  searchPlaceholder,
  emptyText,
}: Readonly<{
  value: string;
  onValueChange: (v: string) => void;
  options: string[];
  allLabel: string;
  searchPlaceholder: string;
  emptyText: string;
}>) {
  const [open, setOpen] = useState(false);
  const label = value === "all" ? allLabel : value;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between border-sage/20 bg-white-warm font-body font-normal text-charcoal hover:bg-white-warm"
        >
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} className="font-body" />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={allLabel}
                onSelect={() => {
                  onValueChange("all");
                  setOpen(false);
                }}
                className="font-body text-charcoal data-[selected=true]:bg-sage/10 data-[selected=true]:text-charcoal"
              >
                <Check className={cn("mr-2 h-4 w-4", value === "all" ? "opacity-100" : "opacity-0")} />
                {allLabel}
              </CommandItem>
              {options.map((opt) => (
                <CommandItem
                  key={opt}
                  value={opt}
                  onSelect={() => {
                    onValueChange(opt);
                    setOpen(false);
                  }}
                  className="font-body text-charcoal data-[selected=true]:bg-sage/10 data-[selected=true]:text-charcoal"
                >
                  <Check className={cn("mr-2 h-4 w-4", value === opt ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{opt}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Transactions section: filters, the ledger table, and the Finance-1 detail
// dialog. Owns its own filter / sort / pagination state.
// ──────────────────────────────────────────────────────────────────────────

export interface FinanceTransactionsSectionProps {
  financeLedgerTransactions: DashboardTxn[];
  onExport: (period: FinanceReportPeriod, rows: DashboardTxn[]) => void;
}

interface TxnFilterCriteria {
  filter: string;
  dateRange: string;
  customRange?: DateRange;
  type: string;
  member: string;
  method: string;
  query: string;
}

function txnMatchesType(txn: DashboardTxn, type: string): boolean {
  if (type === "all") return true;
  const catLow = txn.category.toLowerCase();
  if (type === "packages") return catLow.includes("(package)");
  if (type === "coach") return txn.category === "Coach Payment";
  if (type === "studio") return txn.category === "Studio Rent";
  if (type === "class_bookings") {
    return String(txn.id).startsWith("booking-") || String(txn.id).startsWith("demo-finance-booking");
  }
  if (type === "cafe") {
    const foodLbl = txn.foodOrderedLabel?.toLowerCase() ?? "";
    return foodLbl.includes("food ordered") || catLow.includes("café") || catLow.includes("cafe");
  }
  return true;
}

// Single predicate for the ledger filters. Pure — no component state captured.
function txnMatchesFilters(txn: DashboardTxn, c: TxnFilterCriteria): boolean {
  if (!txnPassesDateRange(txn.date, c.dateRange, c.customRange)) return false;
  if (c.filter === "credit" && txn.type !== "revenue") return false;
  if (c.filter === "debit" && txn.type !== "expense") return false;

  if (c.member !== "all") {
    const name = txn.memberFull ?? txn.member ?? txn.instructor ?? "";
    if (name.trim() !== c.member) return false;
  }
  if (c.method !== "all" && txn.method !== c.method) return false;

  if (!txnMatchesType(txn, c.type)) return false;

  if (c.query) {
    const hay = `${txn.member ?? ""} ${txn.memberFull ?? ""} ${txn.instructor ?? ""} ${txn.category} ${txn.method} ${txn.foodOrderedLabel ?? ""} ${txn.memberPlusLabel ?? ""} ${txn.id}`.toLowerCase();
    if (!hay.includes(c.query)) return false;
  }

  return true;
}

function FinanceDetailRazorpay({ detail }: Readonly<{ detail: DashboardFinanceDetail }>) {
  const hasPaymentIds = (detail.razorpayPaymentIds?.length ?? 0) > 0;
  return (
    <div>
      <div className="font-medium text-charcoal mb-2">Razorpay</div>
      <div className="space-y-1 text-charcoal/80">
        <div>Order ID: <span className="font-mono text-xs text-charcoal">{detail.razorpayOrderId ?? "—"}</span></div>
        <div>
          Payment ID(s):{" "}
          {hasPaymentIds
            ? detail.razorpayPaymentIds?.map((pid) => (
                <span key={pid} className="font-mono text-xs block">{pid}</span>
              ))
            : "—"}
        </div>
      </div>
    </div>
  );
}

function FinanceDetailAmounts({ detail }: Readonly<{ detail: DashboardFinanceDetail }>) {
  const b = detail.breakdown;
  const showCoupon = b?.couponDiscountInr != null && b.couponDiscountInr > 0;
  return (
    <div>
      <div className="font-medium text-charcoal mb-2">Amounts (INR)</div>
      <div className="rounded-xl border border-charcoal/10 divide-y divide-charcoal/10">
        {b?.packageListInr != null ? (
          <div className="flex justify-between px-3 py-2">
            <span className="text-charcoal/70">Package list</span>
            <span>{formatInrDetail(b.packageListInr)}</span>
          </div>
        ) : null}
        {showCoupon ? (
          <div className="flex justify-between px-3 py-2">
            <span className="text-charcoal/70">Coupon / discount</span>
            <span>−{formatInrDetail(b?.couponDiscountInr)}</span>
          </div>
        ) : null}
        <div className="flex justify-between px-3 py-2">
          <span className="text-charcoal/70">
            {detail.source === "package" ? "Studio pass / package" : "Class / pass (checkout)"}
          </span>
          <span>{formatInrDetail(b?.classOrStudioPassInr)}</span>
        </div>
        <div className="flex justify-between px-3 py-2">
          <span className="text-charcoal/70">Café (food &amp; add-ons, net)</span>
          <span>{formatInrDetail(b?.cafeNetInr)}</span>
        </div>
        <div className="flex justify-between px-3 py-2">
          <span className="text-charcoal/70">Tax</span>
          <span>{formatInrDetail(b?.taxInr)}</span>
        </div>
        <div className="flex justify-between px-3 py-2 font-semibold">
          <span>Total charged</span>
          <span>{formatInrDetail(b?.totalInr)}</span>
        </div>
      </div>
    </div>
  );
}

function FinanceDetailAttendees({ detail }: Readonly<{ detail: DashboardFinanceDetail }>) {
  return (
    <div>
      <div className="font-medium text-charcoal mb-2">Members &amp; guests (same checkout)</div>
      <div className="space-y-3">
        {(detail.attendeeLines ?? []).map((row, idx) => (
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
  );
}

// Full transaction detail dialog body. Pure presentation of the selected detail.
function FinanceDetailBody({ detail }: Readonly<{ detail: DashboardFinanceDetail }>) {
  const hasCafeLines = (detail.cafeLines?.length ?? 0) > 0;
  return (
    <div className="space-y-4 font-body text-sm text-charcoal">
      <div>
        <div className="text-xs uppercase tracking-wide text-charcoal/50 mb-1">Transaction type</div>
        <ul className="list-disc pl-5 space-y-1">
          {(detail.transactionKinds ?? ["—"]).map((k) => (<li key={k}>{k}</li>))}
        </ul>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-charcoal/50 mb-0.5">When</div>
          <div>{formatFinanceDetailWhen(detail)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-charcoal/50 mb-0.5">Payment</div>
          <div>{detail.paymentMethodSummary ?? "—"}</div>
        </div>
      </div>

      <div className="rounded-xl border border-charcoal/10 bg-sage/5 p-3 space-y-2">
        <div className="font-medium text-charcoal">Billing member</div>
        <div>Name: {detail.memberName ?? "—"}</div>
        <div>Email: {detail.memberEmail ?? "—"}</div>
        <div>Phone: {detail.memberPhone ?? "—"}</div>
        {detail.classSummary ? (
          <div className="pt-1 text-charcoal/80">{detail.classSummary}</div>
        ) : null}
        {detail.groupHeadcount != null ? (
          <div className="text-charcoal/70">Seats (member + guests): {detail.groupHeadcount}</div>
        ) : null}
      </div>

      <FinanceDetailRazorpay detail={detail} />
      <FinanceDetailAmounts detail={detail} />

      {hasCafeLines ? (
        <div>
          <div className="font-medium text-charcoal mb-2">Café items</div>
          <ul className="list-disc pl-5 space-y-1 text-charcoal/80">
            {detail.cafeLines?.map((ln) => (<li key={`${ln.name}-${ln.quantity}`}>{ln.name} × {ln.quantity}</li>))}
          </ul>
        </div>
      ) : null}

      <FinanceDetailAttendees detail={detail} />
    </div>
  );
}

function FinanceTransactionsSectionImpl({
  financeLedgerTransactions,
  onExport,
}: Readonly<FinanceTransactionsSectionProps>) {
  const [transactionFilter, setTransactionFilter] = useState("all");
  const [transactionDateRange, setTransactionDateRange] = useState("all");
  const [transactionCustomRange, setTransactionCustomRange] = useState<DateRange | undefined>(undefined);
  const [transactionType, setTransactionType] = useState("all");
  const [transactionMember, setTransactionMember] = useState("all");
  const [transactionMethod, setTransactionMethod] = useState("all");
  const [transactionSearch, setTransactionSearch] = useState("");
  const [financeDetailOpen, setFinanceDetailOpen] = useState(false);
  const [selectedFinanceDetail, setSelectedFinanceDetail] = useState<DashboardFinanceDetail | null>(null);

  const handleSelectFinance = useCallback((detail: DashboardFinanceDetail | undefined) => {
    if (detail) setSelectedFinanceDetail(detail);
    setFinanceDetailOpen(true);
  }, []);

  // Distinct members and methods present in the ledger, for the dropdown filters.
  const memberOptions = useMemo(() => {
    const set = new Set<string>();
    for (const t of financeLedgerTransactions) {
      const name = t.memberFull ?? t.member ?? t.instructor;
      if (name?.trim()) set.add(name.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [financeLedgerTransactions]);

  const methodOptions = useMemo(() => {
    const set = new Set<string>();
    for (const t of financeLedgerTransactions) {
      if (t.method?.trim() && t.method !== "—") set.add(t.method.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [financeLedgerTransactions]);

  const resetFilters = useCallback(() => {
    setTransactionFilter("all");
    setTransactionDateRange("all");
    setTransactionCustomRange(undefined);
    setTransactionType("all");
    setTransactionMember("all");
    setTransactionMethod("all");
    setTransactionSearch("");
  }, []);

  const filteredFinanceTransactions = useMemo(() => {
    const criteria: TxnFilterCriteria = {
      filter: transactionFilter,
      dateRange: transactionDateRange,
      customRange: transactionCustomRange,
      type: transactionType,
      member: transactionMember,
      method: transactionMethod,
      query: transactionSearch.trim().toLowerCase(),
    };
    return financeLedgerTransactions.filter((txn) => txnMatchesFilters(txn, criteria));
  }, [
    financeLedgerTransactions,
    transactionFilter,
    transactionDateRange,
    transactionCustomRange,
    transactionType,
    transactionMember,
    transactionMethod,
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
    `${transactionFilter}|${transactionDateRange}|${transactionCustomRange?.from?.toDateString() ?? ""}-${transactionCustomRange?.to?.toDateString() ?? ""}|${transactionType}|${transactionMember}|${transactionMethod}|${transactionSearch}|${txnSortKey}|${txnSortDir}`,
  );

  const handleExport = (period: FinanceReportPeriod) => {
    onExport(period, buildExportRows(period, financeLedgerTransactions, filteredFinanceTransactions));
  };

  return (
    <>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4 rounded-xl bg-cream/30 border border-sage/20">
            <div className="space-y-2">
              <Label className="font-body text-xs text-charcoal/60">Filter by Type</Label>
              <Select value={transactionFilter} onValueChange={setTransactionFilter}>
                <SelectTrigger className="border-sage/20 bg-white-warm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Transactions</SelectItem>
                  <SelectItem value="credit">💰 Credits Only</SelectItem>
                  <SelectItem value="debit">💸 Debits Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="font-body text-xs text-charcoal/60">Date Range</Label>
              <Select
                value={transactionDateRange}
                onValueChange={(v) => {
                  setTransactionDateRange(v);
                  if (v !== "custom") setTransactionCustomRange(undefined);
                }}
              >
                <SelectTrigger className="border-sage/20 bg-white-warm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
              {transactionDateRange === "custom" && (
                <FilterDateRange
                  value={transactionCustomRange}
                  onChange={setTransactionCustomRange}
                  placeholder="Pick dates"
                />
              )}
            </div>
            <div className="space-y-2">
              <Label className="font-body text-xs text-charcoal/60">Category</Label>
              <Select value={transactionType} onValueChange={setTransactionType}>
                <SelectTrigger className="border-sage/20 bg-white-warm"><SelectValue /></SelectTrigger>
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
              <Label className="font-body text-xs text-charcoal/60">Member</Label>
              <FilterCombobox
                value={transactionMember}
                onValueChange={setTransactionMember}
                options={memberOptions}
                allLabel="All Members"
                searchPlaceholder="Search members…"
                emptyText="No members found."
              />
            </div>
            <div className="space-y-2">
              <Label className="font-body text-xs text-charcoal/60">Payment Method</Label>
              <FilterCombobox
                value={transactionMethod}
                onValueChange={setTransactionMethod}
                options={methodOptions}
                allLabel="All Methods"
                searchPlaceholder="Search methods…"
                emptyText="No methods found."
              />
            </div>
            <div className="space-y-2">
              <Label className="font-body text-xs text-charcoal/60">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-charcoal/40" />
                <Input
                  placeholder="Search transactions..."
                  value={transactionSearch}
                  onChange={(e) => setTransactionSearch(e.target.value)}
                  className="border-sage/20 bg-white-warm pl-9"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {financeLedgerTransactions.some((t) => t.isFinanceDemo) ? (
            <p className="mb-4 rounded-lg border border-terracotta/20 bg-terracotta/10 px-3 py-2 font-body text-sm text-[#a05e38]">
              Rows marked <strong>Sample</strong> are preview data so you can see Finance-1 layout
              (+N guests, food labels, detail dialog). Real payments appear without that badge.
            </p>
          ) : null}
          <div className="rounded-xl border border-sage/15 bg-white-warm overflow-hidden">
            <ResponsiveTable>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[44px]" />
                    <TableHead className="w-[132px]">Type</TableHead>
                    <SortableHeader sortKey="category" active={txnSortKey} dir={txnSortDir} onToggle={toggleTxn}>Category</SortableHeader>
                    <SortableHeader sortKey="member" active={txnSortKey} dir={txnSortDir} onToggle={toggleTxn} className="w-[180px]">Member</SortableHeader>
                    <SortableHeader sortKey="date" active={txnSortKey} dir={txnSortDir} onToggle={toggleTxn} className="w-[150px]">Date</SortableHeader>
                    <SortableHeader sortKey="method" active={txnSortKey} dir={txnSortDir} onToggle={toggleTxn} className="w-[150px]">Method</SortableHeader>
                    <SortableHeader sortKey="amount" active={txnSortKey} dir={txnSortDir} onToggle={toggleTxn} className="w-[130px] text-right" align="right">Amount</SortableHeader>
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
                onClick={resetFilters}
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
        <ResponsiveDialogContent className="max-h-[85vh] overflow-y-auto border-sage/20 bg-white-warm sm:max-w-lg">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="font-display text-charcoal">Finance-1 — transaction detail</ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="font-body text-charcoal/70">
              Full breakdown (Razorpay, package vs café amounts, and attendees). Shown only when you open this dialog.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          {selectedFinanceDetail ? <FinanceDetailBody detail={selectedFinanceDetail} /> : null}
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}

export const FinanceTransactionsSection = memo(FinanceTransactionsSectionImpl);

// ──────────────────────────────────────────────────────────────────────────
// Combined tab: overview + transactions stacked. Used by the admin dashboard
// "Finance" tab so its layout is unchanged. The standalone /admin/finances
// page composes the same two sections under sub-tabs instead.
// ──────────────────────────────────────────────────────────────────────────

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
}: Readonly<Props>) {
  return (
    <>
      <FinanceOverviewSection
        financeStats={financeStats}
        overviewLoaded={overviewLoaded}
        financeLedgerTransactions={financeLedgerTransactions}
        financeTrend={financeTrend}
        onExport={onExport}
      />
      <FinanceTransactionsSection
        financeLedgerTransactions={financeLedgerTransactions}
        onExport={onExport}
      />
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
  const kind = txnKind(txn);
  const method = methodPill(txn.method);
  const time = formatTxnTime(txn.sortKey);

  return (
    <TableRow
      className={openFinance ? "cursor-pointer" : undefined}
      onClick={handleClick}
    >
      <TableCell>
        <div className={`p-2 rounded-lg w-fit ${txn.type === "revenue" ? "bg-sage/10" : "bg-[#a05e38]/10"}`}>
          {txn.type === "revenue"
            ? <TrendingUp className="h-4 w-4 text-sage" />
            : <TrendingDown className="h-4 w-4 text-[#a05e38]" />}
        </div>
      </TableCell>
      <TableCell>
        <Pill {...financeKindPill(kind.label)} size="sm" className="w-full max-w-[108px] justify-center">
          {kind.label}
        </Pill>
      </TableCell>
      <TableCell className="min-w-[200px]">
        <div className="flex items-start gap-2">
          <span className="font-body font-medium text-charcoal line-clamp-2 [overflow-wrap:anywhere]" title={txn.category}>{txn.category}</span>
          {txn.isFinanceDemo && (
            <Pill tone="warning" className="mt-0.5 shrink-0 text-[10px] uppercase tracking-wide font-body">Sample</Pill>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="font-body text-sm text-charcoal truncate max-w-[180px]">
          {displayMember}
          {plus && <span className="text-sage font-medium">{plus}</span>}
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <div className="font-body text-sm text-charcoal/70">{txn.date}</div>
        {time && <div className="font-body text-xs text-charcoal/40 tabular-nums">{time}</div>}
      </TableCell>
      <TableCell>
        <Pill
          tone={method.tone}
          brand={method.brand}
          size="sm"
          icon={method.brand ? undefined : method.isCash ? <Banknote className="h-3 w-3" /> : undefined}
          noIcon={!method.brand && !method.isCash}
          className="w-full max-w-[120px] justify-center"
        >
          {txn.method}
        </Pill>
      </TableCell>
      <TableCell className="text-right">
        <span className={`font-display text-base tabular-nums ${txn.type === "revenue" ? "text-sage" : "text-[#a05e38]"}`}>
          {formatTxnAmountRupee(txn.amount, txn.type)}
        </span>
      </TableCell>
    </TableRow>
  );
});
