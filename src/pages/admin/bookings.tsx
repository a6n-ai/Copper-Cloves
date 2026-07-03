import dynamic from "next/dynamic";
import { requireSessionSSP } from "@/lib/requireSessionSSP";

export const getServerSideProps = requireSessionSSP({ roles: ["admin"] });

import { useTabQuery } from "@/hooks/useTabQuery";
import { SEO } from "@/components/SEO";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CalendarCheck } from "lucide-react";

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

const OrphanPaymentsSection = dynamic(
  () => import("@/components/admin/dashboard-tabs/OrphanPaymentsSection").then((m) => m.OrphanPaymentsSection),
  { ssr: false, loading: () => <SectionLoadingSkeleton /> },
);

const AdminBookingsBrowser = dynamic(
  () => import("@/components/admin/AdminBookingsBrowser").then((m) => m.AdminBookingsBrowser),
  { ssr: false, loading: () => <SectionLoadingSkeleton /> },
);

const BOOKING_TABS = [
  { v: "attention", l: "Needs attention", I: AlertTriangle },
  { v: "all", l: "All bookings", I: CalendarCheck },
] as const;

export default function AdminBookings() {
  // Deep-link the active tab via ?tab= so global search / links can land on either view.
  const [activeTab, changeTab] = useTabQuery(
    BOOKING_TABS.map((t) => t.v),
    "attention",
  );

  return (
    <>
      <SEO title="Bookings - Admin" description="Booking review and payment reconciliation" />

      <div className="min-h-screen bg-linear-to-br from-cream via-cream to-sage/10">
        <main className="min-h-screen">
          <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-8">
            <AdminPageHeader
              title="Bookings"
              subtitle="Reconcile payment issues and browse every booking"
            />

            <Tabs value={activeTab} onValueChange={changeTab} className="space-y-6">
              {/* Mobile: dropdown picker (no horizontal tab scroll) */}
              <Select value={activeTab} onValueChange={changeTab}>
                <SelectTrigger className="md:hidden w-full border-sage/20 font-body">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BOOKING_TABS.map((t) => (
                    <SelectItem key={t.v} value={t.v} className="font-body">
                      {t.l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Desktop: tab row */}
              <TabsList className="hidden md:flex bg-cream/50 border border-sage/15 p-1 gap-1 h-auto justify-start w-auto">
                {BOOKING_TABS.map((t) => (
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

              <TabsContent value="attention" className="space-y-6">
                <OrphanPaymentsSection />
              </TabsContent>

              <TabsContent value="all" className="space-y-6">
                <AdminBookingsBrowser />
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </>
  );
}
