import { useEffect, useMemo, useRef, useState } from "react";
import { Users, Clock, Repeat, ChevronLeft, ChevronRight, Power, PowerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatedIcon } from "@/components/dashboard/AnimatedIcon";
import { ListAvatar } from "@/components/admin/ListAvatar";
import { Pill } from "@/components/ui/pill";
import { ManageButton, DeleteButton } from "@/components/ui/quick-actions";
import { cn } from "@/lib/utils";
import { ShineBorder } from "@/components/ui/shine-border";

export type CarouselClassStatus =
  | "available"
  | "live"
  | "inactive"
  | "cancelled"
  | "completed"
  | "abandoned";


export interface CarouselClassRow {
  id: string;
  name: string;
  time: string;
  /** ISO start. When present, the card renders a live countdown pill. */
  startIso?: string;
  /** ISO end. Lets the pill switch to "in progress" / "ended". */
  endIso?: string;
  instructor: string;
  instructorAvatarUrl?: string | null;
  enrolled: number;
  capacity: number;
  recurring?: boolean;
  status?: string;
  _raw?: unknown;
}

interface TodayClassesCarouselProps {
  items: CarouselClassRow[];
  onSelect?: (row: CarouselClassRow) => void;
  onManage?: (row: CarouselClassRow) => void;
  onDelete?: (row: CarouselClassRow) => void;
  onStatusChange?: (row: CarouselClassRow, status: CarouselClassStatus) => void;
  emptyText?: string;
  /** Only highlight "Up next" when the displayed day is today. */
  isToday?: boolean;
}

const TERMINAL_STATUSES = new Set(["completed", "abandoned", "live", "started"]);

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  available: "success",
  started: "warning",
  live: "warning",
  completed: "neutral",
  cancelled: "warning",
  inactive: "neutral",
  abandoned: "warning",
};

// Whole-card tint by status. Falls back to PALETTE rotation for available.
const CARD_TONE: Record<string, string> = {
  live: "border-terracotta/30 bg-terracotta/10 shadow-[0_8px_24px_-12px_rgba(193,120,86,0.45)] ring-1 ring-terracotta/30 hover:shadow-[0_16px_40px_-16px_rgba(193,120,86,0.55)]",
  started: "border-terracotta/30 bg-terracotta/10 shadow-[0_8px_24px_-12px_rgba(193,120,86,0.45)] ring-1 ring-terracotta/30 hover:shadow-[0_16px_40px_-16px_rgba(193,120,86,0.55)]",
  completed: "border-charcoal/15 bg-charcoal/[0.04] opacity-80 hover:opacity-100 hover:shadow-[0_12px_32px_-16px_rgba(0,0,0,0.2)]",
  cancelled: "border-terracotta/30 bg-linear-to-br from-terracotta/15 via-[#fafaf8] to-terracotta/5 ring-1 ring-terracotta/20 hover:shadow-[0_12px_32px_-16px_rgba(192,86,64,0.35)]",
  abandoned: "border-terracotta/30 bg-linear-to-br from-terracotta/15 via-[#fafaf8] to-terracotta/5 ring-1 ring-terracotta/20 hover:shadow-[0_12px_32px_-16px_rgba(192,86,64,0.35)]",
  inactive: "border-charcoal/10 bg-charcoal/[0.03] opacity-70 hover:opacity-90",
};

// Single tint for all "available" cards — consistent strip, more color than plain white.
const AVAILABLE_TONE =
  "border-sage/30 bg-linear-to-br from-sage/15 via-[#fafaf8] to-cream/40 hover:shadow-[0_12px_32px_-16px_rgba(143,151,121,0.45)] hover:border-sage/50";

