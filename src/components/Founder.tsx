import { ArrowRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

import { cdnUrl } from "@/lib/cdnUrl";

const stats = [
  { value: "2018", label: "Founded" },
  { value: "3", label: "Locations" },
  { value: "20+", label: "Team" },
  { value: "500+", label: "Community" },
];

export function Founder() {
  return (
    <section className="bg-cream py-14 md:py-20">
      <div className="mx-auto grid max-w-7xl items-stretch gap-12 px-6 lg:min-h-[600px] lg:grid-cols-2 lg:gap-16 lg:px-8">
        {/* Narrative */}
        <div className="flex flex-col justify-center">
          <p className="font-body text-xs font-semibold uppercase tracking-[0.18em] text-terracotta">
            Our story
          </p>
          <h2 className="mt-3 font-display text-4xl leading-[1.05] text-charcoal md:text-6xl">
            More than a fitness <span className="italic text-sage">studio</span>.
          </h2>
          <div className="mt-5 max-w-[56ch] space-y-4">
            <p className="font-body text-lg leading-relaxed text-charcoal/80">
              What began with granola from a home kitchen in 2018 has grown into a multi-outlet
              wellness sanctuary of movement, plant-based food, and community, built by a team of
              20+ across three locations in Bangalore.
            </p>
            <p className="font-body text-lg leading-relaxed text-charcoal/80">
              From monthly cooking workshops to our first studio in 2020 and a community that
              gathers every week, the throughline has never changed: a space designed to help you
              feel <span className="font-display italic text-sage">strong</span>,{" "}
              <span className="font-display italic text-sage">nourished</span>, and{" "}
              <span className="font-display italic text-sage">connected</span>.
            </p>
          </div>

          <dl className="mt-8 grid grid-cols-2 gap-4 border-y border-[#e5e4dc] py-6 sm:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label}>
                <dt className="sr-only">{stat.label}</dt>
                <dd className="font-display text-3xl text-charcoal md:text-4xl">{stat.value}</dd>
                <p className="mt-1 font-body text-[11px] uppercase tracking-[0.1em] text-charcoal/55">
                  {stat.label}
                </p>
              </div>
            ))}
          </dl>

          <Link
            href="/story"
            className="group mt-8 inline-flex items-center gap-1.5 font-body text-sm font-semibold text-sage transition-colors duration-200"
          >
            Read our story
            <ArrowRight
              size={16}
              className="transition-transform duration-300 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none"
            />
          </Link>
        </div>

        {/* Visual */}
        <div className="group relative">
          <div className="relative h-full min-h-[420px] overflow-hidden rounded-3xl shadow-[0_8px_48px_-8px_rgba(51,51,51,0.14)]">
            <Image
              src={cdnUrl("/coworking.jpg")}
              alt="Members gathered in the sun-drenched studio social space"
              fill
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none"
              quality={90}
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>
          <div className="absolute -bottom-6 -left-6 hidden h-44 w-36 overflow-hidden rounded-2xl border-4 border-cream shadow-[0_8px_28px_-8px_rgba(51,51,51,0.2)] sm:block">
            <Image
              src={cdnUrl("/founder.jpg")}
              alt="The founder of Copper + Cloves"
              fill
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-110 motion-reduce:transform-none motion-reduce:transition-none"
              quality={90}
              sizes="144px"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
