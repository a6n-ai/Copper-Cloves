import React, { type ReactNode, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

type ShineBorderProps = {
  children: ReactNode;
  className?: string;
  borderWidth?: number;
  duration?: number;
  /** CSS conic gradient — colors of the rotating ring. */
  gradient?: string;
  /** Tailwind rounding utility to keep outer + inner radii in sync. */
  rounded?: string;
};

/**
 * shadcn-space `shine-border-01` — conic-gradient ring that spins around the
 * card edge. Adapted from the v4 source to Tailwind v3 (uses inline CSS for the
 * conic gradient since `bg-conic` is v4-only, plus inline padding).
 *
 * Default gradient is a warning amber for the "up next" class indicator.
 */
export function ShineBorder({
  children,
  className,
  borderWidth = 2,
  duration = 3,
  gradient = "conic-gradient(from 0deg, hsl(var(--accent)), hsl(var(--accent) / 0.4), hsl(var(--accent)), hsl(var(--accent) / 0.6), hsl(var(--accent)))",
  rounded = "rounded-2xl",
}: ShineBorderProps) {
  return (
    <div
      className={cn("relative", rounded, className)}
      style={{ padding: borderWidth } as CSSProperties}
    >
      <div className={cn("absolute inset-0 overflow-hidden", rounded)}>
        <div
          className="absolute -inset-full blur-sm animate-spin"
          style={{ background: gradient, animationDuration: `${duration}s` }}
        />
      </div>
      <div className={cn("relative bg-white-warm", rounded)}>{children}</div>
    </div>
  );
}

export default ShineBorder;
