import { useEffect, useMemo, useState } from "react";
import { QrCode, CheckCircle2, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CheckInScanButton } from "@/components/checkin/CheckInScanButton";

const OPEN_BEFORE_MS = 30 * 60 * 1000;
const CLOSE_AFTER_MS = 30 * 60 * 1000;

interface BeaconClass {
  id: string;
  className: string;
  startTime: string;
  instructorCheckedIn: boolean;
}

/**
 * Shows a check-in card for the instructor's current class while the window is open
 * (30 min before → 30 min after start), with a live countdown. Once the timer
 * reaches zero the scan button is disabled.
 */
export function InstructorCheckinBeacon({ classes }: { classes: BeaconClass[] }) {
  const [now, setNow] = useState(() => Date.now());

  // Precompute start ms per class once; only recompute when classes ref changes.
  const classStarts = useMemo(
    () => classes.map((c) => ({ c, start: new Date(c.startTime).getTime() })),
    [classes],
  );

  // Soonest class whose window contains `now`, plus a flag for whether any
  // window is still reachable. Pure derivation against memoized inputs — no
  // `Date.now()` during render.
  const { active, anyEverActive } = useMemo(() => {
    let chosen: { c: BeaconClass; start: number } | undefined;
    let everActive = false;
    for (const entry of classStarts) {
      if (now <= entry.start + CLOSE_AFTER_MS) everActive = true;
      if (now >= entry.start - OPEN_BEFORE_MS && now <= entry.start + CLOSE_AFTER_MS) {
        if (!chosen || entry.start < chosen.start) chosen = entry;
      }
    }
    return { active: chosen, anyEverActive: everActive };
  }, [classStarts, now]);

  useEffect(() => {
    if (!anyEverActive) return;
    let id: number | null = null;
    const start = () => {
      if (id !== null) return;
      id = window.setInterval(() => setNow(Date.now()), 1000);
    };
    const stop = () => {
      if (id === null) return;
      clearInterval(id);
      id = null;
    };
    const onVis = () => {
      if (document.hidden) stop();
      else {
        setNow(Date.now());
        start();
      }
    };
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      stop();
    };
  }, [anyEverActive]);

  if (!active) return null;

  const remaining = Math.max(0, active.start + CLOSE_AFTER_MS - now);
  const closed = remaining <= 0;
  const mm = Math.floor(remaining / 60000);
  const ss = Math.floor((remaining % 60000) / 1000);
  const checkedIn = active.c.instructorCheckedIn;

  return (
    <Card className="rounded-2xl border-sage/30 bg-sage/5 shadow-xs">
      <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-sage/15 text-sage">
            <QrCode size={22} />
          </div>
          <div>
            <p className="font-display text-lg text-charcoal">
              {active.c.className} — check-in {closed ? "closed" : "open"}
            </p>
            {checkedIn ? (
              <p className="flex items-center gap-1 font-body text-sm text-sage">
                <CheckCircle2 size={14} /> You&apos;re checked in
              </p>
            ) : closed ? (
              <p className="font-body text-sm text-charcoal/50">Window closed</p>
            ) : (
              <p className="flex items-center gap-1 font-body text-sm text-charcoal/60">
                <Clock size={14} /> Closes in {mm}:{String(ss).padStart(2, "0")}
              </p>
            )}
          </div>
        </div>
        {checkedIn ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-sage/15 px-4 py-2 font-body text-sm text-sage">
            <CheckCircle2 size={16} /> Checked in
          </span>
        ) : (
          <CheckInScanButton
            label={closed ? "Check-in closed" : "Scan to check in"}
            disabled={closed}
            variant="sage"
          />
        )}
      </CardContent>
    </Card>
  );
}
