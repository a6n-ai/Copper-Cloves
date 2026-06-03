import type { ReactNode } from "react";
import Link from "next/link";
import { MapPin, ArrowRight } from "lucide-react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

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
}: {
  action: CtaAction;
  variant: "primary" | "ghost";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg px-7 py-3 font-body transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream focus-visible:ring-offset-2 focus-visible:ring-offset-sage";
  const styles =
    variant === "primary"
      ? "group bg-white-warm font-medium text-charcoal hover:-translate-y-0.5 hover:bg-cream hover:shadow-[0_4px_24px_rgba(51,51,51,0.18)]"
      : "border border-cream/40 text-cream hover:bg-cream/10";

  const inner = (
    <>
      {action.pin && <MapPin size={18} />}
      {action.label}
      {variant === "primary" && !action.pin && (
        <ArrowRight
          size={18}
          className="transition-transform duration-200 group-hover:translate-x-1"
        />
      )}
    </>
  );

  if (action.onClick && !action.href) {
    return (
      <button
        type="button"
        onClick={action.onClick}
        className={`${base} ${styles}`}
      >
        {inner}
      </button>
    );
  }
  if (action.external) {
    return (
      <a
        href={action.href}
        target="_blank"
        rel="noopener noreferrer"
        className={`${base} ${styles}`}
      >
        {inner}
      </a>
    );
  }
  return (
    <Link href={action.href ?? "#"} className={`${base} ${styles}`}>
      {inner}
    </Link>
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
}: StudioCtaProps) {
  const reduce = useReducedMotion();

  const rise: Variants = {
    hidden: reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
    },
  };

  const card = (
    <motion.div
      variants={rise}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      className={`relative overflow-hidden rounded-2xl bg-sage px-6 py-16 text-center sm:px-10 md:py-20 ${className}`}
    >
      {/* tonal depth: cream light from top, deeper sage settling at the base */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_130%_at_50%_-20%,rgba(245,242,234,0.22),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#7a8b7c]/45 to-transparent" />

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
          (Array.isArray(body) ? body : [body]).map((para, i) => (
            <p
              key={i}
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
    </motion.div>
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
