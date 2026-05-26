import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Single source of truth for status pills across the app.
 *
 * - `tone` picks the colour family (sage / amber / terracotta / charcoal / accent / neutral).
 * - `variant` controls fill style:
 *     • `solid`   — saturated background + white text. Use for high-contrast / hero contexts.
 *     • `soft`    — tinted background + dark colored text. Default for table cells, lists.
 *     • `outline` — white bg + coloured border + coloured text. For subtle states.
 * - `size` controls padding/text size: `sm` (table chip) / `md` (default) / `lg` (hero).
 * - `dot` adds a leading status dot; combine with `pulse` for live/active emphasis.
 *
 * Tone semantics (intent, not colour):
 *   sage       → success / active / available
 *   amber      → warning / pending / in-progress / live
 *   terracotta → danger / cancelled / overdue
 *   charcoal   → neutral / archived / completed
 *   accent     → highlighted / next-up (uses --accent CSS var)
 *   neutral    → muted / unknown
 */
const pillVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full font-body whitespace-nowrap transition-colors",
  {
    variants: {
      tone: {
        sage: "",
        amber: "",
        terracotta: "",
        red: "",
        charcoal: "",
        accent: "",
        neutral: "",
      },
      variant: {
        solid: "shadow-sm font-medium",
        soft: "font-medium",
        outline: "bg-white",
      },
      size: {
        sm: "px-2 py-0.5 text-[11px]",
        md: "px-2.5 py-1 text-xs",
        lg: "px-3 py-1.5 text-sm",
      },
    },
    compoundVariants: [
      // ── SAGE (success / active) ─────────────────────────────────────────
      { tone: "sage", variant: "solid", class: "bg-sage text-white border border-sage" },
      { tone: "sage", variant: "soft", class: "bg-sage/15 text-sage border border-sage/30" },
      { tone: "sage", variant: "outline", class: "border border-sage/40 text-sage" },
      // ── AMBER (warning / live / pending) ────────────────────────────────
      { tone: "amber", variant: "solid", class: "bg-amber-500 text-white border border-amber-600" },
      { tone: "amber", variant: "soft", class: "bg-amber-100 text-amber-700 border border-amber-200" },
      { tone: "amber", variant: "outline", class: "border border-amber-400 text-amber-700" },
      // ── TERRACOTTA (danger / cancelled) ─────────────────────────────────
      { tone: "terracotta", variant: "solid", class: "bg-terracotta text-white border border-terracotta" },
      { tone: "terracotta", variant: "soft", class: "bg-terracotta/10 text-terracotta border border-terracotta/30" },
      { tone: "terracotta", variant: "outline", class: "border border-terracotta/40 text-terracotta" },
      // ── RED (subtle deactivated / warning) ──────────────────────────────
      // Tuned to match the delete button palette — uses terracotta as the base
      // so it reads as a warning without screaming. Use this for `inactive` /
      // `deactivated` / `blocked` states.
      { tone: "red", variant: "solid", class: "bg-terracotta text-white border border-terracotta" },
      { tone: "red", variant: "soft", class: "bg-terracotta/10 text-terracotta border border-terracotta/30" },
      { tone: "red", variant: "outline", class: "border border-terracotta/40 text-terracotta" },
      // ── CHARCOAL (neutral / completed / archived) ───────────────────────
      { tone: "charcoal", variant: "solid", class: "bg-charcoal/80 text-white border border-charcoal/80" },
      { tone: "charcoal", variant: "soft", class: "bg-charcoal/10 text-charcoal/70 border border-charcoal/15" },
      { tone: "charcoal", variant: "outline", class: "border border-charcoal/30 text-charcoal/70" },
      // ── ACCENT (highlight / next) ───────────────────────────────────────
      { tone: "accent", variant: "solid", class: "bg-accent text-white border border-accent" },
      { tone: "accent", variant: "soft", class: "bg-accent/15 text-accent border border-accent/30" },
      { tone: "accent", variant: "outline", class: "border border-accent/40 text-accent" },
      // ── NEUTRAL (muted / unknown) ───────────────────────────────────────
      { tone: "neutral", variant: "solid", class: "bg-charcoal/40 text-white border border-charcoal/40" },
      { tone: "neutral", variant: "soft", class: "bg-charcoal/5 text-charcoal/55 border border-charcoal/10" },
      { tone: "neutral", variant: "outline", class: "border border-charcoal/15 text-charcoal/55" },
    ],
    defaultVariants: {
      tone: "sage",
      variant: "soft",
      size: "md",
    },
  },
);

type StatusPillProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof pillVariants> & {
    /** Show a leading status dot. */
    dot?: boolean;
    /** Animate the dot (use for live / active states). */
    pulse?: boolean;
    /** Optional leading icon component (e.g. lucide). Replaces the dot when both are set. */
    icon?: React.ComponentType<{ className?: string }>;
  };

/**
 * Status pill — use this instead of hand-rolling `inline-flex rounded-full ...`.
 *
 * @example
 * <StatusPill tone="sage" dot pulse>Open for booking</StatusPill>
 * <StatusPill tone="terracotta" variant="solid">Cancelled</StatusPill>
 * <StatusPill tone="amber" icon={Flame} size="sm">Live</StatusPill>
 */
export function StatusPill({
  tone,
  variant,
  size,
  dot,
  pulse,
  icon: Icon,
  className,
  children,
  ...rest
}: StatusPillProps) {
  const dotColor = variant === "solid" ? "bg-white" : "bg-current";
  return (
    <span className={cn(pillVariants({ tone, variant, size }), className)} {...rest}>
      {Icon ? (
        <Icon className="h-3 w-3 shrink-0" />
      ) : dot ? (
        pulse ? (
          <span className="relative flex size-1.5 shrink-0">
            <span className={cn("absolute inset-0 rounded-full opacity-60 animate-ping", dotColor)} />
            <span className={cn("relative inline-flex size-1.5 rounded-full", dotColor)} />
          </span>
        ) : (
          <span className={cn("size-1.5 rounded-full shrink-0", dotColor)} />
        )
      ) : null}
      {children}
    </span>
  );
}

/**
 * Maps an arbitrary status string to the canonical pill tone + label. Centralises
 * the mapping so callers don't have to keep their own switch statements.
 */
export type CanonicalStatus =
  | "available"
  | "active"
  | "started"
  | "live"
  | "inactive"
  | "paused"
  | "pending"
  | "completed"
  | "archived"
  | "cancelled"
  | "abandoned"
  | "failed";

export function statusPillProps(status: string | null | undefined): {
  tone: NonNullable<VariantProps<typeof pillVariants>["tone"]>;
  pulse: boolean;
  label: string;
} {
  const s = (status ?? "").toLowerCase();
  switch (s) {
    case "available":
    case "active":
    case "open":
      return { tone: "sage", pulse: true, label: capitalize(s) };
    case "started":
    case "live":
    case "in_progress":
      return { tone: "amber", pulse: true, label: "Live" };
    case "pending":
    case "paused":
      return { tone: "amber", pulse: false, label: capitalize(s) };
    case "inactive":
    case "deactivated":
    case "disabled":
    case "blocked":
      return { tone: "red", pulse: false, label: capitalize(s) };
    case "completed":
    case "archived":
    case "ended":
      return { tone: "charcoal", pulse: false, label: capitalize(s) };
    case "cancelled":
    case "canceled":
    case "abandoned":
    case "failed":
    case "rejected":
      return { tone: "terracotta", pulse: false, label: capitalize(s) };
    default:
      return { tone: "neutral", pulse: false, label: s ? capitalize(s) : "—" };
  }
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

export default StatusPill;
