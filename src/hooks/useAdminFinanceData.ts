import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "@/lib/auth/client";
import { toast } from "sonner";
import { hasRole } from "@/lib/auth/roles";
import { financeDemoTransactionsForUi } from "@/lib/adminFinanceDemoTransactions";
import { downloadFinanceReportExcel, type FinanceReportPeriod } from "@/lib/financeReportExport";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/expenseConstants";
import type { ManualPaymentInRow } from "@/lib/payments";
import type {
  DashboardTxn,
  FinanceStats,
  FinanceTrendRow,
} from "@/components/admin/dashboard-tabs/FinanceTab";

type ExpenseRow = {
  id: string;
  category: string;
  amountPaise: number;
  incurredAtISO: string;
  payee: string | null;
  method: string | null;
  isPayout: boolean;
};

const EXPENSE_METHOD_LABEL: Record<string, string> = {
  cash: "Cash",
  direct_upi: "UPI",
  pine_lab_card: "Card",
  pine_lab_upi: "UPI",
  razorpay_online: "Razorpay",
  razorpay_completed: "Razorpay",
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// Map an expense row onto the shared ledger shape so it shows as a debit in the
// Transactions tab and flows through the export, alongside revenue rows.
function expenseToTxn(e: ExpenseRow): DashboardTxn {
  const d = new Date(e.incurredAtISO);
  return {
    id: `expense-${e.id}`,
    sortKey: e.incurredAtISO,
    date: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    member: e.payee ?? "Studio",
    memberFull: e.payee ?? undefined,
    type: "expense",
    amount: e.amountPaise / 100,
    category: EXPENSE_CATEGORY_LABELS[e.category as keyof typeof EXPENSE_CATEGORY_LABELS] ?? "Expense",
    method: (e.method && EXPENSE_METHOD_LABEL[e.method]) || "Offline",
    isFinanceDemo: false,
  };
}

// Map a manual money-in (non-Razorpay credit) onto the ledger shape so it shows
// as a revenue row in the Transactions tab AND carries the raw values needed to
// edit it in place via the same PATCH /api/admin/payments path.
function manualPaymentToTxn(p: ManualPaymentInRow): DashboardTxn {
  const d = new Date(p.createdAtISO);
  return {
    id: `mpay-${p.id}`,
    sortKey: p.createdAtISO,
    date: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    member: p.member,
    memberFull: p.member,
    type: "revenue",
    amount: p.amountPaise / 100,
    category: p.reference ? `Manual payment · ${p.reference}` : "Manual payment",
    method: (p.method && EXPENSE_METHOD_LABEL[p.method]) || "Offline",
    isFinanceDemo: false,
    manualEdit: {
      id: p.id,
      amountPaise: p.amountPaise,
      method: p.method,
      reference: p.reference,
      notes: p.notes,
    },
  };
}

/**
 * Shared finance export. Both the dashboard Finance tab and the standalone
 * /admin/finances page call this so the "nothing to export" guard and the
 * filename convention stay in one place.
 */
export function exportFinanceReport(mode: FinanceReportPeriod, rows: DashboardTxn[]): void {
  if (rows.length === 0) {
    toast.error("No transactions to export for this selection.");
    return;
  }
  downloadFinanceReportExcel(rows, `copper-cloves-finance-${mode}`).catch(() => {
    toast.error("Could not generate the finance report. Please try again.");
  });
}

const EMPTY_STATS: FinanceStats = {
  totalRevenue: 0,
  totalExpenses: 0,
  profit: 0,
  coachPayments: 0,
  studioExpenses: 0,
  memberPayments: 0,
  growthRate: 0,
};

export interface AdminFinanceData {
  financeStats: FinanceStats;
  financeLedgerTransactions: DashboardTxn[];
  financeTrend: FinanceTrendRow[];
  loaded: boolean;
  /** Refetch all finance data (used after editing a manual payment in place). */
  reload: () => Promise<void>;
}

/**
 * Self-contained finance data for the standalone /admin/finances page. Mirrors
 * the fetch + compute the admin dashboard does across its overview, payout, and
 * finance-tab effects, so both surfaces show the same numbers. The dashboard
 * keeps its own intertwined effects (they feed other tabs too); this hook is the
 * isolated version for the dedicated page.
 */
export function useAdminFinanceData(): AdminFinanceData {
  const { data: session } = useSession();
  const rawRole = (session?.user as { role?: string })?.role;

  const [transactions, setTransactions] = useState<DashboardTxn[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [manualPayments, setManualPayments] = useState<ManualPaymentInRow[]>([]);
  const [financeTrend, setFinanceTrend] = useState<FinanceTrendRow[]>([]);
  const [stats, setStats] = useState<FinanceStats>(EMPTY_STATS);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!session?.user || !hasRole(rawRole, "admin")) return;

    // Revenue (month) drives totalRevenue / memberPayments.
    const overviewP = (async () => {
      const r = await fetch("/api/admin/overview");
      if (!r.ok) return 0;
      const d = await r.json();
      return Number(d.overviewStats?.monthRevenue ?? 0);
    })();

    // Recorded expenses are the source of truth for the expense side.
    const expensesP = (async (): Promise<ExpenseRow[]> => {
      const r = await fetch("/api/admin/expenses");
      if (!r.ok) return [];
      const d = await r.json();
      return Array.isArray(d.expenses) ? (d.expenses as ExpenseRow[]) : [];
    })();

    // Manual money-in (non-Razorpay credits) — shown + editable in Transactions.
    const manualP = (async (): Promise<ManualPaymentInRow[]> => {
      const r = await fetch("/api/admin/payments?manual=1");
      if (!r.ok) return [];
      const d = await r.json();
      return Array.isArray(d.payments) ? (d.payments as ManualPaymentInRow[]) : [];
    })();

    const txnsP = (async () => {
      const r = await fetch("/api/admin/dashboard/transactions");
      if (!r.ok) return;
      const d = await r.json();
      if (Array.isArray(d.transactions)) setTransactions(d.transactions);
    })();

    const trendP = (async () => {
      const r = await fetch("/api/admin/dashboard/finance-trend");
      if (!r.ok) return;
      const d = await r.json();
      if (Array.isArray(d.trend)) setFinanceTrend(d.trend);
    })();

    const [monthRevenue, expenseRows, manualRows] = await Promise.all([
      overviewP,
      expensesP,
      manualP,
      txnsP,
      trendP,
    ]);
    setExpenses(expenseRows);
    setManualPayments(manualRows);

    // This-month expense totals (matches the month revenue figure).
    const now = new Date();
    const inThisMonth = (iso: string) => {
      const d = new Date(iso);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    };
    const monthExpenseRows = expenseRows.filter((e) => inThisMonth(e.incurredAtISO));
    const totalExpenses = monthExpenseRows.reduce((s, e) => s + e.amountPaise / 100, 0);
    const coachPayments = monthExpenseRows
      .filter((e) => e.isPayout)
      .reduce((s, e) => s + e.amountPaise / 100, 0);

    setStats({
      ...EMPTY_STATS,
      totalRevenue: monthRevenue,
      memberPayments: monthRevenue,
      coachPayments,
      studioExpenses: totalExpenses - coachPayments,
      totalExpenses,
      profit: monthRevenue - totalExpenses,
    });
    setLoaded(true);
  }, [session, rawRole]);

  useEffect(() => {
    void load();
  }, [load]);

  // Revenue (demo + live) merged with manual money-in + expense debits,
  // de-duped by id, newest first.
  const financeLedgerTransactions = useMemo(() => {
    const demos = financeDemoTransactionsForUi() as DashboardTxn[];
    const byId = new Map<string, DashboardTxn>();
    for (const row of demos) byId.set(row.id, row);
    for (const row of transactions) byId.set(row.id, row);
    for (const p of manualPayments) {
      const t = manualPaymentToTxn(p);
      byId.set(t.id, t);
    }
    for (const e of expenses) {
      const t = expenseToTxn(e);
      byId.set(t.id, t);
    }
    return Array.from(byId.values()).sort((a, b) => {
      const ak = a.sortKey ?? a.date;
      const bk = b.sortKey ?? b.date;
      if (ak < bk) return 1;
      if (ak > bk) return -1;
      return 0;
    });
  }, [transactions, manualPayments, expenses]);

  return { financeStats: stats, financeLedgerTransactions, financeTrend, loaded, reload: load };
}
