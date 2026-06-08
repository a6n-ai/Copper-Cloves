import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { CheckCircle2, Clock, XCircle, Info, Tag } from "lucide-react"

import { cn } from "@/lib/utils"

const pillVariants = cva(
  "group/pill inline-flex items-center gap-1.5 rounded-md font-medium leading-none whitespace-nowrap transition-all duration-150 ease-out hover:-translate-y-px hover:shadow-sm hover:brightness-[0.98] dark:hover:brightness-110 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
  {
    variants: {
      tone: {
        success: "",
        warning: "",
        danger: "",
        info: "",
        neutral: "",
      },
      // outline is intentionally aliased to soft — design standardizes on soft fills
      appearance: { soft: "", solid: "", outline: "" },
      size: {
        sm: "px-2 py-0.5 text-[11px]",
        md: "px-2.5 py-1 text-xs",
      },
    },
    compoundVariants: [
      // soft + outline(alias) share the same soft token classes
      { tone: "success", appearance: "soft", class: "bg-pill-success-bg text-pill-success-fg" },
      { tone: "warning", appearance: "soft", class: "bg-pill-warning-bg text-pill-warning-fg" },
      { tone: "danger", appearance: "soft", class: "bg-pill-danger-bg text-pill-danger-fg" },
      { tone: "info", appearance: "soft", class: "bg-pill-info-bg text-pill-info-fg" },
      { tone: "neutral", appearance: "soft", class: "bg-pill-neutral-bg text-pill-neutral-fg" },
      { tone: "success", appearance: "outline", class: "bg-pill-success-bg text-pill-success-fg" },
      { tone: "warning", appearance: "outline", class: "bg-pill-warning-bg text-pill-warning-fg" },
      { tone: "danger", appearance: "outline", class: "bg-pill-danger-bg text-pill-danger-fg" },
      { tone: "info", appearance: "outline", class: "bg-pill-info-bg text-pill-info-fg" },
      { tone: "neutral", appearance: "outline", class: "bg-pill-neutral-bg text-pill-neutral-fg" },
      { tone: "success", appearance: "solid", class: "bg-pill-success-dot text-white-warm" },
      { tone: "warning", appearance: "solid", class: "bg-pill-warning-dot text-white-warm" },
      { tone: "danger", appearance: "solid", class: "bg-pill-danger-dot text-white-warm" },
      { tone: "info", appearance: "solid", class: "bg-pill-info-dot text-white-warm" },
      { tone: "neutral", appearance: "solid", class: "bg-pill-neutral-dot text-white-warm" },
    ],
    defaultVariants: { tone: "neutral", appearance: "soft", size: "md" },
  }
)

type BrandKey = "razorpay" | "whatsapp" | "upi" | "pinelabs" | "gmail"
type ToneKey = "success" | "warning" | "danger" | "info" | "neutral"

const brandSoft: Record<BrandKey, string> = {
  razorpay: "bg-pill-razorpay-bg text-pill-razorpay-fg",
  whatsapp: "bg-pill-whatsapp-bg text-pill-whatsapp-fg",
  upi: "bg-pill-upi-bg text-pill-upi-fg",
  pinelabs: "bg-pill-pinelabs-bg text-pill-pinelabs-fg",
  gmail: "bg-pill-gmail-bg text-pill-gmail-fg",
}

const toneIcon: Record<ToneKey, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle2,
  warning: Clock,
  danger: XCircle,
  info: Info,
  neutral: Tag,
}

export interface PillProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "color">,
    VariantProps<typeof pillVariants> {
  brand?: BrandKey
  /** @deprecated dots are retired — pills use the tone icon. Kept for back-compat (no-op). */
  dot?: boolean
  /** animate the leading icon for live / active states */
  pulse?: boolean
  /** override the auto icon with a custom node */
  icon?: React.ReactNode
  /** suppress the automatic tone icon */
  noIcon?: boolean
  /** hide the text label below the `sm` breakpoint (icon-only on mobile) */
  collapseOnMobile?: boolean
}

const Pill = React.forwardRef<HTMLSpanElement, PillProps>(
  (
    { className, tone, brand, appearance, size, dot, pulse, icon, noIcon, collapseOnMobile, children, ...props },
    ref
  ) => {
    const resolvedTone: ToneKey = (tone as ToneKey) ?? "neutral"
    const resolvedAppearance = appearance ?? "soft"
    const brandClass = brand ? brandSoft[brand] : undefined
    const iconSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"
    void dot // dots retired; prop kept for back-compat

    // Pills use icons, never dots. Explicit `icon` wins; otherwise the tone icon
    // shows (unless suppressed by `noIcon` or a `brand` tint). `pulse` animates it.
    const AutoIcon = toneIcon[resolvedTone]
    const showAutoIcon = !icon && !noIcon && !brand
    const pulseClass = pulse ? "motion-safe:animate-pulse" : undefined

    return (
      <span
        ref={ref}
        className={cn(
          pillVariants({ tone: resolvedTone, appearance, size }),
          brand && resolvedAppearance !== "solid" ? brandClass : undefined,
          className
        )}
        {...props}
      >
        {icon && <span className={cn("inline-flex shrink-0 items-center", pulseClass)} aria-hidden>{icon}</span>}
        {showAutoIcon && <AutoIcon className={cn("shrink-0", iconSize, pulseClass)} aria-hidden />}
        {children != null && (
          <span className={cn(collapseOnMobile && "hidden sm:inline")}>{children}</span>
        )}
      </span>
    )
  }
)
Pill.displayName = "Pill"

export { Pill, pillVariants }
