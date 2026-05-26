import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  cn(
    "group/btn relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium font-body",
    "transition-all duration-200 ease-out transform-gpu will-change-transform",
    "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50",
    "active:scale-[0.97]",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    "[&_svg]:transition-transform [&_svg]:duration-300 [&_svg]:ease-out",
    "hover:[&_svg]:scale-[1.15] hover:[&_svg]:rotate-6",
    "active:[&_svg]:scale-95 active:[&_svg]:rotate-0",
  ),
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-primary/40",
        destructive:
          "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90 hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-destructive/40",
        outline:
          "border border-input bg-transparent shadow-xs hover:bg-accent hover:text-accent-foreground hover:-translate-y-0.5 hover:shadow-sm focus-visible:ring-charcoal/30",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80 hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-charcoal/30",
        ghost:
          "hover:bg-accent hover:text-accent-foreground focus-visible:ring-charcoal/30",
        link:
          "text-primary underline-offset-4 hover:underline focus-visible:ring-primary/40",

        // ── Brand variants ────────────────────────────────────────────────
        // ── Brand variants (canonical 4) ──────────────────────────────────
        sage:
          "bg-sage text-white shadow-sm hover:bg-sage/90 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-8px_rgba(143,151,121,0.55)] focus-visible:ring-sage/50",
        "sage-outline":
          "border border-sage/40 bg-transparent text-sage shadow-xs hover:bg-sage/10 hover:border-sage hover:-translate-y-0.5 focus-visible:ring-sage/40",
        terracotta:
          "bg-terracotta text-white shadow-sm hover:bg-terracotta/90 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-8px_rgba(193,120,86,0.6)] focus-visible:ring-terracotta/50",
        "terracotta-ghost":
          "bg-transparent text-terracotta hover:bg-terracotta/10 focus-visible:ring-terracotta/40",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-11 rounded-md px-6 text-base",
        xl: "h-12 rounded-md px-8 text-base",
        icon: "h-9 w-9",
        "icon-sm": "h-8 w-8 [&_svg]:size-3.5",
        "icon-lg": "h-10 w-10 [&_svg]:size-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
