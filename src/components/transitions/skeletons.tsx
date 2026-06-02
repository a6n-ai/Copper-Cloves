import { Skeleton } from "@/components/ui/skeleton";

/**
 * Per-route loading skeletons that mirror each public page's real layout.
 * Rendered inside the RouteProgress overlay, which sits BELOW the persistent
 * <Navigation> (z-40 vs z-50) — so each skeleton offsets its content past the
 * nav (`pt-*`) instead of drawing a fake nav bar. Full-bleed hero pages (home,
 * cafe) start at the top because their real nav is the transparent overlay.
 */

const NAV_PAD = "pt-20 md:pt-24";

function Lines({ n, className = "" }: { n: number; className?: string }) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {Array.from({ length: n }).map((_, i) => (
        <Skeleton key={i} className={`h-3.5 ${i === n - 1 ? "w-4/5" : "w-full"}`} />
      ))}
    </div>
  );
}

/** Centered hero header: badge + big title + subtitle lines. */
function HeroHeader() {
  return (
    <div className={`mx-auto flex max-w-2xl flex-col items-center gap-4 px-6 text-center ${NAV_PAD} pb-12`}>
      <Skeleton className="h-6 w-40 rounded-full" />
      <Skeleton className="h-11 w-full max-w-lg" />
      <Skeleton className="h-11 w-2/3" />
      <Skeleton className="mt-1 h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

/** Full-bleed hero for landing/cafe: large media area + centered title overlay. */
function FullBleedHero({ vh = "h-[88vh]" }: { vh?: string }) {
  return (
    <div className={`relative w-full ${vh} overflow-hidden`}>
      <div className="grid h-full grid-cols-1 lg:grid-cols-3">
        <Skeleton className="h-full w-full rounded-none" />
        <Skeleton className="hidden h-full w-full rounded-none lg:block" />
        <Skeleton className="hidden h-full w-full rounded-none lg:block" />
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6">
        <Skeleton className="h-6 w-44 rounded-full bg-cream/40" />
        <Skeleton className="h-14 w-full max-w-xl bg-cream/40" />
        <Skeleton className="h-8 w-2/3 max-w-md bg-cream/40" />
        <div className="mt-3 flex gap-3">
          <Skeleton className="h-11 w-36 rounded-full bg-cream/40" />
          <Skeleton className="h-11 w-36 rounded-full bg-cream/40" />
        </div>
      </div>
    </div>
  );
}

function SectionHeader() {
  return (
    <div className="mx-auto mb-8 flex max-w-xl flex-col items-center gap-3 text-center">
      <Skeleton className="h-4 w-28 rounded-full" />
      <Skeleton className="h-9 w-72" />
      <Skeleton className="h-4 w-64" />
    </div>
  );
}

/* ── Landing (/) ───────────────────────────────────────────── */
export function LandingSkeleton() {
  return (
    <div>
      <FullBleedHero />
      {/* Experience: feature cards */}
      <div className="mx-auto max-w-6xl px-6 py-20">
        <SectionHeader />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-12">
          <Skeleton className="h-64 rounded-3xl lg:col-span-7" />
          <Skeleton className="h-64 rounded-3xl lg:col-span-5" />
          <Skeleton className="h-48 rounded-3xl md:col-span-2 lg:col-span-12" />
        </div>
      </div>
      {/* Class catalog: horizontal cards */}
      <div className="mx-auto max-w-7xl px-6 py-16">
        <SectionHeader />
        <div className="flex gap-6 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-80 w-[82vw] shrink-0 rounded-2xl sm:w-80 md:h-96 md:w-96" />
          ))}
        </div>
      </div>
      {/* Pricing: 4-up */}
      <div className="mx-auto max-w-7xl px-6 py-20">
        <SectionHeader />
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-4 rounded-2xl border border-sage/10 p-6">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-10 w-1/2" />
              <Lines n={4} className="mt-2" />
              <Skeleton className="mt-2 h-10 w-full rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Classes (/classes) ────────────────────────────────────── */
export function ClassesSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-6">
      <HeroHeader />
      <div className="mx-auto mb-10 grid max-w-md grid-cols-2 gap-2">
        <Skeleton className="h-10 rounded-md" />
        <Skeleton className="h-10 rounded-md" />
      </div>
      <div className="grid grid-cols-1 gap-8 pb-20 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-sage/10">
            <Skeleton className="h-64 w-full rounded-none" />
            <div className="flex flex-col gap-3 p-6">
              <Skeleton className="h-7 w-3/5" />
              <Lines n={2} />
              <Skeleton className="h-4 w-20" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
              <Skeleton className="mt-1 h-10 w-full rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Cafe (/cafe) ──────────────────────────────────────────── */
export function CafeSkeleton() {
  return (
    <div>
      <FullBleedHero vh="h-[85vh]" />
      <div className="mx-auto max-w-7xl px-6 py-20">
        <SectionHeader />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[26rem] rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Shop (/shop) ──────────────────────────────────────────── */
export function ShopSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-6">
      <HeroHeader />
      <div className="mb-8 flex items-center gap-3">
        <Skeleton className="h-10 flex-1 rounded-md" />
        <Skeleton className="hidden h-10 w-40 rounded-md sm:block" />
        <Skeleton className="h-10 w-10 rounded-full" />
      </div>
      <div className="grid grid-cols-1 gap-8 pb-20 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3">
            <Skeleton className="h-80 w-full rounded-3xl" />
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-6 w-3/4" />
            <Lines n={2} />
            <Skeleton className="h-6 w-1/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Shop detail (/shop/[id]) ──────────────────────────────── */
export function ShopDetailSkeleton() {
  return (
    <div className={`mx-auto max-w-7xl px-6 ${NAV_PAD}`}>
      <Skeleton className="mb-8 h-9 w-28 rounded-md" />
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
        <Skeleton className="aspect-square w-full rounded-3xl" />
        <div className="flex flex-col gap-5">
          <Skeleton className="h-5 w-28 rounded-full" />
          <Skeleton className="h-10 w-4/5" />
          <Skeleton className="h-8 w-32" />
          <Lines n={4} className="mt-1" />
          <div className="mt-2 flex items-center gap-3">
            <Skeleton className="h-12 w-32 rounded-md" />
            <Skeleton className="h-12 flex-1 rounded-md" />
            <Skeleton className="h-12 w-12 rounded-md" />
          </div>
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      <div className="py-16">
        <Skeleton className="mb-6 h-8 w-56" />
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-3">
              <Skeleton className="aspect-square w-full rounded-2xl" />
              <Skeleton className="h-4 w-20 rounded-full" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-5 w-1/3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Rental (/rental) ──────────────────────────────────────── */
export function RentalSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-6">
      <HeroHeader />
      <div className="mb-16 grid grid-cols-1 gap-6 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[400px] rounded-3xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-16 pb-20 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-4 rounded-2xl border border-sage/10 p-8">
              <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
              <div className="flex w-full flex-col gap-2">
                <Skeleton className="h-6 w-1/2" />
                <Lines n={2} />
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-4 rounded-2xl border border-sage/10 p-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full rounded-md" />
          ))}
          <Skeleton className="h-28 w-full rounded-md" />
          <Skeleton className="h-11 w-full rounded-md" />
        </div>
      </div>
    </div>
  );
}

