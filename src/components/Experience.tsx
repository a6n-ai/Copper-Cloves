import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function Experience() {
  return (
    <section
      id="experience"
      className="py-16 md:py-20 px-6 lg:px-8 bg-linear-to-br from-cream via-[#fafaf8] to-sage/5"
    >
      <div className="max-w-6xl mx-auto">
        <div className="mx-auto max-w-2xl text-center mb-10 md:mb-14">
          <span className="font-body text-xs font-semibold tracking-[0.18em] uppercase text-terracotta">
            What you&apos;ll find here
          </span>
          <h2 className="font-display text-4xl md:text-6xl text-charcoal mt-3 leading-[1.05]">
            Three rooms, <span className="italic text-sage">one rhythm</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* 01 — Move (wide) */}
          <Link
            href="/classes"
            className="group lg:col-span-7 rounded-3xl bg-sand border border-sage/10 p-8 md:p-10 transition-all duration-500 ease-out hover:border-sage/30 hover:shadow-[0_4px_24px_rgba(51,51,51,0.08)]"
          >
            <span className="block font-display text-6xl leading-none text-sage/30">01</span>
            <h3 className="font-display text-3xl md:text-4xl text-charcoal mt-5 mb-3">
              Expert-Led Classes
            </h3>
            <p className="font-body text-charcoal/70 leading-relaxed max-w-md">
              From Muay Thai to Hatha Yoga, certified instructors guide you through
              transformative movement designed for every level.
            </p>
            <span className="mt-6 inline-flex items-center gap-1.5 font-body text-sm font-semibold text-sage transition-transform duration-300 group-hover:translate-x-1">
              See the schedule
              <ArrowRight size={16} className="motion-reduce:transition-none" />
            </span>
          </Link>

          {/* 02 — Refuel (narrow) */}
          <Link
            href="/cafe#sanctuary"
            className="group lg:col-span-5 rounded-3xl bg-sage/10 border border-sage/10 p-8 md:p-10 transition-all duration-500 ease-out hover:border-sage/30 hover:shadow-[0_4px_24px_rgba(51,51,51,0.08)]"
          >
            <span className="block font-display text-6xl leading-none text-terracotta/30">02</span>
            <h3 className="font-display text-3xl md:text-4xl text-charcoal mt-5 mb-3">
              Plant-Based Café
            </h3>
            <p className="font-body text-charcoal/70 leading-relaxed">
              Refuel with chef-crafted, nutrient-dense bowls and smoothies. Every
              ingredient supports the work you just did.
            </p>
            <span className="mt-6 inline-flex items-center gap-1.5 font-body text-sm font-semibold text-terracotta transition-transform duration-300 group-hover:translate-x-1">
              Browse the menu
              <ArrowRight size={16} className="motion-reduce:transition-none" />
            </span>
          </Link>

          {/* 03 — Connect (full-width horizontal) */}
          <Link
            href="/cafe#sanctuary"
            className="group lg:col-span-12 rounded-3xl bg-terracotta/10 border border-terracotta/10 p-8 md:p-10 transition-all duration-500 ease-out hover:border-terracotta/30 hover:shadow-[0_4px_24px_rgba(51,51,51,0.08)] md:flex md:items-end md:justify-between md:gap-10"
          >
            <div className="md:max-w-sm">
              <span className="block font-display text-6xl leading-none text-sage/30">03</span>
              <h3 className="font-display text-3xl md:text-4xl text-charcoal mt-5">
                Space for Connection
              </h3>
            </div>
            <div className="mt-4 md:mt-0 md:max-w-md">
              <p className="font-body text-charcoal/70 leading-relaxed">
                More than a studio, it is a community. Find like-minded people in our
                sun-drenched gathering spaces, between classes and over coffee.
              </p>
              <span className="mt-6 inline-flex items-center gap-1.5 font-body text-sm font-semibold text-sage transition-transform duration-300 group-hover:translate-x-1">
                Visit the sanctuary
                <ArrowRight size={16} className="motion-reduce:transition-none" />
              </span>
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}
