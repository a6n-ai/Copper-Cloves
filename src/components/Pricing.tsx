import { useState, useEffect } from "react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { NavPrevButton, NavNextButton } from "@/components/ui/quick-actions";
import { PricingCard } from "@/components/pricing/PricingCard";
import { SectionHeading } from "@/components/SectionHeading";
import { studioPassPlans, classPassPlans, type PricingPlan } from "@/lib/pricingPlans";
import { useCarouselScroll } from "@/hooks/useCarouselScroll";

export function Pricing() {
  const router = useRouter();
  const { data: session } = useSession();
  const [selectedTier, setSelectedTier] = useState<"studio" | "class">("studio");
  const { ref: scrollContainerRef, scrollBy, measure, progress } = useCarouselScroll();

  const handleSelect = (plan: PricingPlan) => {
    const base = session ? "/portal/packages" : "/portal/login?redirect=/portal/packages";
    router.push(`${base}${session ? "?" : "&"}selected=${encodeURIComponent(plan.name)}`);
  };

  const scroll = (direction: "left" | "right") => scrollBy(direction, 350);

  const currentPlans = selectedTier === "class" ? classPassPlans : studioPassPlans;

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
            className="inline-flex rounded-full border border-sage/20 bg-white-warm p-1.5 shadow-xs"
          >
            {(["studio", "class"] as const).map((tier) => (
              <button
                key={tier}
                role="tab"
                aria-selected={selectedTier === tier}
                onClick={() => setSelectedTier(tier)}
                className={`rounded-full px-8 py-2.5 font-body text-sm transition-colors duration-300 ${
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
          {currentPlans.map((plan, i) => (
            <div key={plan.name} className="w-80 shrink-0 snap-center lg:w-auto">
              <PricingCard plan={plan} onSelect={handleSelect} index={i} />
            </div>
          ))}
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
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </section>
  );
}
