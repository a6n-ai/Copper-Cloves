import { Calendar, Users, Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

import { cdnUrl } from "@/lib/cdnUrl";

const features = [
  {
    icon: Sparkles,
    title: "Curated ambiance",
    description:
      "Thoughtfully designed interiors with natural light, tropical plants, and a warm aesthetic that turns any gathering into something memorable.",
  },
  {
    icon: Calendar,
    title: "Flexible scheduling",
    description:
      "Half-day or full-day bookings for workshops, team offsites, birthdays, launches, or intimate gatherings.",
  },
  {
    icon: Users,
    title: "Full-service experience",
    description:
      "Add catering from our plant-based café, sound setup, yoga mats, or custom arrangements. We handle the details so you can focus on your guests.",
  },
];

const stats = [
  { value: "40+", label: "Events hosted" },
  { value: "1,000 sq ft+", label: "Open space" },
  { value: "Natural", label: "Lighting" },
  { value: "Premium", label: "Amenities" },
];

export function Rental() {
  return (
    <section className="bg-cream py-14 md:py-20">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Image + content — image stretches to the full height of the heading + features column */}
        <div className="grid items-stretch gap-12 lg:min-h-[600px] lg:grid-cols-2">
          {/* Showcase image — below the text on mobile, left column on desktop */}
          <div className="group relative order-2 min-h-[420px] overflow-hidden rounded-3xl shadow-[0_8px_48px_-8px_rgba(51,51,51,0.14)] md:min-h-[520px] lg:order-1 lg:min-h-full">
            <Image
              src={cdnUrl("/cafe-studio.jpg")}
              alt="The event space at The Studio by Copper + Cloves"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none"
              quality={90}
            />
            <div className="absolute inset-0 bg-linear-to-t from-charcoal/55 via-transparent to-transparent" />
            <div className="absolute bottom-6 left-6 right-6 sm:right-auto">
              <div className="inline-flex items-center gap-4 rounded-2xl bg-white-warm p-5 shadow-[0_4px_24px_rgba(51,51,51,0.08)]">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-sage/10">
                  <Users className="text-sage" size={28} />
                </span>
                <div>
                  <p className="font-body text-xs uppercase tracking-[0.1em] text-charcoal/55">
                    Capacity
                  </p>
                  <p className="font-display text-2xl text-charcoal md:text-3xl">Up to 40 guests</p>
                </div>
              </div>
            </div>
          </div>

          {/* Content: heading + feature list + cta — first on mobile, right column on desktop */}
          <div className="order-1 flex flex-col justify-center lg:order-2">
            <p className="font-body text-xs font-semibold uppercase tracking-[0.18em] text-terracotta">
              Private hire · Events
            </p>
            <h2 className="mt-3 font-display text-4xl leading-[1.05] text-charcoal md:text-6xl">
              <span className="italic text-sage">Host</span> your event.
            </h2>
            <p className="mt-5 max-w-[52ch] font-body text-lg leading-relaxed text-charcoal/70">
              Transform our sanctuary into your canvas. Host workshops, celebrations, gatherings, or
              corporate events in a space designed for connection.
            </p>

            <ul className="mt-8 space-y-6">
              {features.map(({ icon: Icon, title, description }) => (
                <li key={title} className="flex gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sage/10">
                    <Icon className="text-sage" size={22} />
                  </span>
                  <div>
                    <h3 className="font-display text-2xl leading-tight text-charcoal">{title}</h3>
                    <p className="mt-2 font-body leading-relaxed text-charcoal/70">{description}</p>
                  </div>
                </li>
              ))}
            </ul>

            <Link
              href="/rental"
              className="group mt-10 inline-flex items-center gap-1.5 self-start font-body text-sm font-semibold text-sage transition-colors duration-200"
            >
              Explore space & book
              <ArrowRight
                size={16}
                className="transition-transform duration-300 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none"
              />
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-14 flex flex-wrap justify-center divide-y divide-[#e5e4dc] border-t border-[#e5e4dc] pt-10 sm:divide-x sm:divide-y-0 sm:border-t-0 sm:pt-12">
          {stats.map((stat) => (
            <div key={stat.label} className="w-1/2 px-6 py-4 text-center sm:w-auto sm:px-10">
              <p className="font-display text-3xl text-charcoal md:text-4xl">{stat.value}</p>
              <p className="mt-1 font-body text-xs uppercase tracking-[0.1em] text-charcoal/55">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
