import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { MapPin, Phone, Mail } from "lucide-react";
import { InstagramIcon, FacebookIcon, YoutubeIcon } from "@/components/icons/SocialIcons";
import {
  LazyMotion,
  domAnimation,
  m,
  useInView,
  useReducedMotion,
  type Variants,
} from "framer-motion";

import { cdnUrl } from "@/lib/cdnUrl";
import { StudioCta, type StudioCtaProps } from "@/components/StudioCta";
import { Button } from "@/components/ui/button";

const DEFAULT_CTA: StudioCtaProps = {
  heading: "Your home away from home.",
  body: "Move, refuel, and belong. Book a class and step into your sunlit studio in the heart of Indiranagar.",
};

const LOGO_URL = cdnUrl("/the_studio_by_C_C_og.png");
const MAPS_URL =
  "https://maps.google.com/maps?ll=12.963915,77.638424&z=15&t=m&hl=en&gl=IN&mapclient=embed&cid=8196377345979611458";

const LINK_COLUMNS = [
  {
    heading: "Studio",
    links: [
      { href: "/classes", label: "Class Schedule" },
      { href: "/cafe", label: "The Café" },
      { href: "/pricing", label: "Pricing & Packages" },
      { href: "/shop", label: "The Boutique" },
      { href: "/rental", label: "Studio Rental" },
    ],
  },
  {
    heading: "Discover",
    links: [
      { href: "/story", label: "Our Story" },
      { href: "/instructors", label: "Our Instructors" },
      { href: "/meal-subscription", label: "Meal Plans" },
      { href: "/login", label: "Member Portal" },
    ],
  },
] as const;

const SOCIALS = [
  {
    href: "https://www.instagram.com/thestudiobycopperandcloves/",
    label: "Instagram",
    Icon: InstagramIcon,
  },
  {
    href: "https://www.facebook.com/people/The-Studio-by-Copper-Cloves/61564386191595/",
    label: "Facebook",
    Icon: FacebookIcon,
  },
  {
    href: "https://www.youtube.com/@CopperandCloves",
    label: "YouTube",
    Icon: YoutubeIcon,
  },
] as const;

type FooterProps = {
  /**
   * Sage CTA band content. Omit for the default ("Your home away from home").
   * Pass `null` to hide the band entirely. Pass an object for page-specific copy
   * — rendered in the same container so spacing matches the default exactly.
   */
  cta?: StudioCtaProps | null;
};

