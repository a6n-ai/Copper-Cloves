import { useEffect, useRef, useState } from "react";
import { QrCode, Clock, CalendarOff, User as UserIcon } from "lucide-react";
import { CheckinQrDialog } from "@/components/checkin/CheckinQrDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type Active = { className: string };
type Next = { className: string; instructorName: string | null; startTime: string };

const POS_KEY = "checkin-beacon-pos";
const DRAG_THRESHOLD_PX = 6;

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function relLabel(iso: string) {
  const diffMs = new Date(iso).getTime() - Date.now();
  if (diffMs <= 0) return "starting now";
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `in ${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `in ${h}h ${m}m` : `in ${h}h`;
}

function clampToViewport(x: number, y: number, w: number, h: number) {
  const pad = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return {
    x: Math.max(pad, Math.min(vw - w - pad, x)),
    y: Math.max(pad, Math.min(vh - h - pad, y)),
  };
}

export function CheckinBeacon() {
  const [active, setActive] = useState<Active | null>(null);
  const [next, setNext] = useState<Next | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  // Active press state: pointer offset inside the orb, screen origin, and
  // whether we've crossed the drag threshold (used to suppress the trailing
  // click event so a tap-vs-drag never confuses each other).
  const dragStateRef = useRef<{
    offsetX: number;
    offsetY: number;
    startClientX: number;
    startClientY: number;
    crossed: boolean;
  } | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Restore saved position.
  useEffect(() => {
    try {
      const p = localStorage.getItem(POS_KEY);
      if (p) {
        const parsed = JSON.parse(p);
        if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
          setPos(parsed);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const r = await fetch("/api/admin/active-checkin-schedule");
        if (!r.ok || cancelled) return;
        const d = await r.json();
        if (cancelled) return;
        setActive(d.active ? { className: d.active.className } : null);
        setNext(d.next ?? null);
        setLoaded(true);
      } catch {
        /* ignore */
      }
    };
    poll();
    const id = setInterval(poll, 60000);
    const onVis = () => { if (!document.hidden) poll(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // Drag listeners — only react if pointer is currently pressed on the orb.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const s = dragStateRef.current;
      if (!s || !wrapRef.current) return;
      const dx = e.clientX - s.startClientX;
      const dy = e.clientY - s.startClientY;
      if (!s.crossed && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      s.crossed = true;
      if (!dragging) setDragging(true);
      const rect = wrapRef.current.getBoundingClientRect();
      const nextPos = clampToViewport(
        e.clientX - s.offsetX,
        e.clientY - s.offsetY,
        rect.width,
        rect.height,
      );
      setPos(nextPos);
    };
    const onUp = () => {
      const s = dragStateRef.current;
      if (s?.crossed && pos) {
        try {
          localStorage.setItem(POS_KEY, JSON.stringify(pos));
        } catch {
          /* ignore */
        }
      }
      setDragging(false);
      // Keep `crossed` flag readable in the synthetic click handler that
      // fires right after pointerup, then clear on the next tick.
      if (s) {
        setTimeout(() => {
          dragStateRef.current = null;
        }, 0);
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragging, pos]);

  function beginPress(e: React.PointerEvent) {
    if (!wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    dragStateRef.current = {
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      startClientX: e.clientX,
      startClientY: e.clientY,
      crossed: false,
    };
  }

  function handleClick() {
    if (dragStateRef.current?.crossed) return;
    if (active) {
      setQrOpen(true);
      return;
    }
    if (next) {
      setInfoOpen(true);
      return;
    }
    setInfoOpen(true);
  }

  if (!loaded) return null;

  const defaultWrap = "fixed bottom-20 right-4 z-50 md:bottom-6 md:right-6";
  const positionedStyle = pos
    ? ({ position: "fixed", left: `${pos.x}px`, top: `${pos.y}px`, zIndex: 50 } as React.CSSProperties)
    : undefined;
  const wrapClass = pos ? "" : defaultWrap;
  const cursorClass = dragging ? "cursor-grabbing" : "cursor-grab";

  const orbGradient = active
    ? "bg-linear-to-br from-sage to-sage/80 ring-white/60"
    : next
    ? "bg-linear-to-br from-terracotta to-amber-500 ring-white/40"
    : "bg-linear-to-br from-charcoal/80 to-charcoal ring-white/30";

  const aria = active
    ? `Check-in live: ${active.className}. Tap to open.`
    : next
    ? `Next class: ${next.className}. Tap for details.`
    : "No upcoming classes. Tap for details.";

  return (
    <>
      <div
        ref={wrapRef}
        className={`${wrapClass} ${cursorClass} relative select-none`}
        style={positionedStyle}
        onPointerDown={beginPress}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        aria-label={aria}
        title={aria}
      >
        {/* Outer pulse halo on live state for unmissable visibility. */}
        {active && (
          <span
            className="absolute inset-0 -z-10 rounded-full bg-sage animate-ping opacity-40"
            aria-hidden
          />
        )}
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-full shadow-xl ring-2 transition-transform ${
            dragging ? "" : "hover:scale-110"
          } ${orbGradient} text-white`}
        >
          {active ? <QrCode size={24} /> : next ? <Clock size={22} /> : <CalendarOff size={20} />}
        </div>
        {/* Live indicator dot — matches WhatsApp-style unread badge. */}
        {active && (
          <span
            className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 ring-2 ring-white animate-pulse"
            aria-label="Live"
            aria-hidden
          />
        )}
        {/* "Next" countdown badge */}
        {!active && next && (
          <span className="absolute -top-1 -right-1 rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold text-terracotta shadow ring-1 ring-terracotta/40">
            {relLabel(next.startTime).replace("in ", "")}
          </span>
        )}
      </div>
      <CheckinQrDialog open={qrOpen} onOpenChange={setQrOpen} />
      <NextClassInfoDialog open={infoOpen} onOpenChange={setInfoOpen} next={next} active={active} />
    </>
  );
}

function NextClassInfoDialog({
  open,
  onOpenChange,
  next,
  active,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  next: Next | null;
  active: Active | null;
}) {
  // Idle case — neither active nor next.
  if (!next && !active) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-charcoal">
              No upcoming classes
            </DialogTitle>
            <DialogDescription>
              No classes are currently open for check-in or scheduled ahead.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }
  if (!next) return null;
  const start = new Date(next.startTime);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-charcoal">
            {next.className}
          </DialogTitle>
          <DialogDescription>Next scheduled class</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          <div className="flex items-center gap-3 rounded-xl bg-sage/5 border border-sage/15 px-4 py-3">
            <Clock className="h-5 w-5 text-sage" />
            <div>
              <p className="font-body text-sm text-charcoal">
                {start.toLocaleString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <p className="font-body text-xs text-charcoal/60">{relLabel(next.startTime)}</p>
            </div>
          </div>
          {next.instructorName && (
            <div className="flex items-center gap-3 rounded-xl bg-cream/60 border border-charcoal/10 px-4 py-3">
              <UserIcon className="h-5 w-5 text-charcoal/60" />
              <div>
                <p className="font-body text-sm text-charcoal">{next.instructorName}</p>
                <p className="font-body text-xs text-charcoal/60">Instructor</p>
              </div>
            </div>
          )}
          <p className="text-xs text-charcoal/50 font-body pt-2">
            Check-in opens 30 minutes before class start.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
