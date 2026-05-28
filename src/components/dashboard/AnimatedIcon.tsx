"use client";

import { memo } from "react";
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

// Multi-keyframe rotations need a tween transition (springs support only 2 keyframes).
const HOVER: Record<NonNullable<AnimatedIconProps["hover"]>, TargetAndTransition> = {
  pop: { scale: 1.25 },
  wiggle: { rotate: [0, -12, 12, -6, 0], transition: { duration: 0.45, ease: "easeInOut" } },
  spin: { rotate: 360, transition: { duration: 0.6, ease: "easeInOut" } },
};

// Hoisted so every <AnimatedIcon> renders against the same object references
// (used 50+ times across the app — inline literals would defeat memo).
const INITIAL_MOUNT = { scale: 0, opacity: 0, rotate: -25 };
const ANIMATE_MOUNT = { scale: 1, opacity: 1, rotate: 0 };
const SPRING_TRANSITION = { type: "spring", stiffness: 300, damping: 16 } as const;

/**
 * Wraps any lucide icon in a Motion span so it animates on hover (and optionally
 * on mount). Drop-in for the lucide-animated look without the incomplete registry.
 */
function AnimatedIconImpl({
  icon: Icon,
  size = 20,
  className,
  animateOnMount = true,
  hover = "pop",
}: AnimatedIconProps) {
  return (
    <motion.span
      className="inline-flex items-center justify-center align-middle leading-none"
      initial={animateOnMount ? INITIAL_MOUNT : false}
      animate={animateOnMount ? ANIMATE_MOUNT : undefined}
      whileHover={HOVER[hover]}
      transition={SPRING_TRANSITION}
    >
      <Icon size={size} className={className} />
    </motion.span>
  );
}

export const AnimatedIcon = memo(AnimatedIconImpl);
