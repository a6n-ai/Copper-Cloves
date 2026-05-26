import { useEffect, useState } from "react";
import { QrCode, Clock, CalendarOff } from "lucide-react";
import { CheckinQrDialog } from "@/components/checkin/CheckinQrDialog";

type Active = { className: string };
type Next = { className: string; instructorName: string | null; startTime: string };

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

export function CheckinBeacon() {
  const [active, setActive] = useState<Active | null>(null);
  const [next, setNext] = useState<Next | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
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
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Don't flash the empty state before the first response lands.
  if (!loaded) return null;

  const wrap = "fixed bottom-20 right-4 z-50 md:bottom-5 md:right-5";

  // Check-in window open → live QR pill.
  if (active) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`${wrap} flex items-center gap-2 rounded-full bg-sage px-4 py-3 text-white shadow-lg transition-transform hover:scale-105`}
        >
          <QrCode size={18} />
          <span className="font-body text-sm">Check-in live · {active.className}</span>
        </button>
        <CheckinQrDialog open={open} onOpenChange={setOpen} />
      </>
    );
  }

  // Before the window → next-class info card.
  if (next) {
    return (
      <div
        className={`${wrap} flex max-w-[16rem] items-center gap-3 rounded-2xl border border-sage/20 bg-white/95 px-4 py-3 shadow-lg backdrop-blur`}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sage/10 text-sage">
          <Clock size={18} />
        </div>
        <div className="min-w-0">
          <p className="font-body text-[11px] font-medium uppercase tracking-wider text-charcoal/45">
            Next class · {relLabel(next.startTime)}
          </p>
          <p className="truncate font-body text-sm font-medium text-charcoal">
            {next.className} · {timeLabel(next.startTime)}
          </p>
          {next.instructorName ? (
            <p className="truncate font-body text-xs text-charcoal/55">{next.instructorName}</p>
          ) : null}
        </div>
      </div>
    );
  }

  // Nothing scheduled ahead — stay present but muted.
  return (
    <div
      className={`${wrap} flex items-center gap-2 rounded-full border border-sage/15 bg-white/90 px-4 py-2.5 text-charcoal/50 shadow-md backdrop-blur`}
    >
      <CalendarOff size={16} />
      <span className="font-body text-xs">No upcoming classes</span>
    </div>
  );
}
