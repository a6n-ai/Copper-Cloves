import { useEffect, useState } from "react";
import { QrCode, Clock, CalendarOff, User as UserIcon } from "lucide-react";
import { CheckinQrDialog } from "@/components/checkin/CheckinQrDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Active = { className: string };
type Next = { className: string; instructorName: string | null; startTime: string };

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Single-unit compact label for the badge overlay (e.g. "45m", "3h").
 *
 * Staleness: the label is recomputed only when the parent re-renders, which
 * happens on the 60s poll above (each fetch reassigns `next`, forcing a render
 * tick). That cadence matches the label's minute resolution — no separate
 * `setInterval` needed. While the tab is hidden, polling pauses and the label
 * intentionally freezes until visibilitychange resumes.
 */
function badgeLabel(iso: string) {
  const diffMs = new Date(iso).getTime() - Date.now();
  if (diffMs <= 0) return "now";
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h`;
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

/**
 * Check-in beacon — non-draggable inline button intended to live in the
 * dashboard sidebar (was previously a floating orb that landed off-screen
 * in production after hydration restored a stale localStorage position).
 * Parent owns layout; component owns polling, click behaviour, and dialogs.
 */
export function CheckinBeacon({ className }: { className?: string }) {
  const [active, setActive] = useState<Active | null>(null);
  const [next, setNext] = useState<Next | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

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

  function handleClick() {
    if (active) {
      setQrOpen(true);
      return;
    }
    setInfoOpen(true);
  }

  if (!loaded) return null;

  const orbGradient = active
    ? "bg-linear-to-br from-sage to-sage/80 ring-cream/60"
    : next
    ? "bg-linear-to-br from-terracotta to-[#a05e38] ring-cream/40"
    : "bg-linear-to-br from-charcoal/80 to-charcoal ring-cream/30";

  const aria = active
    ? `Check-in live: ${active.className}. Tap to open.`
    : next
    ? `Next class: ${next.className}. Tap for details.`
    : "No upcoming classes. Tap for details.";

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label={aria}
        title={aria}
        className={cn("relative flex h-10 w-10 shrink-0 select-none cursor-pointer overflow-visible", className)}
      >
        {/* Outer ping halo — visible above sidebar background (z-0 not -z-10). */}
        <span
          className={cn(
            "absolute inset-0 z-0 rounded-full animate-ping",
            active
              ? "bg-sage opacity-40"
              : next
              ? "bg-terracotta opacity-30"
              : "bg-charcoal opacity-15",
          )}
          aria-hidden
        />
        <span
          className={cn(
            "relative z-10 flex h-10 w-10 items-center justify-center rounded-full shadow ring-2 transition-transform hover:scale-110 text-cream",
            "animate-pulse [animation-duration:2.4s]",
            orbGradient,
          )}
        >
          {active ? <QrCode size={20} /> : next ? <Clock size={18} /> : <CalendarOff size={16} />}
        </span>
        {/* Live indicator dot */}
        {active && (
          <span
            className="absolute -top-0.5 -right-0.5 z-20 flex h-4 w-4 items-center justify-center rounded-full bg-[#a05e38] ring-2 ring-cream animate-pulse"
            aria-label="Live"
            aria-hidden
          />
        )}
        {/* Next countdown badge — one unit only to stay compact */}
        {!active && next && (
          <span className="absolute -top-1 -right-1 z-20 rounded-full bg-white-warm px-1 py-0.5 text-[9px] font-bold text-terracotta shadow ring-1 ring-terracotta/40 leading-none whitespace-nowrap">
            {badgeLabel(next.startTime)}
          </span>
        )}
      </button>
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