export function Footer({ cta }: Readonly<FooterProps>) {
  const ctaProps = cta === null ? null : cta ?? DEFAULT_CTA;
  const currentYear = new Date().getFullYear();
  const reduce = useReducedMotion();
  // `whileInView` lives in framer's viewport feature, which is NOT in the
  // `domAnimation` LazyMotion bundle. Drive the reveal off the standalone
  // `useInView` hook (IntersectionObserver) instead so we keep the minimal
  // feature set and never ship the full `motion` feature bundle here.
  const cardRef = useRef<HTMLDivElement>(null);
  const cardInView = useInView(cardRef, { once: true, margin: "-80px" });

  const rise: Variants = {
    hidden: reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
    },
  };

  return (
    <LazyMotion features={domAnimation}>
    <footer className="relative overflow-hidden bg-cream">
      <div className="relative z-10 mx-auto max-w-7xl px-4 pb-10 pt-16 sm:px-6 lg:px-8">
        {/* ── Sage CTA card (shared component) ───────────────────── */}
        {ctaProps && <StudioCta {...ctaProps} />}

        {/* ── Light footer card ──────────────────────────────────── */}
        <m.div
          ref={cardRef}
          variants={rise}
          initial="hidden"
          animate={cardInView ? "show" : "hidden"}
          transition={{ delay: reduce ? 0 : 0.08 }}
          className="relative mt-5 rounded-2xl border border-border bg-white-warm px-6 py-10 sm:px-10 sm:py-12"
        >
          {/* Visit Our Studio band — desktop only (mobile uses the linked
              address + the CTA's "Get Directions" instead) */}
          <div className="hidden gap-8 md:grid md:grid-cols-2 md:items-center">
            <div>
              <h2 className="font-display text-2xl text-charcoal md:text-3xl">
                Visit Our Studio
              </h2>
              <p className="mt-3 max-w-md font-body text-sm leading-relaxed text-muted-foreground">
                Located in the heart of Indiranagar, our sun-drenched studio
                awaits. Drop by for a tour, grab a coffee, or join us for a
                class.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button asChild variant="sage" size="lg">
                  <a href={MAPS_URL} target="_blank" rel="noopener noreferrer">
                    <MapPin size={18} />
                    Get Directions
                  </a>
                </Button>
                <Button
                  asChild
                  size="lg"
                  className="bg-sand text-charcoal shadow-none hover:bg-[#dcd8cc] focus-visible:ring-sage focus-visible:ring-offset-white-warm"
                >
                  <Link href="/classes">Book a Visit</Link>
                </Button>
              </div>
            </div>

            {/* Map */}
            <div className="group overflow-hidden rounded-xl border border-border transition-shadow duration-300 hover:shadow-[0_4px_24px_rgba(51,51,51,0.08)]">
              <iframe
                src="https://maps.google.com/maps?ll=12.963915,77.638424&z=15&t=m&hl=en&gl=IN&mapclient=embed&output=embed&cid=8196377345979611458"
                className="h-50 w-full border-0 grayscale-[0.3] transition-all duration-500 group-hover:grayscale-0 md:h-55"
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="The Studio by Copper + Cloves Location"
              />
            </div>
          </div>

          {/* Divider (matches the desktop-only band above) */}
          <div className="my-10 hidden border-t border-border md:block" />

          {/* Link + contact grid */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-12">
            {/* Brand */}
            <div className="col-span-2 md:col-span-4">
              <Link href="/" className="inline-block">
                <Image
                  src={LOGO_URL}
                  alt="The Studio by Copper + Cloves"
                  width={280}
                  height={92}
                  className="h-20 w-auto"
                />
              </Link>
              <p className="mt-5 max-w-xs font-body text-sm leading-relaxed text-muted-foreground">
                A space to move your body, refuel with nourishing food, and find
                your community.
              </p>
              <div className="mt-6 flex items-center gap-2.5">
                {SOCIALS.map(({ href, label, Icon }) => (
                  <m.a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    whileHover={reduce ? undefined : { y: -2 }}
                    whileTap={{ scale: 0.94 }}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-charcoal/70 transition-colors duration-200 hover:border-sage hover:bg-sage hover:text-white-warm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-white-warm"
                  >
                    <Icon size={17} />
                  </m.a>
                ))}
              </div>
            </div>

            {/* Link columns */}
            {LINK_COLUMNS.map((col) => (
              <div key={col.heading} className="md:col-span-2">
                <h3 className="mb-4 font-body text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {col.heading}
                </h3>
                <ul className="space-y-3">
                  {col.links.map(({ href, label }) => (
                    <li key={label}>
                      <Link
                        href={href}
                        className="footer-link inline-block font-body text-sm text-charcoal/80 transition-colors duration-200 hover:text-charcoal focus-visible:text-charcoal focus-visible:underline focus-visible:outline-none"
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {/* Contact */}
            <div className="col-span-2 md:col-span-4">
              <h3 className="mb-4 font-body text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Get in Touch
              </h3>
              <ul className="space-y-3.5">
                <li className="flex items-start gap-2.5">
                  <MapPin className="mt-0.5 shrink-0 text-sage" size={17} />
                  <a
                    href={MAPS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="footer-link inline-block font-body text-sm leading-relaxed text-charcoal/80 transition-colors duration-200 hover:text-charcoal focus-visible:text-charcoal focus-visible:outline-none"
                  >
                    1226, 12th Main Road, HAL 2nd Stage, Indiranagar,
                    Bengaluru 560038
                  </a>
                </li>
                <li className="flex items-center gap-2.5">
                  <Phone className="shrink-0 text-sage" size={17} />
                  <a
                    href="tel:+919008426703"
                    className="footer-link inline-block font-body text-sm text-charcoal/80 transition-colors duration-200 hover:text-charcoal focus-visible:text-charcoal focus-visible:outline-none"
                  >
                    +91 90084 26703
                  </a>
                </li>
                <li className="flex items-center gap-2.5">
                  <Mail className="shrink-0 text-sage" size={17} />
                  <a
                    href="mailto:thestudio@copperandcloves.com"
                    className="footer-link inline-block break-all font-body text-sm text-charcoal/80 transition-colors duration-200 hover:text-charcoal focus-visible:text-charcoal focus-visible:outline-none"
                  >
                    thestudio@copperandcloves.com
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom row */}
          <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 sm:flex-row">
            <p className="text-center font-body text-sm text-muted-foreground sm:text-left">
              © {currentYear} The Studio by Copper + Cloves. All rights
              reserved.
            </p>
            <div className="flex items-center gap-6">
              <Link
                href="/policy"
                className="footer-link inline-block font-body text-sm text-muted-foreground transition-colors duration-200 hover:text-charcoal focus-visible:text-charcoal focus-visible:outline-none"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms"
                className="footer-link inline-block font-body text-sm text-muted-foreground transition-colors duration-200 hover:text-charcoal focus-visible:text-charcoal focus-visible:outline-none"
              >
                Terms of Service
              </Link>
            </div>
          </div>
        </m.div>
      </div>

      {/* ── Oversized brand watermark ──────────────────────────────── */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-[22%] select-none whitespace-nowrap text-center font-display text-[11vw] leading-[0.8] text-sage/8"
      >
        Copper &amp; Cloves
      </span>
    </footer>
    </LazyMotion>
  );
}
