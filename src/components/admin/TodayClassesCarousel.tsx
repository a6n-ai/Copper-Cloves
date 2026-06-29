import { useEffect, useMemo, useRef, useState } from "react";
import { Users, Clock, Repeat, ChevronLeft, ChevronRight, Power, PowerOff, CalendarX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatedIcon } from "@/components/dashboard/AnimatedIcon";
import { ListAvatar } from "@/components/admin/ListAvatar";
import { Pill } from "@/components/ui/pill";
import { EmptyState } from "@/components/ui/empty-state";
import { ManageButton, DeleteButton } from "@/components/ui/quick-actions";
import { cn } from "@/lib/utils";
import { classFillTier, FILL_TEXT, FILL_BAR } from "@/lib/classFill";
import { classStatusPill } from "@/lib/pillMaps";

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

// Muted whole-card tint for terminal / inactive classes only. Active classes are
// coloured by capacity instead (FILL_CARD) — green when filling, normal otherwise.
// No rings (they clipped at the scroll edge); the card body carries the signal.
const CARD_TONE: Record<string, string> = {
  completed: "border-charcoal/15 bg-charcoal/[0.04] opacity-80 hover:opacity-100",
  cancelled: "border-charcoal/12 bg-charcoal/[0.04] opacity-75",
  abandoned: "border-charcoal/12 bg-charcoal/[0.04] opacity-75",
  inactive: "border-charcoal/10 bg-charcoal/[0.03] opacity-70 hover:opacity-90",
};

// Position / status differentiation (whole-card wash, no outline).
// Ongoing now = solid terracotta fill, no border (the card body IS the colour).
// Imminent next class = sage tint; the rest stay normal.
const ONGOING_TONE = "border-transparent bg-terracotta/[0.18]";
const UPNEXT_TONE = "border-sage/45 bg-sage/[0.12]";
const NORMAL_TONE = "border-border bg-white-warm";

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
      <div className="rounded-xl border border-dashed border-sage/20 bg-sage/5">
        <EmptyState icon={CalendarX} title={emptyText} />
      </div>
    );
  }

  return (
    <div className="relative w-full min-w-0 max-w-full" style={{ containerType: "inline-size" }}>
      <div
        ref={scrollRef}
        className="flex gap-4 w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain snap-x snap-mandatory scrollbar-hide py-6 px-4"
      >
        {items.map((cls, idx) => {
          const tone = classStatusPill(cls.status ?? "available").tone;
          const pct = cls.capacity > 0 ? Math.min(100, Math.round((cls.enrolled / cls.capacity) * 100)) : 0;
          const fillTier = classFillTier(cls.enrolled, cls.capacity);
          const full = cls.enrolled >= cls.capacity && cls.capacity > 0;
          const isNext = idx === nextIndex;
          const isOngoing = cls.status === "live" || cls.status === "started";
          // Card colour differentiates position/status (terminal muted → ongoing →
          // up next → normal). Capacity fill is shown by the bar, not the card.
          const mutedTone = cls.status ? CARD_TONE[cls.status] : undefined;
          const cardTone = mutedTone ?? (isOngoing ? ONGOING_TONE : isNext ? UPNEXT_TONE : NORMAL_TONE);
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
                "group relative shrink-0 w-[85vw] max-w-[340px] sm:w-[340px] snap-start rounded-2xl border p-5 cursor-pointer",
                "transition-[transform,box-shadow,border-color,background-color,opacity] duration-300 ease-out transform-gpu",
                "hover:-translate-y-1 hover:shadow-[0_8px_24px_-12px_rgba(51,51,51,0.14)]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-1",
                cardTone,
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-body font-semibold text-2xl text-charcoal leading-none tabular-nums">
                    <Clock className="h-4 w-4 text-sage shrink-0" />
                    {cls.time}
                  </div>
                  <div className="mt-2 font-body text-base font-medium text-charcoal truncate">
                    {cls.name}
                  </div>
                </div>
                {isNext && (
                  <Pill
                    tone="warning"
                    pulse
                    size="sm"
                    icon={<span className="size-1.5 rounded-full bg-pill-warning-dot" />}
                    className="font-body text-[10px] uppercase tracking-[0.12em]"
                  >
                    Up next
                  </Pill>
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
                  <span className={cn("tabular-nums font-medium", FILL_TEXT[fillTier])}>
                    {full ? "Full" : `${pct}%`}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-sage/10 overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-[width] duration-500", FILL_BAR[fillTier])}
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
                        variant={isActive ? "terracotta" : "sage-outline"}
                        size="icon-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onStatusChange(cls, next);
                        }}
                        aria-label={isActive ? "Set inactive (hide from members)" : "Reactivate class"}
                        title={isActive ? "Set inactive (hide from members)" : "Reactivate class"}
                        className="font-body"
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
          return cardInner;
        })}
      </div>

      {items.length > 1 && (
        <div className="mt-5 flex justify-center">
          <div className="inline-flex items-center gap-1 bg-card/80 border border-sage/20 p-1 rounded-full shadow-xs">
            <button
              type="button"
              onClick={() => scroll("left")}
              aria-label="Scroll left"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-sage hover:bg-sage/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-1"
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
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-sage hover:bg-sage/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-1"
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