/* ── Instructors (/instructors) ────────────────────────────── */
export function InstructorsSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-6">
      <div className={`flex flex-col gap-3 ${NAV_PAD} pb-10`}>
        <Skeleton className="h-4 w-32 rounded-full" />
        <Skeleton className="h-11 w-2/3 max-w-lg" />
        <Skeleton className="h-4 w-3/4 max-w-xl" />
      </div>
      <div className="mb-6 flex items-center justify-between border-b border-sage/10 pb-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <div className="grid grid-cols-1 gap-6 pb-20 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-sage/10">
            <Skeleton className="aspect-[4/5] w-full rounded-none" />
            <div className="flex flex-col gap-2 p-5">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-3.5 w-1/2" />
              <div className="mt-1 flex gap-2">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Document pages (policy, terms, founder) ───────────────── */
export function DocSkeleton() {
  return (
    <div className={`mx-auto max-w-3xl px-6 ${NAV_PAD} pb-20`}>
      <Skeleton className="mb-6 h-9 w-24 rounded-md" />
      <Skeleton className="mb-4 h-6 w-28 rounded-full" />
      <Skeleton className="h-10 w-3/4" />
      <Skeleton className="mt-3 h-4 w-40" />
      <div className="mt-10 flex flex-col gap-10">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3">
            <Skeleton className="h-6 w-1/2" />
            <Lines n={3} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Meal subscription (/meal-subscription) ────────────────── */
export function MealSubscriptionSkeleton() {
  return (
    <div>
      <FullBleedHero />
      {/* How it works: 3-up */}
      <div className="mx-auto max-w-7xl px-6 py-20">
        <SectionHeader />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-3 rounded-2xl border border-sage/10 p-8 text-center">
              <Skeleton className="h-14 w-14 rounded-full" />
              <Skeleton className="h-6 w-2/3" />
              <Lines n={2} />
            </div>
          ))}
        </div>
      </div>
      {/* Benefits: 2-up */}
      <div className="mx-auto max-w-7xl px-6 pb-16">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-4 rounded-2xl border border-sage/10 p-6">
              <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
              <div className="flex w-full flex-col gap-2">
                <Skeleton className="h-6 w-1/2" />
                <Lines n={2} />
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Enquiry form card */}
      <div className="mx-auto max-w-md px-6 pb-20">
        <div className="flex flex-col gap-4 rounded-2xl border border-sage/10 p-6">
          <Skeleton className="h-7 w-1/2" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full rounded-md" />
          ))}
          <Skeleton className="h-24 w-full rounded-md" />
          <Skeleton className="h-11 w-full rounded-md" />
        </div>
      </div>
    </div>
  );
}

