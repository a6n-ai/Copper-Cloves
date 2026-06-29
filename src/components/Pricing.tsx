import { useState, useEffect } from "react";
import { ArrowRight, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { useSWRConfig } from "swr";
import { NavPrevButton, NavNextButton } from "@/components/ui/quick-actions";
import { PricingCard } from "@/components/pricing/PricingCard";
import { SectionHeading } from "@/components/SectionHeading";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { type PricingPlan } from "@/lib/pricingPlans";
import { usePublicPackages } from "@/hooks/usePublicPackages";
import { useCarouselScroll } from "@/hooks/useCarouselScroll";

export function Pricing() {
  const router = useRouter();
  const { data: session } = useSession();
  const [selectedTier, setSelectedTier] = useState<"studio" | "class">("studio");
  const { ref: scrollContainerRef, scrollBy, measure, progress } = useCarouselScroll();

  const handleSelect = (plan: PricingPlan) => {
    const base = session ? "/portal/packages" : "/login?redirect=/portal/packages";
    router.push(`${base}${session ? "?" : "&"}selected=${encodeURIComponent(plan.name)}`);
  };

  const scroll = (direction: "left" | "right") => scrollBy(direction, 350);

  const { studioPlans, classPlans, isLoading } = usePublicPackages();
  const { mutate } = useSWRConfig();
  const retry = () => mutate("/api/packages");
  const currentPlans = selectedTier === "class" ? classPlans : studioPlans;

  useEffect(() => {
    measure();
  }, [selectedTier, measure]);

  return (
    <section id="pricing" className="bg-cream py-14 md:py-20">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <SectionHeading
          eyebrow="Memberships & passes"
          title="Invest in yourself."
          subtitle="Unlimited memberships or pay-as-you-go passes. Every plan opens the whole studio, the café, and the community."
          accent="terracotta"
        />

        {/* Tier selector */}
        <div className="mt-10 flex justify-center">
          <div
            role="tablist"
            aria-label="Pass type"
            className="inline-flex rounded-lg border border-sage/20 bg-white-warm p-1.5 shadow-xs"
          >
            {(["studio", "class"] as const).map((tier) => (
              <button
                key={tier}
                role="tab"
                aria-selected={selectedTier === tier}
                onClick={() => setSelectedTier(tier)}
                className={`rounded-md px-8 py-2.5 font-body text-sm transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-1 ${
                  selectedTier === tier
                    ? "bg-sage text-cream shadow-sm"
                    : "text-charcoal hover:text-sage"
                }`}
              >
                {tier === "studio" ? "Studio Pass" : "Class Pass"}
              </button>
            ))}
          </div>
        </div>

        {/* Tablet scroll controls (md–lg): arrows hidden on phones */}
        <div className="mt-8 hidden justify-center gap-4 md:flex lg:hidden">
          <NavPrevButton onClick={() => scroll("left")} className="rounded-full bg-white-warm" />
          <NavNextButton onClick={() => scroll("right")} className="rounded-full bg-white-warm" />
        </div>

        {/* Phone position indicator (< md) */}
        <div className="mt-8 flex justify-center md:hidden">
          <div className="h-1 w-24 overflow-hidden rounded-full bg-sage/15" aria-hidden="true">
            <div
              className="h-full rounded-full bg-sage transition-[width] duration-300 ease-out"
              style={{ width: `${Math.max(14, progress * 100)}%` }}
            />
          </div>
        </div>

        {/* Plans */}
        <div
          ref={scrollContainerRef}
          className="scrollbar-hide mt-8 flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 lg:grid lg:grid-cols-4 lg:gap-8 lg:overflow-visible lg:pb-0"
        >
          {isLoading ? (
            ["a", "b", "c", "d"].map((k) => (
              <div key={k} className="w-80 shrink-0 snap-center lg:w-auto">
                <PricingCardSkeleton />
              </div>
            ))
          ) : currentPlans.length === 0 ? (
            <div className="w-full lg:col-span-4">
              <PricingLoadError onRetry={retry} />
            </div>
          ) : (
            currentPlans.map((plan, i) => (
              <div key={plan.name} className="w-80 shrink-0 snap-center lg:w-auto">
                <PricingCard plan={plan} onSelect={handleSelect} index={i} />
              </div>
            ))
          )}
        </div>

        <div className="mt-10 flex flex-col items-center gap-4">
          <Link
            href="/pricing"
            className="group inline-flex items-center gap-1.5 font-body text-sm font-semibold text-sage transition-colors duration-200"
          >
            Compare all plans
            <ArrowRight
              size={16}
              className="transition-transform duration-300 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none"
            />
          </Link>
          <p className="text-center font-body text-sm text-charcoal/50">
            All packages include access to our studio space and community.
          </p>
        </div>
      </div>

      <style jsx>{`
      `}</style>
    </section>
  );
}

/** Tall placeholder mirroring a PricingCard while packages load. */
function PricingCardSkeleton() {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-white-warm p-8">
      <Skeleton className="h-7 w-2/3" />
      <Skeleton className="mt-2 h-4 w-1/2" />
      <Skeleton className="mt-6 h-10 w-1/2" />
      <Skeleton className="mt-2 h-4 w-1/3" />
      <div className="mt-7 flex-1 space-y-3.5">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
      <Skeleton className="mt-8 h-10 w-full rounded-md" />
    </div>
  );
}

/** Warm fallback shown when packages fail to load (or none returned). */
function PricingLoadError({ onRetry }: Readonly<{ onRetry: () => void }>) {
  return (
    <div className="rounded-2xl border border-border bg-white-warm p-10 text-center">
      <p className="font-display text-2xl text-charcoal">We couldn&rsquo;t load the passes.</p>
      <p className="mt-2 font-body text-sm text-charcoal/70">
        Something went wrong fetching pricing. Please try again.
      </p>
      <Button onClick={onRetry} variant="sage" className="mt-6 rounded-md">
        <RefreshCw size={16} /> Try again
      </Button>
    </div>
  );
}
