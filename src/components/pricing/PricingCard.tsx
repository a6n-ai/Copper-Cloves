import { m, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { planClassesLabel, type PricingPlan } from "@/lib/pricingPlans";

/**
 * One pricing plan. Flat at rest, lifts on hover, and reveals on scroll into
 * view (staggered by `index`). The featured plan inverts to a sage fill with
 * cream text (per the design system's pricing spec). Cards are `h-full` with
 * the benefits list taking the slack and the CTA pinned to the bottom, so every
 * "Select package" button lines up across a row.
 */
export function PricingCard({
  plan,
  onSelect,
  index = 0,
}: {
  plan: PricingPlan;
  onSelect: (plan: PricingPlan) => void;
  index?: number;
}) {
  const reduce = useReducedMotion();
  const featured = Boolean(plan.featured);

  return (
    <m.div
      initial={reduce ? false : { opacity: 0, y: 18 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      className={`relative flex h-full flex-col rounded-3xl border p-8 transition-[transform,box-shadow,border-color] duration-300 ease-out hover:-translate-y-1.5 motion-reduce:transform-none ${
        featured
          ? "border-sage bg-sage text-cream shadow-[0_8px_28px_-8px_rgba(143,151,121,0.55)] hover:shadow-[0_14px_36px_-10px_rgba(143,151,121,0.65)]"
          : "border-[#e5e4dc] bg-white-warm text-charcoal hover:border-[#c8c6be] hover:shadow-[0_8px_28px_-8px_rgba(51,51,51,0.18)]"
      }`}
    >
      {plan.badge && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span
            className={`rounded-full px-4 py-1.5 font-body text-xs font-semibold shadow-sm ${
              featured ? "bg-cream text-sage" : "bg-terracotta text-cream"
            }`}
          >
            {plan.badge}
          </span>
        </div>
      )}

      <h3 className="mt-2 font-display text-2xl leading-tight tracking-tight">{plan.name}</h3>
      <p className={`mt-1 font-body text-sm ${featured ? "text-cream/75" : "text-charcoal/55"}`}>
        {planClassesLabel(plan)}
      </p>

      <div className="mt-6">
        {plan.offerLabel && (
          <div className="mb-2">
            <span className={`inline-block rounded-md px-2.5 py-1 font-body text-xs font-semibold ${
              featured ? "bg-cream/20 text-cream" : "bg-terracotta/12 text-terracotta"
            }`}>
              {plan.offerLabel}
            </span>
          </div>
        )}
        <div className="flex items-baseline gap-2">
          {plan.originalPrice && (
            <span className={`font-body text-xl line-through ${featured ? "text-cream/55" : "text-charcoal/40"}`}>
              {plan.originalPrice}
            </span>
          )}
          <span className="font-display text-4xl">{plan.price}</span>
        </div>
        <div className={`mt-1 font-body text-sm ${featured ? "text-cream/75" : "text-charcoal/50"}`}>
          Valid for {plan.validity}
        </div>
      </div>

      <ul className="mt-7 flex-1 space-y-3.5">
        {plan.benefits.map((benefit) => (
          <li key={benefit} className="flex items-start gap-3">
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                featured ? "bg-cream/20" : "bg-sage/10"
              }`}
            >
              <Check className={featured ? "text-cream" : "text-sage"} size={14} />
            </span>
            <span
              className={`font-body text-sm leading-relaxed ${
                featured ? "text-cream/90" : "text-charcoal/80"
              }`}
            >
              {benefit}
            </span>
          </li>
        ))}
      </ul>

      <Button
        onClick={() => onSelect(plan)}
        variant={featured ? "secondary" : "sage"}
        className={`mt-8 w-full rounded-md ${
          featured ? "bg-cream text-charcoal hover:bg-white-warm" : ""
        }`}
      >
        Select package
      </Button>
    </m.div>
  );
}
