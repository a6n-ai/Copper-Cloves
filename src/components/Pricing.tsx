import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Check, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Package {
  name: string;
  price: string;
  classes: number | string;
  validity: string;
  benefits: string[];
  featured?: boolean;
  badge?: string;
}

const premiumPackages: Package[] = [
  {
    name: "1 Day Class Pass",
    price: "₹950",
    classes: 1,
    validity: "1 day",
    benefits: [
      "Access Any Class",
      "Flexible Scheduling",
      "Shower Facilities",
      "Cafe Credits"
    ],
  },
  {
    name: "4 Class Pass",
    price: "₹3,700",
    classes: 4,
    validity: "30 days",
    benefits: [
      "Access Any Class",
      "Flexible Scheduling",
      "Shower Facilities",
      "Cafe Credits"
    ],
  },
  {
    name: "8 Class Pass",
    price: "₹7,200",
    classes: 8,
    validity: "40 days",
    benefits: [
      "Access Any Class",
      "Flexible Scheduling",
      "Shower Facilities",
      "Cafe Credits"
    ],
  },
  {
    name: "12 Class Pass",
    price: "₹10,500",
    classes: 12,
    validity: "60 days",
    benefits: [
      "Access Any Class",
      "Flexible Scheduling",
      "Shower Facilities",
      "Cafe Credits"
    ],
  },
  {
    name: "1 Month Unlimited",
    price: "₹12,500",
    classes: "Unlimited",
    validity: "30 days",
    benefits: [
      "Access Any Class",
      "Flexible Scheduling",
      "Shower Facilities",
      "Flat 10% Off on Cafe",
      "Tote Bag",
      "1 Complimentary Aerial Class"
    ],
  },
  {
    name: "3 Month Unlimited",
    price: "₹36,000",
    classes: "Unlimited",
    validity: "90 days",
    benefits: [
      "Access Any Class",
      "Flexible Scheduling",
      "Shower Facilities",
      "Flat 12% Off on Cafe",
      "C+C Tote Bag + C+C Bottle",
      "2 Complimentary Aerial Class"
    ],
    featured: true,
    badge: "Most Popular",
  },
  {
    name: "6 Month Unlimited",
    price: "₹42,500",
    classes: "Unlimited",
    validity: "180 days",
    benefits: [
      "Access Any Class",
      "Flexible Scheduling",
      "Shower Facilities",
      "Flat 15% Off on Cafe",
      "C+C Tote Bag & C+C Bottle",
      "3 Complimentary Aerial Class",
      "Access to AI Features"
    ],
  },
  {
    name: "12 Month Unlimited",
    price: "₹51,000",
    classes: "Unlimited",
    validity: "365 days",
    benefits: [
      "Access Any Class",
      "Flexible Scheduling",
      "Shower Facilities",
      "Flat 20% Off on Cafe",
      "C+C Tote Bag & C+C Bottle",
      "4 Complimentary Aerial Class",
      "Access to AI Features"
    ],
  },
];

const aerialPackage: Package = {
  name: "Aerial Yoga",
  price: "₹5,500",
  classes: 4,
  validity: "30 days",
  benefits: [
    "4 Aerial Yoga sessions",
    "Hammock orientation",
    "Valid for 1 month",
    "Specialty experience"
  ],
  badge: "Specialty",
};

