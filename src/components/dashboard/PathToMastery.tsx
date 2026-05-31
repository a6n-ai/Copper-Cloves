"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Trophy, Sparkles, Check, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedIcon } from "@/components/dashboard/AnimatedIcon";
import { cn } from "@/lib/utils";

export interface MasteryMilestone {
  id: string;
  name: string;
  classes: number;
  icon?: LucideIcon;
  /** Emoji icon from DB templates (takes precedence over `icon`). */
  dbIcon?: string;
  /** Hex accent from DB templates. */
  dbColor?: string;
}

export interface PathToMasteryProps {
  milestones: MasteryMilestone[];
  classesCompleted: number;
  currentId: string;
  nextMilestone?: MasteryMilestone | null;
  loading?: boolean;
}

/** Brand-leaning palette so each tier gets its own colour. */
const TIER_COLORS = ["#8f9779", "#c17856", "#d4a574", "#6b9080", "#8d6e8e", "#c9a227"];

// Stable framer variants — hoisted so each render doesn't recreate the object and
// restart staggered animations on parent rerenders.
const LIST_VARIANTS = { show: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } } };
const ITEM_VARIANTS = {
  hidden: { opacity: 0, y: 16, scale: 0.8 },
  show: { opacity: 1, y: 0, scale: 1 },
};

export function PathToMastery({
  milestones,
  classesCompleted,
  currentId,
  nextMilestone,
  loading,
}: PathToMasteryProps) {
  const { pct, gradient, trackLeft, trackSpan } = useMemo(() => {
    const target = milestones[milestones.length - 1]?.classes || 150;
    const pct = Math.min(100, (classesCompleted / target) * 100);
    const gradient = `linear-gradient(90deg, ${TIER_COLORS.slice(0, Math.max(2, milestones.length)).join(", ")})`;
    const n = milestones.length || 1;
    // Equal-width columns → centre of first/last circle, so the track runs icon→icon.
    return { pct, gradient, trackLeft: 50 / n, trackSpan: 100 - 100 / n };
  }, [milestones, classesCompleted]);

  return (
    <Card className="rounded-2xl shadow-xs">
      <CardContent className="p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <AnimatedIcon icon={Trophy} size={24} className="text-primary" hover="wiggle" />
          </div>
          <div>
            <h2 className="font-display text-2xl text-card-foreground sm:text-3xl">Path to Mastery</h2>
            <p className="text-sm text-muted-foreground">Your journey through the tiers</p>
          </div>
        </div>

        {loading ? (
          <div className="flex gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-3">
                <Skeleton className="h-11 w-11 md:h-16 md:w-16 rounded-full" />
                <Skeleton className="h-3 w-14 md:h-4 md:w-20" />
                <Skeleton className="h-4 w-12 md:h-5 md:w-16 rounded-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto px-3 pt-6 pb-3">
            <div className="relative min-w-0 md:min-w-[520px]">
              {/* Track background — runs from first circle centre to last, behind opaque circles */}
              <div
                className="absolute top-[22px] md:top-8 h-1 -translate-y-1/2 rounded-full bg-muted"
                style={{ left: `${trackLeft}%`, width: `${trackSpan}%` }}
              />
              {/* Track fill */}
              <motion.div
                className="absolute top-[22px] md:top-8 h-1 -translate-y-1/2 rounded-full"
                style={{ left: `${trackLeft}%`, backgroundImage: gradient }}
                initial={{ width: 0 }}
                animate={{ width: `${(pct / 100) * trackSpan}%` }}
                transition={{ duration: 1.1, ease: "easeOut" }}
              />

              <motion.ol
                className="relative flex"
                initial="hidden"
                animate="show"
                variants={LIST_VARIANTS}
              >
                {milestones.map((m, i) => {
                  const color = m.dbColor || TIER_COLORS[i % TIER_COLORS.length];
                  const earned = classesCompleted >= m.classes;
                  const isCurrent = currentId === m.id;
                  return (
                    <motion.li
                      key={m.id}
                      className="flex min-w-0 flex-1 basis-0 flex-col items-center px-1"
                      variants={ITEM_VARIANTS}
                      transition={{ type: "spring", stiffness: 260, damping: 18 }}
                    >
                      <div className="relative">
                        {isCurrent ? (
                          <motion.span
                            className="pointer-events-none absolute inset-0 rounded-full border-2"
                            style={{ borderColor: color }}
                            animate={{ scale: [1, 1.22, 1], opacity: [0.7, 0, 0.7] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                          />
                        ) : null}

                        {/* Opaque base so the track never shows through the circle */}
                        <div
                          className={cn(
                            "relative flex h-11 w-11 md:h-16 md:w-16 items-center justify-center overflow-hidden rounded-full border-4 bg-card transition-colors",
                            !earned && "border-muted",
                          )}
                          style={earned ? { borderColor: `${color}66` } : undefined}
                        >
                          {earned ? (
                            <span
                              className="absolute inset-0 rounded-full"
                              style={{ backgroundColor: `${color}22` }}
                            />
                          ) : (
                            <span className="absolute inset-0 rounded-full bg-muted/40" />
                          )}
                          {m.dbIcon ? (
                            <span className={cn("relative flex items-center justify-center text-xl md:text-3xl leading-none", !earned && "opacity-40")}>
                              {m.dbIcon}
                            </span>
                          ) : m.icon ? (
                            <span
                              className={cn("relative flex items-center justify-center leading-none", !earned && "text-muted-foreground")}
                              style={earned ? { color } : undefined}
                            >
                              <AnimatedIcon icon={m.icon} size={24} />
                            </span>
                          ) : null}
                        </div>

                        {/* Earned tick — anchored outside the circle, no overlap */}
                        {earned && !isCurrent ? (
                          <motion.span
                            className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-card text-cream shadow"
                            style={{ backgroundColor: color }}
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.5, type: "spring", stiffness: 400 }}
                          >
                            <Check size={13} strokeWidth={3} />
                          </motion.span>
                        ) : null}

                        {/* Current sparkle — top-right, outside the ring */}
                        {isCurrent ? (
                          <motion.span
                            className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-card text-cream shadow-lg"
                            style={{ backgroundColor: color }}
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.6, type: "spring", stiffness: 400 }}
                          >
                            <Sparkles size={14} />
                          </motion.span>
                        ) : null}
                      </div>

                      <div className="mt-3 text-center">
                        <h4
                          className={cn(
                            "mb-1 font-display text-[10px] md:text-sm lg:text-base",
                            earned ? "text-card-foreground" : "text-muted-foreground/60",
                          )}
                        >
                          {m.name}
                        </h4>
                        <Badge
                          variant="outline"
                          className="text-[9px] md:text-xs px-1 md:px-2"
                          style={earned ? { borderColor: `${color}66`, color } : undefined}
                        >
                          {m.classes} classes
                        </Badge>
                      </div>
                    </motion.li>
                  );
                })}
              </motion.ol>
            </div>
          </div>
        )}

        {!loading ? (
          <div className="mt-8 border-t pt-6 text-center">
            <p className="text-sm text-muted-foreground">
              {nextMilestone ? (
                <>
                  <span className="font-semibold text-card-foreground">
                    {nextMilestone.classes - classesCompleted} more classes
                  </span>{" "}
                  to unlock <span className="font-semibold text-primary">{nextMilestone.name}</span>
                </>
              ) : (
                <span className="font-semibold text-primary">🎉 All milestones unlocked! You&apos;re a legend!</span>
              )}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
