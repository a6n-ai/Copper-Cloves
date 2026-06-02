import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { Sprout, UtensilsCrossed, Users } from "lucide-react";
import { SEO } from "@/components/SEO";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { cdnUrl } from "@/lib/cdnUrl";

const VALUES = [
  {
    icon: Sprout,
    title: "Expert-led movement",
    description: "Yoga, Pilates, Strength, and Cardio, taught by instructors who live the practice.",
    span: "lg:col-span-7",
    card: "bg-sand border-sage/10 hover:border-sage/30",
    iconColor: "text-sage",
    numColor: "text-sage/30",
  },
  {
    icon: UtensilsCrossed,
    title: "Plant-based café",
    description: "Smoothie bowls, salads, sourdough.",
    span: "lg:col-span-5",
    card: "bg-sage/10 border-sage/10 hover:border-sage/30",
    iconColor: "text-terracotta",
    numColor: "text-terracotta/30",
  },
  {
    icon: Users,
    title: "Space for connection",
    description: "Light-filled interiors and tropical greenery, built for community and not just workouts.",
    span: "lg:col-span-12",
    card: "bg-terracotta/10 border-terracotta/10 hover:border-terracotta/30",
    iconColor: "text-sage",
    numColor: "text-sage/30",
    wide: true,
  },
];

const STATS = [
  { value: "2018", label: "Founded" },
  { value: "3", label: "Locations" },
  { value: "20+", label: "Team members" },
  { value: "500+", label: "Community" },
];

const JOURNEY = [
  {
    year: "2016",
    text: "Moved from London to Bangalore, beginning a new chapter and discovering plant-based living.",
  },
  {
    year: "2018",
    text: "Founded Copper + Cloves, starting with granola from a home kitchen, hosting monthly events and cooking workshops.",
  },
  {
    year: "2020",
    text: "Opened the first Copper + Cloves outlet, creating a physical space for the community.",
  },
  {
    year: "2024",
    text: "Grew to three locations, launched the meal subscription service, and built a team of 20+ hosting weekly events.",
  },
];

