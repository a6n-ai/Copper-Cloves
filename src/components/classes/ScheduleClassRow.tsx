import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ScheduleClassRow({
  time,
  name,
  instructor,
  instructorImageUrl,
  morning,
  onBook,
}: {
  time: string;
  name: string;
  instructor: string;
  instructorImageUrl: string | null;
  morning: boolean;
  onBook: () => void;
}) {
  const start = time.split(" - ")[0];
  const initial = (instructor || "").slice(0, 1).toUpperCase();
  return (
    <div className="group flex items-center gap-2.5 rounded-xl border border-[#e5e4dc] bg-white-warm p-2.5 transition-all duration-200 hover:border-sage/40 hover:shadow-[0_2px_12px_rgba(51,51,51,0.06)] sm:gap-3 sm:p-3">
      <div
        className={cn(
          "flex min-w-[54px] shrink-0 flex-col items-center justify-center rounded-lg px-2 py-1.5 sm:min-w-[58px] sm:px-2.5 sm:py-2",
          morning ? "bg-sage/12 text-sage" : "bg-cream text-charcoal/70",
        )}
      >
        <Clock className="mb-0.5 size-3.5" aria-hidden="true" />
        <span className="whitespace-nowrap font-body text-[11px] font-semibold leading-none sm:text-xs">{start}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-base leading-tight text-charcoal sm:text-lg">{name}</p>
        <div className="mt-1 flex min-w-0 items-center gap-1.5">
          {instructor &&
            (instructorImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={instructorImageUrl}
                alt={instructor}
                className="size-5 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex size-5 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-terracotta/80 to-terracotta font-display text-[9px] text-white-warm"
              >
                {initial}
              </span>
            ))}
          <span className="truncate font-body text-xs text-charcoal/60">{instructor || "Open class"}</span>
          <span className="hidden shrink-0 font-body text-xs text-charcoal/40 sm:inline">· {time}</span>
        </div>
      </div>
      <Button
        size="sm"
        variant="sage"
        onClick={onBook}
        className="h-9 shrink-0 px-3 font-body text-xs sm:px-4 sm:text-sm"
      >
        Book
      </Button>
    </div>
  );
}