function parseTimeToMinutes(t: string): number {
  // Accepts "07:00", "7:00 AM", "10:30 PM" — best-effort.
  const m = /^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?/i.exec(t.trim());
  if (!m) return Number.POSITIVE_INFINITY;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const period = m[3]?.toUpperCase();
  if (period === "PM" && h < 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return h * 60 + min;
}

export function TodayClassesCarousel({
  items,
  onSelect,
  onManage,
  onDelete,
  onStatusChange,
  emptyText = "No classes scheduled.",
  isToday = true,
}: Readonly<TodayClassesCarouselProps>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // Re-evaluate "next class" every minute so the highlight tracks the wall clock
  // even if the dashboard stays open.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  function scroll(dir: "left" | "right") {
    if (!scrollRef.current) return;
    const card = scrollRef.current.querySelector<HTMLElement>("[data-card]");
    const step = (card?.offsetWidth ?? 320) + 16;
    scrollRef.current.scrollBy({ left: dir === "left" ? -step : step, behavior: "smooth" });
  }

  // Index of the next upcoming class. Recompute only on item/tick change, not every
  // parent render. `tick` increments every 60s to refresh the highlight.
  const nextIndex = useMemo(() => {
    if (!isToday) return -1;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    return items.findIndex((c) => {
      const ok = !c.status || c.status === "available" || c.status === "live" || c.status === "started";
      return ok && parseTimeToMinutes(c.time) >= nowMin;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, isToday, tick]);

  // Auto-scroll the carousel so the active/next-upcoming class is in view.
  // Otherwise the list always starts at the earliest class of the day even when
  // it's long over — admins had to scroll right to find the relevant class.
  useEffect(() => {
    if (!scrollRef.current) return;
    if (nextIndex < 0) return;
    const cards = scrollRef.current.querySelectorAll<HTMLElement>("[data-card]");
    const target = cards[nextIndex];
    if (!target) return;
    // Align target to the left edge of the scroll container.
    const containerRect = scrollRef.current.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const delta = targetRect.left - containerRect.left;
    scrollRef.current.scrollBy({ left: delta, behavior: "smooth" });
  }, [nextIndex, items.length]);

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 rounded-xl border border-dashed border-sage/20 bg-sage/5">
        <p className="font-body text-sm text-charcoal/50">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="relative w-full min-w-0 max-w-full" style={{ containerType: "inline-size" }}>
      <div
        ref={scrollRef}
        className="flex gap-4 w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain snap-x snap-mandatory scrollbar-hide py-2 px-1"
      >
        {items.map((cls, idx) => {
          const tone = STATUS_TONE[cls.status ?? "available"] ?? STATUS_TONE.available;
          const explicitTone = cls.status ? CARD_TONE[cls.status] : undefined;
          const cardTone = explicitTone ?? AVAILABLE_TONE;
          const pct = cls.capacity > 0 ? Math.min(100, Math.round((cls.enrolled / cls.capacity) * 100)) : 0;
          const full = cls.enrolled >= cls.capacity && cls.capacity > 0;
          const isNext = idx === nextIndex;
          const cardInner = (
            <div
              key={cls.id}
              data-card
              onClick={() => onSelect?.(cls)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect?.(cls);
                }
              }}
              className={cn(
                "group relative shrink-0 w-[340px] snap-start rounded-2xl border p-5 cursor-pointer",
                "transition-all duration-300 ease-out transform-gpu",
                "hover:-translate-y-1",
                cardTone,
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-display text-2xl text-charcoal leading-none tabular-nums">
                    <Clock className="h-4 w-4 text-sage shrink-0" />
                    {cls.time}
                  </div>
                  <div className="mt-2 font-body text-base font-medium text-charcoal truncate">
                    {cls.name}
                  </div>
                </div>
                {isNext && (
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 text-accent border border-accent/30 px-2.5 py-0.5 font-body text-[10px] uppercase tracking-[0.12em] whitespace-nowrap">
                    <span className="size-1.5 rounded-full bg-accent animate-pulse" />
                    <span>Up next</span>
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center gap-4">
                <ListAvatar
                  name={cls.instructor}
                  src={cls.instructorAvatarUrl}
                  size="lg"
                  ringClassName="ring-2 ring-sage/25"
                  className="shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-body text-[15px] font-medium text-charcoal truncate">{cls.instructor}</div>
                  <div className="font-body text-[11px] text-charcoal/45 uppercase tracking-wide mt-0.5">Instructor</div>
                  {cls.recurring && (
                    <div className="mt-1 flex items-center gap-1 font-body text-[11px] text-charcoal/55">
                      <Repeat className="h-3 w-3" /> Recurring
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between font-body text-xs text-charcoal/60 mb-1.5">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {cls.enrolled} / {cls.capacity}
                  </span>
                  <span className={cn("tabular-nums", full ? "text-terracotta font-medium" : "text-sage")}>
                    {full ? "Full" : `${pct}%`}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-sage/10 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      full ? "bg-terracotta" : "bg-sage",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {(onManage || onDelete || onStatusChange || cls.status) && (
                <div className="mt-4 flex items-center justify-between gap-2">
                  {cls.status ? (
                    <Pill
                      tone={tone}

                      className="capitalize font-body text-xs whitespace-nowrap"
                    >
                      {cls.status}
                    </Pill>
                  ) : <span />}
                  <div className="flex items-center gap-1.5">
                  {onStatusChange && !TERMINAL_STATUSES.has(cls.status ?? "") && (() => {
                    const isActive = (cls.status ?? "available") === "available";
                    const next: CarouselClassStatus = isActive ? "inactive" : "available";
                    return (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onStatusChange(cls, next);
                        }}
                        aria-label={isActive ? "Set inactive (hide from members)" : "Reactivate class"}
                        title={isActive ? "Set inactive (hide from members)" : "Reactivate class"}
                        className={cn(
                          "font-body h-8 w-8 p-0 transition-all hover:scale-110 active:scale-95",
                          isActive
                            ? "border-terracotta/40 text-terracotta bg-white-warm hover:bg-terracotta! hover:text-cream! hover:border-terracotta!"
                            : "border-sage/60 text-sage bg-white-warm hover:bg-sage! hover:text-cream! hover:border-sage!",
                        )}
                      >
                        <AnimatedIcon icon={isActive ? PowerOff : Power} size={14} animateOnMount={false} hover="wiggle" />
                      </Button>
                    );
                  })()}
                  {onManage && (
                    <ManageButton
                      onClick={(e) => {
                        e.stopPropagation();
                        onManage(cls);
                      }}
                    />
                  )}
                  {onDelete && (
                    <DeleteButton
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(cls);
                      }}
                    />
                  )}
                  </div>
                </div>
              )}
            </div>
          );
          if (isNext) {
            return (
              <ShineBorder
                key={cls.id}
                borderWidth={2}
                duration={4}
                className="shrink-0 snap-start"
              >
                {cardInner}
              </ShineBorder>
            );
          }
          return cardInner;
        })}
      </div>

      {items.length > 1 && (
        <div className="mt-5 flex justify-center">
          <div className="inline-flex items-center gap-1 bg-[#fafaf8]/80 border border-sage/20 p-1 rounded-full shadow-xs">
            <button
              type="button"
              onClick={() => scroll("left")}
              aria-label="Scroll left"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-sage hover:bg-sage/10 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 font-body text-xs text-charcoal/55 tabular-nums select-none">
              {items.length} class{items.length === 1 ? "" : "es"}
            </span>
            <button
              type="button"
              onClick={() => scroll("right")}
              aria-label="Scroll right"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-sage hover:bg-sage/10 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}

export default TodayClassesCarousel;