export default function StoryPage() {
  const reduce = useReducedMotion();

  return (
    <>
      <SEO
        title="Our Story | The Studio by Copper + Cloves"
        description="From a London kitchen to a Bangalore wellness sanctuary. The story behind The Studio by Copper + Cloves: movement, plant-based food, and a community built around living well."
      />

      {/* Hero — image-led so the first screen reads full, not empty */}
      <section className="bg-cream pt-32 pb-16">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-6 lg:grid-cols-[1.15fr_1fr] lg:px-8">
          <div>
            <p className="font-body text-xs font-semibold uppercase tracking-[0.18em] text-terracotta">
              The Studio · Our Story
            </p>
            <h1 className="mt-3 font-display text-5xl leading-[1.05] text-charcoal md:text-6xl">
              More than a fitness <span className="italic text-sage">studio</span>.
            </h1>
            <p className="mt-5 max-w-[58ch] font-body text-lg leading-relaxed text-charcoal/80">
              A wellness studio with movement, food, and community, all under one roof. At The
              Studio by Copper + Cloves, you&rsquo;ll find more than just classes. You&rsquo;ll find
              a <span className="font-display italic text-sage">sanctuary</span> from the city,
              designed to help you feel <span className="font-display italic text-sage">strong</span>,{" "}
              <span className="font-display italic text-sage">nourished</span>, and{" "}
              <span className="font-display italic text-sage">connected</span>.
            </p>
          </div>
          <div className="group relative h-72 overflow-hidden rounded-3xl shadow-[0_8px_48px_-8px_rgba(51,51,51,0.14)] lg:h-[420px]">
            <Image
              src={cdnUrl("/cafe-studio.jpg")}
              alt="Light-filled studio with tropical plants at The Studio by Copper and Cloves"
              fill
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none"
              quality={90}
              sizes="(max-width: 1024px) 100vw, 45vw"
              priority
            />
          </div>
        </div>
      </section>

      {/* What you'll find — tinted 3-up cards (echoes the homepage rooms section) */}
      <section className="bg-linear-to-br from-cream via-[#fafaf8] to-sage/5 py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="font-body text-xs font-semibold uppercase tracking-[0.18em] text-terracotta">
              What you&rsquo;ll find
            </p>
            <h2 className="mt-3 font-display text-4xl leading-[1.08] text-charcoal md:text-5xl">
              A studio, a kitchen, a <span className="italic text-sage">community</span>.
            </h2>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-12">
            {VALUES.map(({ icon: Icon, title, description, span, card, iconColor, numColor, wide }, i) => (
              <motion.div
                key={title}
                initial={reduce ? false : { opacity: 0, y: 18 }}
                whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                className={`group rounded-3xl border p-8 transition-[transform,border-color,box-shadow] duration-300 ease-out hover:-translate-y-1.5 hover:shadow-[0_8px_28px_-8px_rgba(51,51,51,0.18)] motion-reduce:transform-none motion-reduce:transition-none md:p-9 ${span} ${card} ${
                  wide ? "md:flex md:items-end md:justify-between md:gap-12" : ""
                }`}
              >
                <div className={wide ? "md:max-w-sm" : ""}>
                  <span className={`block font-display text-6xl leading-none ${numColor}`}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="mt-5 flex items-center gap-3">
                    <Icon className={iconColor} size={22} />
                    <h3 className="font-display text-2xl leading-tight text-charcoal md:text-3xl">
                      {title}
                    </h3>
                  </div>
                </div>
                <p
                  className={`font-body leading-relaxed text-charcoal/70 ${
                    wide ? "mt-4 md:mt-0 md:max-w-md" : "mt-3 max-w-md"
                  }`}
                >
                  {description}
                </p>
              </motion.div>
            ))}
          </div>

          <p className="mx-auto mt-10 max-w-[60ch] text-center font-display text-2xl italic leading-snug text-charcoal/80">
            Whether you&rsquo;re here to build strength, eat well, or simply take a pause, The Studio
            is your space to recharge, connect, and grow.
          </p>
        </div>
      </section>

      {/* Stats — one dividered unit */}
      <section className="bg-cream py-12">
        <div className="mx-auto flex max-w-4xl flex-wrap justify-center divide-y divide-[#e5e4dc] px-6 sm:divide-x sm:divide-y-0 lg:px-8">
          {STATS.map((stat) => (
            <div key={stat.label} className="w-1/2 px-6 py-4 text-center sm:w-auto sm:px-10">
              <p className="font-display text-4xl text-charcoal md:text-5xl">{stat.value}</p>
              <p className="mt-1 font-body text-xs uppercase tracking-[0.1em] text-charcoal/55">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Founder */}
      <section className="bg-[#f4f3ec] py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid items-start gap-12 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="group relative overflow-hidden rounded-3xl shadow-[0_8px_48px_-8px_rgba(51,51,51,0.14)]">
              <Image
                src={cdnUrl("/founder.jpg")}
                alt="The founder of Copper + Cloves"
                width={600}
                height={750}
                className="h-auto w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none"
                quality={95}
                sizes="(max-width: 1024px) 100vw, 38vw"
              />
            </div>

            <div>
              <p className="font-body text-xs font-semibold uppercase tracking-[0.18em] text-terracotta">
                Meet the founder
              </p>
              <h2 className="mt-3 font-display text-4xl leading-[1.08] text-charcoal md:text-5xl">
                It started with <span className="italic text-sage">granola</span>.
              </h2>
              <div className="mt-6 space-y-5">
                <p className="font-body text-lg leading-relaxed text-charcoal/80">
                  I started Copper + Cloves in 2018 to share my newfound love of healthy,
                  plant-based eating. I was early in my own journey and relatively new to Bangalore,
                  having moved from London in 2016. I never expected to feel such a surge in my
                  health after giving up meat, and my intent was simply to share my food, colourful,
                  vibrant, and delicious, while bringing people together around living well.
                </p>
                <p className="font-body text-lg leading-relaxed text-charcoal/80">
                  What started with me making and selling granola in my home kitchen has grown into
                  a multi-outlet operation with a team of 20+. From monthly events and cooking
                  workshops to our first studio in 2020, a meal subscription service, and a thriving
                  community that gathers every week, the throughline has never changed: connection,
                  and conscious living.
                </p>
              </div>

              <figure className="mt-8 rounded-3xl border border-sage/20 bg-sage/5 p-7">
                <blockquote className="font-display text-xl italic leading-snug text-charcoal/85">
                  &ldquo;From a home kitchen to a wellness sanctuary, the journey has been about
                  community, connection, and conscious living.&rdquo;
                </blockquote>
              </figure>
            </div>
          </div>
        </div>
      </section>

      {/* Journey — vertical timeline (center rail on desktop, left rail on mobile) */}
      <section className="bg-cream py-16 md:py-20">
        <div className="mx-auto max-w-5xl px-6 lg:px-8">
          <div className="ml-auto max-w-2xl sm:text-right">
            <p className="font-body text-xs font-semibold uppercase tracking-[0.18em] text-terracotta">
              How we grew
            </p>
            <h2 className="mt-3 font-display text-4xl leading-[1.08] text-charcoal md:text-5xl">
              The <span className="italic text-sage">journey</span>.
            </h2>
          </div>

          <div className="relative mt-14">
            {/* Horizontal rail (desktop) / vertical rail (mobile) */}
            <div className="absolute left-[8px] top-2 bottom-2 w-px bg-sage/25 sm:left-0 sm:right-0 sm:top-[9px] sm:bottom-auto sm:h-px sm:w-auto" />

            <ol className="grid grid-cols-1 gap-9 sm:grid-cols-4 sm:gap-6">
              {JOURNEY.map((item, i) => (
                <motion.li
                  key={item.year}
                  className="group relative pl-9 sm:pl-0"
                  initial={reduce ? false : { opacity: 0, y: 18 }}
                  whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.5, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
                >
                  {/* Node */}
                  <span className="absolute left-0 top-1 z-10 block h-[18px] w-[18px] rounded-full border-2 border-sage bg-cream transition-transform duration-300 ease-out group-hover:scale-125 motion-reduce:transform-none sm:relative sm:left-auto sm:top-auto" />

                  <p className="font-display text-3xl text-sage transition-colors duration-300 group-hover:text-[#7A8B7C] sm:mt-5">
                    {item.year}
                  </p>
                  <p className="mt-2 font-body leading-relaxed text-charcoal/80">{item.text}</p>
                </motion.li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Member voice */}
      <section className="bg-[#f4f3ec] py-16 md:py-20">
        <div className="mx-auto max-w-3xl px-6 text-center lg:px-8">
          <blockquote className="font-display text-3xl italic leading-snug text-charcoal/85 md:text-4xl">
            &ldquo;It&rsquo;s not just a gym, it&rsquo;s a community. The vibe is always calm, and I
            feel recharged every time I leave.&rdquo;
          </blockquote>
          <figcaption className="mt-6 flex items-center justify-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sage/15 font-display text-lg text-sage">
              A
            </span>
            <span className="text-left">
              <span className="block font-body text-sm font-semibold text-charcoal">Anna</span>
              <span className="block font-body text-xs text-charcoal/55">Member since 2023</span>
            </span>
          </figcaption>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="bg-cream py-16">
        <div className="mx-auto max-w-3xl px-6 text-center lg:px-8">
          <h2 className="font-display text-3xl text-charcoal md:text-4xl">Come be part of it.</h2>
          <p className="mx-auto mt-4 max-w-[52ch] font-body text-charcoal/70">
            The studio is open, the kettle is on, and there is a class with your name on it.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/classes">
              <Button variant="sage" size="lg" className="rounded-full">
                Explore classes
              </Button>
            </Link>
            <Link href="/pricing">
              <Button variant="sage-outline" size="lg" className="rounded-full">
                View pricing
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
