import { Dumbbell, Coffee, Users } from "lucide-react";
import Link from "next/link";

export function Experience() {
  return (
    <section id="experience" className="py-24 px-6 lg:px-8 bg-gradient-to-br from-cream via-white to-sage/5">
      <div className="max-w-7xl mx-auto">
        <h2 className="font-display text-4xl md:text-6xl text-center text-charcoal mb-16">
          The Experience
        </h2>
        
        <div className="grid md:grid-cols-3 gap-8">
          <Link href="/classes" className="group relative overflow-hidden rounded-2xl bg-white border border-sage/10 hover:border-sage/30 transition-all duration-500 hover:shadow-2xl p-8">
            <div className="relative z-10">
              <Dumbbell className="text-sage mb-4 group-hover:scale-110 transition-transform duration-500" size={40} />
              <h3 className="font-display text-3xl text-charcoal mb-3">Expert-Led Classes</h3>
              <p className="font-body text-charcoal/70 leading-relaxed">
                From Muay Thai to Hatha Yoga, our certified instructors guide you through transformative movement practices designed for all levels.
              </p>
            </div>
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-sage/5 rounded-tl-full group-hover:scale-150 transition-transform duration-700" />
          </Link>

          <Link href="/cafe#sanctuary" className="group relative overflow-hidden rounded-2xl bg-white border border-sage/10 hover:border-sage/30 transition-all duration-500 hover:shadow-2xl p-8 cursor-pointer">
            <div className="relative z-10">
              <Coffee className="text-terracotta mb-4 group-hover:scale-110 transition-transform duration-500" size={40} />
              <h3 className="font-display text-3xl text-charcoal mb-3">Plant-Based Café</h3>
              <p className="font-body text-charcoal/70 leading-relaxed">
                Refuel with our chef-crafted, nutrient-dense bowls and smoothies. Every ingredient is chosen to support your wellness journey.
              </p>
            </div>
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-terracotta/5 rounded-tl-full group-hover:scale-150 transition-transform duration-700" />
          </Link>

          <Link href="/cafe#sanctuary" className="group relative overflow-hidden rounded-2xl bg-white border border-sage/10 hover:border-sage/30 transition-all duration-500 hover:shadow-2xl p-8">
            <div className="relative z-10">
              <Users className="text-sage mb-4 group-hover:scale-110 transition-transform duration-500" size={40} />
              <h3 className="font-display text-3xl text-charcoal mb-3">Space for Connection</h3>
              <p className="font-body text-charcoal/70 leading-relaxed">
                More than a studio—it's a community. Connect with like-minded individuals in our sun-drenched gathering spaces.
              </p>
            </div>
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-sage/5 rounded-tl-full group-hover:scale-150 transition-transform duration-700" />
          </Link>
        </div>
      </div>
    </section>
  );
}