"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Medal } from "@/components/dashboard/Medal";
import { cn } from "@/lib/utils";

// Brand palette only (.llm/design.md). Metallic stage surface mirrors PassCard's
// per-tier finish so the medals read as the same card family.
const CREAM = "#f5f2ea";
const CHARCOAL = "#333333";

/** Soft brushed-metal surface keyed to the active medal colour. Earned medals get
 *  a tinted metallic face (like PassCard's class-pass finish); locked ones sit on
 *  a quiet sand surface. Stays light enough for charcoal ink. */
function stageSurface(color: string, earned: boolean): string {
  if (!earned) {
    return "linear-gradient(160deg, #f4f3ec 0%, #e8e4d9 100%)";
  }
  return [
    "radial-gradient(120% 120% at 22% 14%, rgba(255,255,255,0.55), rgba(255,255,255,0) 46%)",
    `linear-gradient(150deg, color-mix(in oklab, ${color}, ${CREAM} 72%) 0%, color-mix(in oklab, ${color}, ${CREAM} 48%) 56%, color-mix(in oklab, ${color}, ${CHARCOAL} 8%) 100%)`,
  ].join(", ");
}

export interface JourneyTier {
  id: string;
  name: string;
  classes: number;
  dbIcon?: string;
  dbColor?: string;
}

export interface JourneyCustomBadge {
  id?: string;
  badge_name: string;
  icon?: string | null;
  color?: string | null;
}

interface MedalItem {
  key: string;
  name: string;
  icon?: string | null;
  color: string;
  earned: boolean;
  pct: number;
  status: string;
}

/**
 * Single square card that steps through the badge medals one at a time. Lands on
 * the next badge to earn; Prev / Next browse the rest. Earned medals are metallic
 * and flip to reveal the name; locked medals show a coin outline with a progress
 * ring. Replaces the old horizontal Path-to-Mastery timeline.
 */
export function MedalJourney({
  milestones,
  classesCompleted,
  earnedCustom = [],
  className,
  bare = false,
}: {
  milestones: JourneyTier[];
  classesCompleted: number;
  earnedCustom?: JourneyCustomBadge[];
  className?: string;
  bare?: boolean;
}) {
  const items = useMemo<MedalItem[]>(() => {
    const tiers = milestones.map((m) => {
      const earned = classesCompleted >= m.classes;
      const remaining = Math.max(0, m.classes - classesCompleted);
      return {
        key: m.id,
        name: m.name,
        icon: m.dbIcon,
        color: m.dbColor || "#8f9779",
        earned,
        pct: earned ? 100 : Math.min(100, (classesCompleted / m.classes) * 100),
        status: earned
          ? `Earned · ${m.classes} classes`
          : `${remaining} more ${remaining === 1 ? "class" : "classes"} to unlock`,
      };
    });
    const customs: MedalItem[] = earnedCustom.map((b) => ({
      key: b.id ?? b.badge_name,
      name: b.badge_name,
      icon: b.icon ?? undefined,
      color: b.color ?? "#8f9779",
      earned: true,
      pct: 100,
      status: "Special award",
    }));
    return [...tiers, ...customs];
  }, [milestones, classesCompleted, earnedCustom]);

  const startIndex = useMemo(() => {
    const i = items.findIndex((it) => !it.earned);
    return i === -1 ? Math.max(0, items.length - 1) : i;
  }, [items]);

  const [index, setIndex] = useState(startIndex);
  const reduce = useReducedMotion();
  if (items.length === 0) return null;

  const active = items[Math.min(index, items.length - 1)];
  const go = (dir: number) => setIndex((i) => (i + dir + items.length) % items.length);

  const body = (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center gap-2">
        <Trophy className="size-4 text-sage" />
        <h2 className="font-body text-lg text-charcoal">Path to Mastery</h2>
        <span className="ml-auto font-body text-xs tabular-nums text-muted-text">
          {Math.min(index, items.length - 1) + 1} / {items.length}
        </span>
      </div>

      {/* Medal stage — metallic card surface (matches PassCard finish vocabulary). */}
      <div
        className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden rounded-xl px-4 py-5 text-center"
        style={{
          background: stageSurface(active.color, active.earned),
          border: "1px solid color-mix(in oklab, #333333, transparent 90%)",
          boxShadow: "inset 0 1px 1px rgba(255,255,255,0.45)",
        }}
      >
        {active.earned && !reduce ? (
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
            <motion.div
              className="absolute -inset-y-6 w-1/3"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
                rotate: "16deg",
              }}
              initial={{ x: "-160%" }}
              animate={{ x: "320%" }}
              transition={{ duration: 2.8, ease: "easeInOut", repeat: Infinity, repeatDelay: 4 }}
            />
          </div>
        ) : null}

        <Medal
          key={active.key}
          icon={active.icon}
          color={active.color}
          pct={active.pct}
          earned={active.earned}
          diameter={152}
          stroke={10}
          fontSize={62}
          shimmer={active.earned}
          flipLabel={active.earned ? active.name : undefined}
        />
        <p className="relative mt-3 font-body font-semibold text-xl text-charcoal">{active.name}</p>
        <p className="relative mt-0.5 font-body text-sm text-charcoal/60">{active.status}</p>
        {active.earned ? (
          <p className="relative mt-0.5 font-body text-[11px] text-muted-text">Tap the medal to flip</p>
        ) : null}
      </div>

      {/* Controls */}
      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="Previous medal"
          className="flex size-10 items-center justify-center rounded-full border border-border text-charcoal/70 transition-[background-color,transform] duration-200 hover:bg-[#f4f3ec] active:scale-[0.96] focus:outline-none focus-visible:ring-2 focus-visible:ring-sage"
        >
          <ChevronLeft className="size-4" />
        </button>

        <div className="flex flex-wrap items-center justify-center gap-0.5">
          {items.map((it, i) => (
            <button
              key={it.key}
              type="button"
              aria-label={`Show ${it.name}`}
              onClick={() => setIndex(i)}
              className="relative flex size-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-1"
            >
              <span
                className={cn(
                  "block h-1.5 rounded-full transition-all",
                  i === Math.min(index, items.length - 1) ? "w-4 bg-sage" : "w-1.5 bg-charcoal/20 hover:bg-charcoal/40",
                )}
              />
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => go(1)}
          aria-label="Next medal"
          className="flex size-10 items-center justify-center rounded-full border border-border text-charcoal/70 transition-[background-color,transform] duration-200 hover:bg-[#f4f3ec] active:scale-[0.96] focus:outline-none focus-visible:ring-2 focus-visible:ring-sage"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );

  if (bare) return <div className={className}>{body}</div>;

  return (
    <Card className={cn("overflow-hidden rounded-2xl border-border bg-white-warm shadow-none", className)}>
      <CardContent className="flex h-full flex-col p-5 sm:p-6">{body}</CardContent>
    </Card>
  );
}
