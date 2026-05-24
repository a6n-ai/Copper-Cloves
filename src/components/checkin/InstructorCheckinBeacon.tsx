import { useEffect, useState } from "react";
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

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const active = classes
    .map((c) => ({ c, start: new Date(c.startTime).getTime() }))
    .filter(({ start }) => now >= start - OPEN_BEFORE_MS && now <= start + CLOSE_AFTER_MS)
    .sort((a, b) => a.start - b.start)[0];

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
            className="bg-sage hover:bg-sage/90 text-white font-body"
          />
        )}
      </CardContent>
    </Card>
  );
}
