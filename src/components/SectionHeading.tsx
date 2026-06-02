import type { ReactNode } from "react";

/**
 * Centered section header used by the landing page's full-width carousel /
 * grid sections (Classes, Instructors, Pricing, Boutique, Experience). Keeps
 * heading alignment, scale, and rhythm identical across sections so the page
 * reads as one symmetric system. Image-pair sections (Founder, Rental) use
 * their own left/right layout instead.
 */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  accent = "sage",
  className = "",
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle?: ReactNode;
  accent?: "sage" | "terracotta";
  className?: string;
}) {
  return (
    <div className={`mx-auto max-w-2xl text-center ${className}`}>
      <p
        className={`font-body text-xs font-semibold uppercase tracking-[0.18em] ${
          accent === "sage" ? "text-sage" : "text-terracotta"
        }`}
      >
        {eyebrow}
      </p>
      <h2 className="mt-3 font-display text-4xl leading-[1.08] text-charcoal md:text-5xl">
        {title}
      </h2>
      {subtitle && (
        <p className="mx-auto mt-4 max-w-[58ch] font-body text-lg leading-relaxed text-charcoal/70">
          {subtitle}
        </p>
      )}
    </div>
  );
}
