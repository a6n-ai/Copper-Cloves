import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Centered carousel control rail: prev button, scroll-position progress bar,
 * next button. Buttons disable at the track ends. Discoverable on every
 * breakpoint (unlike hover-revealed edge arrows) and works alongside swipe.
 */
export function CarouselControls({
  atStart,
  atEnd,
  progress,
  onPrev,
  onNext,
  label,
  className = "",
}: Readonly<{
  atStart: boolean;
  atEnd: boolean;
  progress: number;
  onPrev: () => void;
  onNext: () => void;
  label: string;
  className?: string;
}>) {
  const btn =
    "hidden h-11 w-11 items-center justify-center rounded-full border border-sage/25 bg-white-warm text-sage transition-all duration-200 ease-out hover:border-sage/50 hover:bg-sage/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-sage/25 disabled:hover:bg-white-warm md:flex";

  return (
    <div className={`flex items-center justify-center gap-5 ${className}`}>
      <button type="button" onClick={onPrev} disabled={atStart} aria-label={`Previous ${label}`} className={btn}>
        <ChevronLeft size={20} />
      </button>

      <div className="h-1 w-24 overflow-hidden rounded-full bg-sage/15 sm:w-44" aria-hidden="true">
        <div
          className="h-full rounded-full bg-sage transition-[width] duration-300 ease-out"
          style={{ width: `${Math.max(14, progress * 100)}%` }}
        />
      </div>

      <button type="button" onClick={onNext} disabled={atEnd} aria-label={`Next ${label}`} className={btn}>
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
