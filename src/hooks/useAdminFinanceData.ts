import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { financeDemoTransactionsForUi } from "@/lib/adminFinanceDemoTransactions";
import { downloadFinanceReportExcel, type FinanceReportPeriod } from "@/lib/financeReportExport";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/expenseConstants";
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
  void downloadFinanceReportExcel(rows, `copper-cloves-finance-${mode}`);
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
}

/**
 * Self-contained finance data for the standalone /admin/finances page. Mirrors
 * the fetch + compute the admin dashboard does across its overview, payout, and
 * finance-tab effects, so both surfaces show the same numbers. The dashboard
 * keeps its own intertwined effects (they feed other tabs too); this hook is the
 * isolated version for the dedicated page.
 */
export function useAdminFinanceData(): AdminFinanceData {
  const { data: session, status } = useSession();
  const userRole = (session?.user as { role?: string })?.role;

  const [transactions, setTransactions] = useState<DashboardTxn[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [financeTrend, setFinanceTrend] = useState<FinanceTrendRow[]>([]);
  const [stats, setStats] = useState<FinanceStats>(EMPTY_STATS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (status !== "authenticated" || userRole !== "admin") return;
    let cancelled = false;

    void (async () => {
      // Revenue (month) drives totalRevenue / memberPayments.
      const overviewP = (async () => {
        const r = await fetch("/api/admin/overview");
        if (!r.ok || cancelled) return 0;
        const d = await r.json();
        return Number(d.overviewStats?.monthRevenue ?? 0);
      })();

      // Recorded expenses are the source of truth for the expense side.
      const expensesP = (async (): Promise<ExpenseRow[]> => {
        const r = await fetch("/api/admin/expenses");
        if (!r.ok || cancelled) return [];
        const d = await r.json();
        return Array.isArray(d.expenses) ? (d.expenses as ExpenseRow[]) : [];
      })();

      const txnsP = (async () => {
        const r = await fetch("/api/admin/dashboard/transactions");
        if (!r.ok || cancelled) return;
        const d = await r.json();
        if (!cancelled && Array.isArray(d.transactions)) setTransactions(d.transactions);
      })();

      const trendP = (async () => {
        const r = await fetch("/api/admin/dashboard/finance-trend");
        if (!r.ok || cancelled) return;
        const d = await r.json();
        if (!cancelled && Array.isArray(d.trend)) setFinanceTrend(d.trend);
      })();

      const [monthRevenue, expenseRows] = await Promise.all([overviewP, expensesP, txnsP, trendP]);
      if (cancelled) return;
      setExpenses(expenseRows);

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
    })();

    return () => {
      cancelled = true;
    };
  }, [status, userRole]);

  // Revenue (demo + live) merged with expense debits, de-duped by id, newest first.
  const financeLedgerTransactions = useMemo(() => {
    const demos = financeDemoTransactionsForUi() as DashboardTxn[];
    const byId = new Map<string, DashboardTxn>();
    for (const row of demos) byId.set(row.id, row);
    for (const row of transactions) byId.set(row.id, row);
    for (const e of expenses) {
      const t = expenseToTxn(e);
      byId.set(t.id, t);
    }
    return Array.from(byId.values()).sort((a, b) => {
      const ak = a.sortKey ?? a.date;
      const bk = b.sortKey ?? b.date;
      return ak < bk ? 1 : ak > bk ? -1 : 0;
    });
  }, [transactions, expenses]);

  return { financeStats: stats, financeLedgerTransactions, financeTrend, loaded };
}
