"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Medal } from "@/components/dashboard/Medal";
import { cn } from "@/lib/utils";

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
  if (items.length === 0) return null;

  const active = items[Math.min(index, items.length - 1)];
  const go = (dir: number) => setIndex((i) => (i + dir + items.length) % items.length);

  const body = (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center gap-2">
        <Trophy className="size-4 text-sage" />
        <h2 className="font-display text-lg text-charcoal">Path to Mastery</h2>
        <span className="ml-auto font-body text-xs text-charcoal/45">
          {Math.min(index, items.length - 1) + 1} / {items.length}
        </span>
      </div>

      {/* Medal stage */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center py-2">
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
        <p className="mt-3 font-display text-xl text-charcoal">{active.name}</p>
        <p className="mt-0.5 font-body text-sm text-charcoal/55">{active.status}</p>
        {active.earned ? (
          <p className="mt-0.5 font-body text-[11px] text-charcoal/35">Tap the medal to flip</p>
        ) : null}
      </div>

      {/* Controls */}
      <div className="mt-2 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="Previous medal"
          className="flex size-9 items-center justify-center rounded-full border border-[#e5e4dc] text-charcoal/70 transition-colors hover:bg-[#f4f3ec] focus:outline-none focus-visible:ring-2 focus-visible:ring-sage"
        >
          <ChevronLeft className="size-4" />
        </button>

        <div className="flex items-center gap-1.5">
          {items.map((it, i) => (
            <button
              key={it.key}
              type="button"
              aria-label={`Show ${it.name}`}
              onClick={() => setIndex(i)}
              className={cn(
                "size-1.5 rounded-full transition-all",
                i === Math.min(index, items.length - 1) ? "w-4 bg-sage" : "bg-charcoal/20 hover:bg-charcoal/40",
              )}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => go(1)}
          aria-label="Next medal"
          className="flex size-9 items-center justify-center rounded-full border border-[#e5e4dc] text-charcoal/70 transition-colors hover:bg-[#f4f3ec] focus:outline-none focus-visible:ring-2 focus-visible:ring-sage"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );

  if (bare) return <div className={className}>{body}</div>;

  return (
    <Card className={cn("overflow-hidden rounded-2xl border-[#e5e4dc] bg-white-warm shadow-none", className)}>
      <CardContent className="flex h-full flex-col p-5 sm:p-6">{body}</CardContent>
    </Card>
  );
}
