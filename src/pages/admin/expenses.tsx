import dynamic from "next/dynamic";
import { requireSessionSSP } from "@/lib/requireSessionSSP";
import { useTabQuery } from "@/hooks/useTabQuery";

export const getServerSideProps = requireSessionSSP({ roles: ["admin"] });

import { SEO } from "@/components/SEO";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, Receipt, Wallet } from "lucide-react";

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

const ExpenseOverviewSection = dynamic(
  () => import("@/components/admin/dashboard-tabs/ExpenseOverviewSection").then((m) => m.ExpenseOverviewSection),
  { ssr: false, loading: () => <SectionLoadingSkeleton /> },
);
const ExpensesSection = dynamic(
  () => import("@/components/admin/dashboard-tabs/ExpensesSection").then((m) => m.ExpensesSection),
  { ssr: false, loading: () => <SectionLoadingSkeleton /> },
);
const InstructorPayoutsPanel = dynamic(
  () => import("@/components/admin/dashboard-tabs/InstructorPayoutsPanel").then((m) => m.InstructorPayoutsPanel),
  { ssr: false, loading: () => <SectionLoadingSkeleton /> },
);

const EXPENSE_TABS = [
  { v: "overview", l: "Overview", I: BarChart3 },
  { v: "expenses", l: "Expenses", I: Receipt },
  { v: "payouts", l: "Payouts", I: Wallet },
] as const;

export default function AdminExpenses() {
  const [activeTab, setActiveTab] = useTabQuery(["overview", "expenses", "payouts"], "overview");

  return (
    <>
      <SEO title="Expenses - Admin" description="Studio expenses and instructor payouts" />

      <div className="min-h-screen bg-linear-to-br from-cream via-cream to-sage/10">
        <main className="min-h-screen">
          <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-8">
            <AdminPageHeader
              title="Expenses"
              subtitle="Costs, café meals, and instructor payouts"
            />

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              {/* Mobile: dropdown picker */}
              <Select value={activeTab} onValueChange={setActiveTab}>
                <SelectTrigger className="md:hidden w-full border-sage/20 font-body">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_TABS.map((t) => (
                    <SelectItem key={t.v} value={t.v} className="font-body">
                      {t.l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Desktop: tab row */}
              <TabsList className="hidden md:flex bg-cream/50 border border-sage/15 p-1 gap-1 h-auto justify-start w-auto">
                {EXPENSE_TABS.map((t) => (
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
                <ExpenseOverviewSection />
              </TabsContent>

              <TabsContent value="expenses" className="space-y-6">
                <ExpensesSection />
              </TabsContent>

              <TabsContent value="payouts" className="space-y-6">
                <InstructorPayoutsPanel />
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </>
  );
}
