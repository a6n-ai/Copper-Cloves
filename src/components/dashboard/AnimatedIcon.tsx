"use client";

import { motion, type TargetAndTransition } from "framer-motion";
import type { LucideIcon } from "lucide-react";

export interface AnimatedIconProps {
  icon: LucideIcon;
  size?: number;
  className?: string;
  /** Subtle pop-in when the icon first mounts. */
  animateOnMount?: boolean;
  /** Hover gesture style. */
  hover?: "pop" | "wiggle" | "spin";
}

const HOVER: Record<NonNullable<AnimatedIconProps["hover"]>, TargetAndTransition> = {
  pop: { scale: 1.25 },
  wiggle: { rotate: [0, -12, 12, -6, 0] },
  spin: { rotate: 360 },
};

/**
 * Wraps any lucide icon in a Motion span so it animates on hover (and optionally
 * on mount). Drop-in for the lucide-animated look without the incomplete registry.
 */
export function AnimatedIcon({
  icon: Icon,
  size = 20,
  className,
  animateOnMount = true,
  hover = "pop",
}: AnimatedIconProps) {
  return (
    <motion.span
      className="inline-flex items-center justify-center align-middle leading-none"
      initial={animateOnMount ? { scale: 0, opacity: 0, rotate: -25 } : false}
      animate={animateOnMount ? { scale: 1, opacity: 1, rotate: 0 } : undefined}
      whileHover={HOVER[hover]}
      transition={{ type: "spring", stiffness: 300, damping: 16 }}
    >
      <Icon size={size} className={className} />
    </motion.span>
  );
}
