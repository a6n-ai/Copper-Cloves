import { useRef, type ReactNode } from "react";
import Link from "next/link";
import { MapPin, ArrowRight } from "lucide-react";
import {
  LazyMotion,
  domAnimation,
  m,
  useInView,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import { Button } from "@/components/ui/button";

type CtaAction = {
  label: string;
  /** Internal/external link target. Omit when using onClick. */
  href?: string;
  /** Imperative handler (e.g. auth-gated routing). Renders a <button>. */
  onClick?: () => void;
  /** Opens href in a new tab (external links / maps). */
  external?: boolean;
  /** Render a leading MapPin icon (used by "Get Directions"). */
  pin?: boolean;
};

export type StudioCtaProps = {
  /** Small uppercase eyebrow above the heading. */
  kicker?: string;
  heading: string;
  /** A single paragraph, or several rendered as stacked paragraphs. */
  body?: string | string[];
  /** Small print under the buttons (e.g. a secondary link). */
  note?: ReactNode;
  /** Filled white-warm action. Defaults to "Book a Class" → /classes. */
  primary?: CtaAction;
  /** Outlined ghost action. Pass null to hide. Defaults to "Get Directions". */
  secondary?: CtaAction | null;
  /** Wrap the card in a cream <section> with page container + padding. */
  withSection?: boolean;
  className?: string;
};

const MAPS_URL =
  "https://maps.google.com/maps?ll=12.963915,77.638424&z=15&t=m&hl=en&gl=IN&mapclient=embed&cid=8196377345979611458";

const DEFAULT_PRIMARY: CtaAction = { label: "Book a Class", href: "/classes" };
const DEFAULT_SECONDARY: CtaAction = {
  label: "Get Directions",
  href: MAPS_URL,
  external: true,
  pin: true,
};

function ActionLink({
  action,
  variant,
}: Readonly<{
  action: CtaAction;
  variant: "primary" | "ghost";
}>) {
  // On-sage inverted CTAs — keep their brand-specific cream/white-warm colours
  // (no standard Button variant matches), but adopt Button's structure + sizing.
  const styles =
    variant === "primary"
      ? "bg-white-warm text-charcoal hover:bg-cream hover:shadow-[0_4px_24px_rgba(51,51,51,0.18)] focus-visible:ring-cream focus-visible:ring-offset-sage"
      : "border border-cream/40 bg-transparent text-cream hover:bg-cream/10 focus-visible:ring-cream focus-visible:ring-offset-sage";

  const inner = (
    <>
      {action.pin && <MapPin size={18} />}
      {action.label}
      {variant === "primary" && !action.pin && (
        <ArrowRight size={18} className="group-hover/btn:translate-x-1" />
      )}
    </>
  );

  if (action.onClick && !action.href) {
    return (
      <Button type="button" size="lg" onClick={action.onClick} className={styles}>
        {inner}
      </Button>
    );
  }
  if (action.external) {
    return (
      <Button asChild size="lg" className={styles}>
        <a href={action.href} target="_blank" rel="noopener noreferrer">
          {inner}
        </a>
      </Button>
    );
  }
  return (
    <Button asChild size="lg" className={styles}>
      <Link href={action.href ?? "#"}>{inner}</Link>
    </Button>
  );
}

/**
 * The shared sage call-to-action card. Used as the footer's lead band and,
 * with page-specific copy, as the closing CTA on every public page so the
 * "book / visit" prompt is one consistent, on-brand surface site-wide.
 */
export function StudioCta({
  kicker = "The Studio by Copper + Cloves",
  heading,
  body,
  note,
  primary = DEFAULT_PRIMARY,
  secondary = DEFAULT_SECONDARY,
  withSection = false,
  className = "",
}: Readonly<StudioCtaProps>) {
  const reduce = useReducedMotion();
  // useInView (IntersectionObserver) instead of declarative `whileInView`, which
  // requires framer's viewport feature — absent from the `domAnimation` LazyMotion
  // bundle. Keeps this CTA on the minimal feature set across every public page.
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

  const card = (
    <LazyMotion features={domAnimation}>
    <m.div
      ref={cardRef}
      variants={rise}
      initial="hidden"
      animate={cardInView ? "show" : "hidden"}
      className={`relative overflow-hidden rounded-2xl bg-sage px-6 py-16 text-center sm:px-10 md:py-20 ${className}`}
    >
      {/* tonal depth: cream light from top, deeper sage settling at the base */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_130%_at_50%_-20%,rgba(245,242,234,0.22),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-[#7a8b7c]/45 to-transparent" />

      <div className="relative mx-auto max-w-2xl">
        {kicker && (
          <span className="font-body text-xs font-semibold uppercase tracking-[0.12em] text-cream/70">
            {kicker}
          </span>
        )}
        <h2 className="mt-5 font-display text-4xl font-bold leading-[1.08] text-cream sm:text-5xl md:text-[3.5rem]">
          {heading}
        </h2>
        {body &&
          (Array.isArray(body) ? body : [body]).map((para) => (
            <p
              key={para}
              className="mx-auto mt-5 max-w-md font-body leading-relaxed text-cream/80"
            >
              {para}
            </p>
          ))}

        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <ActionLink action={primary} variant="primary" />
          {secondary && <ActionLink action={secondary} variant="ghost" />}
        </div>

        {note && (
          <p className="mx-auto mt-6 max-w-md font-body text-sm text-cream/70">
            {note}
          </p>
        )}
      </div>
    </m.div>
    </LazyMotion>
  );

  if (withSection) {
    return (
      <section className="bg-cream py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">{card}</div>
      </section>
    );
  }
  return card;
}