/* ── Auth: login / signup (centered card, no nav) ──────────── */
export function AuthSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="flex w-full max-w-md flex-col gap-5 rounded-2xl border border-sage/10 bg-white-warm p-8">
        <div className="flex flex-col items-center gap-2">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-11 w-full rounded-md" />
        <Skeleton className="h-11 w-full rounded-md" />
        <Skeleton className="h-11 w-full rounded-md" />
        <Skeleton className="mt-1 h-11 w-full rounded-md" />
        <Skeleton className="mx-auto h-4 w-44" />
      </div>
    </div>
  );
}

/* ── Check-in deep link (single centered message) ──────────── */
export function CheckinSkeleton() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6">
      <Skeleton className="h-8 w-72 max-w-full" />
      <Skeleton className="h-8 w-56 max-w-full" />
    </div>
  );
}

/* ── Fallback generic (anything else public) ──────────────── */
export function GenericSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-6">
      <HeroHeader />
      <div className="grid grid-cols-1 gap-6 pb-20 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3">
            <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
            <Skeleton className="h-5 w-2/3" />
            <Lines n={2} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Resolve the right skeleton for a destination pathname (route pattern or href). */
export function resolveSkeleton(pathname: string): React.ReactNode {
  if (pathname === "/") return <LandingSkeleton />;
  if (pathname === "/classes") return <ClassesSkeleton />;
  if (pathname === "/cafe") return <CafeSkeleton />;
  if (pathname.startsWith("/shop/")) return <ShopDetailSkeleton />;
  if (pathname === "/shop") return <ShopSkeleton />;
  if (pathname === "/rental") return <RentalSkeleton />;
  if (pathname === "/instructors") return <InstructorsSkeleton />;
  if (pathname === "/founder" || pathname === "/policy" || pathname === "/terms")
    return <DocSkeleton />;
  if (pathname === "/meal-subscription") return <MealSubscriptionSkeleton />;
  if (pathname === "/login" || pathname === "/signup") return <AuthSkeleton />;
  if (pathname === "/checkin") return <CheckinSkeleton />;
  return <GenericSkeleton />;
}
