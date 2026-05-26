import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  startIso?: string | null;
  endIso?: string | null;
  /** Static formatted time displayed alongside the relative label. */
  fallbackTime?: string;
  className?: string;
  size?: "sm" | "md";
}

/**
 * Animated countdown pill for a class start/end window.
 *   "in 2h 15m"      — upcoming (>30 min)
 *   "in 12m 24s"     — approaching (≤30 min)
 *   "Starting now"   — within 60 seconds of start
 *   "Live · 24m left" — between start and end (pulses)
 *   "Ended"          — past end
 * Re-renders once per second. If only `startIso` is missing, falls back to the
 * static time label.
 */
export function ClassCountdownPill({ startIso, endIso, fallbackTime, className, size = "md" }: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const padding = size === "sm" ? "px-2.5 py-1 text-sm" : "px-3 py-1.5 text-base";

  if (!startIso) {
    return (
      <div className={cn("inline-flex items-center gap-2 rounded-full bg-sage text-white border border-sage shadow-sm font-display tabular-nums font-medium", padding, className)}>
        <Clock className="h-4 w-4 shrink-0" />
        {fallbackTime ?? ""}
      </div>
    );
  }

  const startMs = new Date(startIso).getTime();
  const endMs = endIso ? new Date(endIso).getTime() : startMs + 60 * 60 * 1000;
  const untilStart = startMs - now;
  const untilEnd = endMs - now;

  let tone = "bg-sage text-white border-sage shadow-sm";
  let metaTone = "text-white/75";
  let label = "";
  let pulse = false;

  if (untilEnd <= 0) {
    tone = "bg-charcoal/70 text-white border-charcoal/70 shadow-sm";
    metaTone = "text-white/70";
    label = "Ended";
  } else if (untilStart <= 0) {
    tone = "bg-amber-500 text-white border-amber-600 shadow-sm";
    metaTone = "text-white/85";
    label = `Live · ${formatDuration(untilEnd)} left`;
    pulse = true;
  } else if (untilStart <= 60_000) {
    tone = "bg-accent text-white border-accent shadow-sm";
    metaTone = "text-white/85";
    label = "Starting now";
    pulse = true;
  } else if (untilStart <= 30 * 60_000) {
    tone = "bg-accent text-white border-accent shadow-sm";
    metaTone = "text-white/85";
    label = `in ${formatDuration(untilStart)}`;
  } else {
    tone = "bg-sage text-white border-sage shadow-sm";
    metaTone = "text-white/75";
    label = `in ${formatDuration(untilStart)}`;
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border font-display font-medium tabular-nums transition-colors duration-300",
        padding,
        tone,
        className,
      )}
    >
      {pulse ? (
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inset-0 rounded-full bg-white opacity-70 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
        </span>
      ) : (
        <Clock className="h-4 w-4 shrink-0" />
      )}
      <span className="leading-none">{label}</span>
      {fallbackTime && (
        <span className={cn("text-[11px] font-body leading-none", metaTone)}>· {fallbackTime}</span>
      )}
    </div>
  );
}

function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m >= 5) return `${m}m`;
  return `${m}m ${String(sec).padStart(2, "0")}s`;
}

export default ClassCountdownPill;
