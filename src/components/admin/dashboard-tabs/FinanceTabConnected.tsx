import { exportFinanceReport, useAdminFinanceData } from "@/hooks/useAdminFinanceData";
import { FinanceTab } from "@/components/admin/dashboard-tabs/FinanceTab";

/**
 * Self-fetching Finance tab. Owns no data of its own — it pulls from
 * `useAdminFinanceData` (the single source of truth shared with the standalone
 * /admin/finances page) and renders the shared `FinanceTab` presentation. The
 * admin dashboard drops this in so the dashboard and the dedicated page can
 * never show different finance numbers.
 */
export function FinanceTabConnected() {
  const { financeStats, financeLedgerTransactions, financeTrend, loaded, reload } = useAdminFinanceData();

  return (
    <FinanceTab
      financeStats={financeStats}
      overviewLoaded={loaded}
      financeLedgerTransactions={financeLedgerTransactions}
      financeTrend={financeTrend}
      onExport={exportFinanceReport}
      onReload={reload}
    />
  );
}

export default FinanceTabConnected;
