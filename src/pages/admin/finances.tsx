import { useState } from "react";
import dynamic from "next/dynamic";
import { requireSessionSSP } from "@/lib/requireSessionSSP";

export const getServerSideProps = requireSessionSSP({ roles: ["admin"] });

import { SEO } from "@/components/SEO";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, Receipt, ScanSearch, Wallet } from "lucide-react";
import { exportFinanceReport, useAdminFinanceData } from "@/hooks/useAdminFinanceData";

function SectionLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

// Defer the recharts-laden Overview and the table-heavy Transactions sections.
const FinanceOverviewSection = dynamic(
  () => import("@/components/admin/dashboard-tabs/FinanceTab").then((m) => m.FinanceOverviewSection),
  { ssr: false, loading: () => <SectionLoadingSkeleton /> },
);
const FinanceTransactionsSection = dynamic(
  () => import("@/components/admin/dashboard-tabs/FinanceTab").then((m) => m.FinanceTransactionsSection),
  { ssr: false, loading: () => <SectionLoadingSkeleton /> },
);
const ExpensesSection = dynamic(
  () => import("@/components/admin/dashboard-tabs/ExpensesSection").then((m) => m.ExpensesSection),
  { ssr: false, loading: () => <SectionLoadingSkeleton /> },
);
const ReconcileSection = dynamic(
  () => import("@/components/admin/dashboard-tabs/ReconcileSection").then((m) => m.ReconcileSection),
  { ssr: false, loading: () => <SectionLoadingSkeleton /> },
);

const FINANCE_TABS = [
  { v: "overview", l: "Overview", I: BarChart3 },
  { v: "transactions", l: "Transactions", I: Receipt },
  { v: "expenses", l: "Expenses", I: Wallet },
  { v: "reconcile", l: "Reconcile", I: ScanSearch },
] as const;

export default function AdminFinances() {
  const [activeTab, setActiveTab] = useState("overview");
  const { financeStats, financeLedgerTransactions, financeTrend, loaded } = useAdminFinanceData();

  return (
    <>
      <SEO title="Finances - Admin" description="Studio revenue, expenses, and transactions" />

      <div className="min-h-screen bg-linear-to-br from-cream via-cream to-sage/10">
        <main className="min-h-screen">
          <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-8">
            <AdminPageHeader
              title="Finances"
              subtitle="Revenue, expenses, reports, and the full transaction ledger"
            />

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              {/* Mobile: dropdown picker (no horizontal scroll) */}
              <Select value={activeTab} onValueChange={setActiveTab}>
                <SelectTrigger className="md:hidden w-full border-sage/20 font-body">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FINANCE_TABS.map((t) => (
                    <SelectItem key={t.v} value={t.v} className="font-body">
                      {t.l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Desktop: tab row */}
              <TabsList className="hidden md:flex bg-cream/50 border border-sage/15 p-1 gap-1 h-auto justify-start w-auto">
                {FINANCE_TABS.map((t) => (
                  <TabsTrigger
                    key={t.v}
                    value={t.v}
                    className="font-body gap-2 px-3 text-charcoal/60 data-[state=active]:bg-sage data-[state=active]:text-cream data-[state=active]:shadow-xs"
                  >
                    <t.I className="h-4 w-4" />
                    {t.l}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                <FinanceOverviewSection
                  financeStats={financeStats}
                  overviewLoaded={loaded}
                  financeLedgerTransactions={financeLedgerTransactions}
                  financeTrend={financeTrend}
                  onExport={exportFinanceReport}
                />
              </TabsContent>

              <TabsContent value="transactions" className="space-y-6">
                <FinanceTransactionsSection
                  financeLedgerTransactions={financeLedgerTransactions}
                  onExport={exportFinanceReport}
                />
              </TabsContent>

              <TabsContent value="expenses" className="space-y-6">
                <ExpensesSection />
              </TabsContent>

              <TabsContent value="reconcile" className="space-y-6">
                <ReconcileSection />
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </>
  );
}
