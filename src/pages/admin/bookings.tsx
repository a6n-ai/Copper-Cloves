import dynamic from "next/dynamic";
import { requireSessionSSP } from "@/lib/requireSessionSSP";

export const getServerSideProps = requireSessionSSP({ roles: ["admin"] });

import { SEO } from "@/components/SEO";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Skeleton } from "@/components/ui/skeleton";

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

export default function AdminBookings() {
  return (
    <>
      <SEO title="Bookings - Admin" description="Booking review and payment reconciliation" />

      <div className="min-h-screen bg-linear-to-br from-cream via-cream to-sage/10">
        <main className="min-h-screen">
          <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-8">
            <AdminPageHeader
              title="Bookings — Needs attention"
              subtitle="Orphaned and duplicate payments awaiting reconciliation"
            />

            <OrphanPaymentsSection />

            <p className="text-sm text-muted-text">Full bookings browser coming here next.</p>
          </div>
        </main>
      </div>
    </>
  );
}
