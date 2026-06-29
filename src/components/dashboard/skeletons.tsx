import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** A single stat tile placeholder — mirrors the MetricCard layout StatCard now uses. */
export function StatCardSkeleton() {
  return (
    <Card className="h-full border-sage/15 bg-white-warm shadow-none">
      <CardContent className="flex h-full flex-col p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
        </div>
        <Skeleton className="mt-3 h-8 w-24" />
      </CardContent>
    </Card>
  );
}

export function StatRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Generic card with a header and a body block (chart, panel). */
export function CardBlockSkeleton({ bodyClassName }: { bodyClassName?: string }) {
  return (
    <Card className="rounded-2xl shadow-none border-border">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className={cn("h-56 w-full rounded-xl", bodyClassName)} />
      </CardContent>
    </Card>
  );
}

/** List of rows (activity feed, schedule). */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Card className="rounded-2xl shadow-none border-border">
      <CardHeader>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="mt-2 h-3 w-44" />
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/** Tabular placeholder. */
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Card className="rounded-2xl shadow-none border-border">
      <CardHeader>
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-9 w-9 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="hidden h-4 w-24 sm:block" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function GreetingSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-80" />
    </div>
  );
}

export function MemberDashboardSkeleton() {
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-7xl space-y-8 p-6 lg:p-8">
        <GreetingSkeleton />
        {/* Quick Book */}
        <Skeleton className="h-20 w-full rounded-2xl" />
        {/* Bento: Path-to-Mastery medal stepper + 4 metric squares */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:auto-rows-[176px]">
          <Skeleton className="col-span-2 h-[340px] rounded-2xl lg:row-span-2 lg:h-full" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[150px] rounded-2xl lg:h-full" />
          ))}
        </div>
        {/* Movement Vitality + sidebar */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <CardBlockSkeleton />
          </div>
          <ListSkeleton rows={3} />
        </div>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <ListSkeleton />
          <CardBlockSkeleton bodyClassName="h-40" />
        </div>
      </div>
    </main>
  );
}

/** Mirrors MemberMobileDashboard: hero, next-class CTA, quick-book tiles, stats, journey, upcoming, peek tiles. */
export function MemberMobileDashboardSkeleton() {
  return (
    <main className="min-h-screen">
      <div className="space-y-5 px-4 py-5">
        {/* Hero */}
        <Skeleton className="h-40 w-full rounded-3xl" />
        {/* Next-class CTA */}
        <Skeleton className="h-[72px] w-full rounded-2xl" />
        {/* Quick book — 4 tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
        {/* Stat mini-grid */}
        <StatRowSkeleton />
        {/* Your journey — medal stepper card */}
        <Skeleton className="h-[360px] w-full rounded-2xl" />
        {/* Upcoming */}
        <ListSkeleton rows={2} />
        {/* Explore peek tiles */}
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[68px] w-full rounded-2xl" />
          ))}
        </div>
      </div>
    </main>
  );
}

export function AdminDashboardSkeleton() {
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 lg:p-6">
      <GreetingSkeleton />
      <StatRowSkeleton count={4} />
      <StatRowSkeleton count={4} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CardBlockSkeleton />
        <CardBlockSkeleton />
      </div>
      <TableSkeleton />
    </main>
  );
}

export function PartnerDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <StatRowSkeleton count={4} />
      <TableSkeleton rows={4} />
    </div>
  );
}

export function InstructorDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <GreetingSkeleton />
      <StatRowSkeleton count={3} />
      <ListSkeleton rows={4} />
    </div>
  );
}
