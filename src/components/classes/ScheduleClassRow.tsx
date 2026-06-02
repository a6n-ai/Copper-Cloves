import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export function ScheduleClassRow({
  time,
  name,
  instructor,
  morning,
}: {
  time: string;
  name: string;
  instructor: string;
  morning: boolean;
}) {
  const start = time.split(" - ")[0];
  const initial = (instructor || "").slice(0, 1).toUpperCase();
  return (
    <div className="group flex items-center gap-3.5 rounded-xl border border-[#e5e4dc] bg-white-warm p-3 transition-all duration-200 hover:border-sage/40 hover:shadow-[0_2px_12px_rgba(51,51,51,0.06)]">
      <div
        className={cn(
          "flex min-w-[58px] shrink-0 flex-col items-center justify-center rounded-lg px-2.5 py-2",
          morning ? "bg-sage/12 text-sage" : "bg-cream text-charcoal/70",
        )}
      >
        <Clock className="mb-0.5 size-3.5" aria-hidden="true" />
        <span className="whitespace-nowrap font-body text-xs font-semibold leading-none">{start}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-lg leading-tight text-charcoal">{name}</p>
        <p className="mt-0.5 font-body text-xs text-charcoal/55">{time}</p>
      </div>
      {instructor && (
        <div className="flex shrink-0 items-center gap-2">
          <div
            className="flex size-8 items-center justify-center rounded-full bg-linear-to-br from-terracotta/80 to-terracotta font-display text-xs text-white-warm"
            aria-hidden="true"
          >
            {initial}
          </div>
          <span className="hidden font-body text-xs text-charcoal/65 sm:inline">{instructor}</span>
        </div>
      )}
    </div>
  );
}
