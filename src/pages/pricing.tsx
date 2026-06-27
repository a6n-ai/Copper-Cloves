import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { Droplets, CalendarCheck, Coffee, Users } from "lucide-react";
import { SEO } from "@/components/SEO";
import { Footer } from "@/components/Footer";
import { PricingCard } from "@/components/pricing/PricingCard";
import { type PricingPlan } from "@/lib/pricingPlans";
import { usePublicPackages } from "@/hooks/usePublicPackages";

const INCLUDED = [
  {
    icon: CalendarCheck,
    title: "Any class on the timetable",
    description: "Every discipline, every level. Book whatever the week holds, from Muay Thai to a restorative flow.",
    span: "lg:col-span-7",
    card: "bg-sand border-sage/10 hover:border-sage/30",
    iconColor: "text-sage",
    numColor: "text-sage/30",
  },
  {
    icon: Droplets,
    title: "Shower & changing facilities",
    description: "Freshen up before work or after a hard session.",
    span: "lg:col-span-5",
    card: "bg-sage/10 border-sage/10 hover:border-sage/30",
    iconColor: "text-sage",
    numColor: "text-terracotta/30",
  },
  {
    icon: Coffee,
    title: "Café credits & discounts",
    description: "Bowls, smoothies, and a member's rate at the plant-based café.",
    span: "lg:col-span-5",
    card: "bg-terracotta/10 border-terracotta/10 hover:border-terracotta/30",
    iconColor: "text-terracotta",
    numColor: "text-terracotta/30",
  },
  {
    icon: Users,
    title: "The studio community",
    description: "Weekly events, familiar faces, and a room that learns your name.",
    span: "lg:col-span-7",
    card: "bg-sand border-sage/10 hover:border-sage/30",
    iconColor: "text-sage",
    numColor: "text-sage/30",
  },
];

export default function PricingPage() {
  const router = useRouter();
  const { data: session } = useSession();

  const { studioPlans, classPlans } = usePublicPackages();

  const handleSelect = (plan: PricingPlan) => {
    const base = session ? "/portal/packages" : "/portal/login?redirect=/portal/packages";
    router.push(`${base}${session ? "?" : "&"}selected=${encodeURIComponent(plan.name)}`);
  };

  return (
    <>
      <SEO
        title="Pricing & Memberships | The Studio by Copper + Cloves"
        description="Unlimited memberships and pay-as-you-go class passes at The Studio by Copper + Cloves. Find the plan that fits your practice, from a single day pass to a year of unlimited classes."
      />

      {/* Hero */}
      <section className="bg-cream pt-32 pb-14">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <p className="font-body text-xs font-semibold uppercase tracking-[0.18em] text-terracotta">
            The Studio · Pricing
          </p>
          <h1 className="mt-3 max-w-[18ch] font-display text-5xl leading-[1.05] text-charcoal md:text-6xl">
            Choose how you <em className="italic text-sage">move</em>.
          </h1>
          <p className="mt-5 max-w-[60ch] font-body text-lg leading-relaxed text-charcoal/70">
            Go all in with an unlimited membership, or keep it flexible with a class pass. Either
            way you get the whole studio, the café, and a community that shows up for you.
          </p>
        </div>
      </section>

      {/* Studio passes */}
      <PlanSection
        id="studio"
        eyebrow="Unlimited"
        title="Studio Pass"
        blurb="Unlimited classes for the length of your membership. The more you commit, the more you save, and the more perks come with it."
        plans={studioPlans}
        onSelect={handleSelect}
        background="bg-cream"
      />

      {/* Class passes */}
      <PlanSection
        id="class"
        eyebrow="Pay as you go"
        title="Class Pass"
        blurb="Buy a bundle of classes and use them at your own pace. Perfect for trying the studio or fitting movement around a full calendar."
        plans={classPlans}
        onSelect={handleSelect}
        background="bg-[#f4f3ec]"
        align="right"
      />

      {/* What every pass includes — editorial bento, echoes the homepage rooms section */}
      <section className="bg-linear-to-br from-cream via-[#fafaf8] to-sage/5 py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="font-body text-xs font-semibold uppercase tracking-[0.18em] text-terracotta">
              Included with everything
            </p>
            <h2 className="mt-3 font-display text-4xl leading-[1.08] text-charcoal md:text-5xl">
              Every pass <span className="italic text-sage">includes</span>.
            </h2>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-12">
            {INCLUDED.map(({ icon: Icon, title, description, span, card, iconColor, numColor }, i) => (
              <div
                key={title}
                className={`group rounded-3xl border p-8 transition-[transform,border-color,box-shadow] duration-300 ease-out hover:-translate-y-1.5 hover:shadow-[0_8px_28px_-8px_rgba(51,51,51,0.18)] motion-reduce:transform-none md:p-9 ${span} ${card}`}
              >
                <span className={`block font-display text-6xl leading-none ${numColor}`}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="mt-5 flex items-center gap-3">
                  <Icon className={iconColor} size={22} />
                  <h3 className="font-display text-2xl leading-tight text-charcoal md:text-3xl">
                    {title}
                  </h3>
                </div>
                <p className="mt-3 max-w-md font-body leading-relaxed text-charcoal/70">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer
        cta={{
          heading: "Ready to begin?",
          body: "Create an account to buy a pass, or browse the classes you will unlock first.",
          primary: { label: "Create your account", href: "/portal/signup" },
          secondary: { label: "Explore classes", href: "/classes" },
        }}
      />
    </>
  );
}

function PlanSection({
  id,
  eyebrow,
  title,
  blurb,
  plans,
  onSelect,
  background,
  align = "left",
}: {
  id: string;
  eyebrow: string;
  title: string;
  blurb: string;
  plans: PricingPlan[];
  onSelect: (plan: PricingPlan) => void;
  background: string;
  align?: "left" | "right";
}) {
  return (
    <section id={id} className={`${background} py-16 md:py-20`}>
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className={`max-w-2xl ${align === "right" ? "ml-auto sm:text-right" : ""}`}>
          <p className="font-body text-xs font-semibold uppercase tracking-[0.18em] text-terracotta">
            {eyebrow}
          </p>
          <h2 className="mt-3 font-display text-4xl leading-[1.08] text-charcoal md:text-5xl">
            {title}
          </h2>
          <p className="mt-4 font-body text-lg leading-relaxed text-charcoal/70">{blurb}</p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {plans.map((plan, i) => (
            <PricingCard key={plan.name} plan={plan} onSelect={onSelect} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