export function Pricing() {
  const router = useRouter();
  const { data: session } = useSession();
  const [selectedTier, setSelectedTier] = useState("studio");
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  function handleSelectPackage() {
    if (!session) {
      router.push("/portal/login?redirect=/portal/packages");
      return;
    }
    router.push("/portal/packages");
  }

  const handleChoosePlan = (pkg: typeof premiumPackages[0] | typeof aerialPackage) => {
    if (!session) {
      router.push(`/portal/login?redirect=/portal/packages&package=${encodeURIComponent(pkg.name)}`);
      return;
    }
    router.push(`/portal/packages?selected=${encodeURIComponent(pkg.name)}`);
  };

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = 350;
      scrollContainerRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  // Filter packages based on active tab
  const classPassPackages = premiumPackages.filter(pkg => 
    typeof pkg.classes === "number" // 1 Day, 4, 8, 12 Class Pass
  );
  
  const studioPassPackages = premiumPackages.filter(pkg => 
    pkg.classes === "Unlimited" // Monthly unlimited packages
  );

  const currentPackages = selectedTier === "class" 
    ? classPassPackages 
    : studioPassPackages;

  return (
    <section id="pricing" className="py-24 bg-cream relative overflow-hidden">
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-20 left-10 w-72 h-72 bg-sage/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-terracotta/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="font-display text-5xl md:text-6xl text-charcoal mb-6">
            Invest in Yourself
          </h2>
          <p className="font-body text-lg text-charcoal/70 max-w-2xl mx-auto leading-relaxed">
            Choose the package that fits your wellness journey. From flexible class packs to unlimited access, we have options for every commitment level.
          </p>
        </div>

        {/* Tier Selector */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex bg-white/80 backdrop-blur-sm rounded-full p-1.5 border border-sage/20 shadow-sm">
            <button
              onClick={() => setSelectedTier("studio")}
              className={`px-8 py-3 rounded-full font-body text-sm transition-all duration-300 ${
                selectedTier === "studio"
                  ? "bg-sage text-white shadow-md"
                  : "text-charcoal hover:text-sage"
              }`}
            >
              Studio Pass
            </button>
            <button
              onClick={() => setSelectedTier("class")}
              className={`px-8 py-3 rounded-full font-body text-sm transition-all duration-300 ${
                selectedTier === "class"
                  ? "bg-sage text-white shadow-md"
                  : "text-charcoal hover:text-sage"
              }`}
            >
              Class Pass
            </button>
          </div>
        </div>

        {/* Mobile Scroll Buttons */}
        <div className="flex justify-center gap-4 mb-6 lg:hidden">
          <button
            onClick={() => scroll("left")}
            className="w-10 h-10 rounded-full bg-white/80 backdrop-blur-xl shadow-md flex items-center justify-center hover:bg-white transition-all"
          >
            <ChevronLeft className="text-charcoal" size={20} />
          </button>
          <button
            onClick={() => scroll("right")}
            className="w-10 h-10 rounded-full bg-white/80 backdrop-blur-xl shadow-md flex items-center justify-center hover:bg-white transition-all"
          >
            <ChevronRight className="text-charcoal" size={20} />
          </button>
        </div>

        {/* Packages Container */}
        <div
          ref={scrollContainerRef}
          className="flex gap-6 overflow-x-auto pb-8 snap-x snap-mandatory scrollbar-hide lg:grid lg:grid-cols-4 lg:gap-8 lg:overflow-visible"
        >
          {currentPackages.map((pkg, index) => (
            <div
              key={index}
              className={`flex-shrink-0 w-80 lg:w-auto snap-center ${
                pkg.featured ? "lg:scale-105" : ""
              }`}
            >
              <div
                className={`relative h-full rounded-3xl p-8 transition-all duration-500 hover:shadow-2xl ${
                  pkg.featured
                    ? "bg-white/90 backdrop-blur-xl border-2 border-sage shadow-xl"
                    : "bg-white/80 backdrop-blur-xl border border-sage/10 shadow-lg hover:border-sage/30"
                }`}
              >
                {/* Badge */}
                {pkg.badge && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-sage text-white px-4 py-1.5 rounded-full text-xs font-body font-semibold shadow-md">
                      {pkg.badge}
                    </span>
                  </div>
                )}

                {/* Package Name */}
                <h3 className="font-display text-2xl text-charcoal mb-2 mt-2">
                  {pkg.name}
                </h3>

                {/* Classes Count */}
                <div className="text-charcoal/60 font-body text-sm mb-6">
                  {typeof pkg.classes === "number" ? `${pkg.classes} ${pkg.classes === 1 ? "class" : "classes"}` : pkg.classes}
                </div>

                {/* Price */}
                <div className="mb-8">
                  <div className="font-display text-3xl text-charcoal mb-2">
                    {pkg.price}
                  </div>
                  <div className="text-charcoal/50 font-body text-sm">
                    Valid for {pkg.validity}
                  </div>
                </div>

                {/* Benefits */}
                <ul className="space-y-4 mb-8">
                  {pkg.benefits.map((benefit, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-sage/10 flex items-center justify-center mt-0.5">
                        <Check className="text-sage" size={14} />
                      </div>
                      <span className="font-body text-sm text-charcoal/80 leading-relaxed">
                        {benefit}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <Button 
                  onClick={handleSelectPackage}
                  className={pkg.featured 
                    ? "w-full bg-sage hover:bg-sage/90 text-white font-body shadow-lg shadow-sage/20" 
                    : "w-full border-2 border-sage/30 text-sage hover:bg-sage/5 font-body bg-transparent"
                  }
                >
                  Select Package
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Note */}
        <div className="text-center mt-12">
          <p className="font-body text-sm text-charcoal/50">
            All packages include access to our beautiful studio space and community
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