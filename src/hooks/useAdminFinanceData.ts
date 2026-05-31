import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { financeDemoTransactionsForUi } from "@/lib/adminFinanceDemoTransactions";
import { downloadFinanceReportExcel, type FinanceReportPeriod } from "@/lib/financeReportExport";
import type {
  DashboardTxn,
  FinanceStats,
  FinanceTrendRow,
} from "@/components/admin/dashboard-tabs/FinanceTab";

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

      // Coach payouts (month) drive the expense side.
      const payoutsP = (async () => {
        const r = await fetch("/api/admin/instructor-payouts?window=month");
        if (!r.ok || cancelled) return 0;
        const d = await r.json();
        return Number(d.summary?.totalPayouts ?? 0);
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

      const [monthRevenue, coachPayments] = await Promise.all([overviewP, payoutsP, txnsP, trendP]);
      if (cancelled) return;

      const studioExpenses = EMPTY_STATS.studioExpenses;
      const totalExpenses = coachPayments + studioExpenses;
      setStats({
        ...EMPTY_STATS,
        totalRevenue: monthRevenue,
        memberPayments: monthRevenue,
        coachPayments,
        studioExpenses,
        totalExpenses,
        profit: monthRevenue - totalExpenses,
      });
      setLoaded(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [status, userRole]);

  // Demo rows merged + de-duped by id, newest first — identical to the dashboard.
  const financeLedgerTransactions = useMemo(() => {
    const demos = financeDemoTransactionsForUi() as DashboardTxn[];
    const byId = new Map<string, DashboardTxn>();
    for (const row of demos) byId.set(row.id, row);
    for (const row of transactions) byId.set(row.id, row);
    return Array.from(byId.values()).sort((a, b) => {
      const ak = a.sortKey ?? a.date;
      const bk = b.sortKey ?? b.date;
      return ak < bk ? 1 : ak > bk ? -1 : 0;
    });
  }, [transactions]);

  return { financeStats: stats, financeLedgerTransactions, financeTrend, loaded };
}
