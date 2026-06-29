import { ChevronRight, type LucideIcon } from "lucide-react";
import { AnimatedIcon } from "@/components/dashboard/AnimatedIcon";
import { cn } from "@/lib/utils";

export interface PeekTileProps {
  icon: LucideIcon;
  label: string;
  hint?: string;
  onClick: () => void;
  className?: string;
}

/** Compact tap-through tile used in the mobile dashboard "Explore" grid. */
export function PeekTile({ icon, label, hint, onClick, className }: PeekTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border border-sage/15 bg-white-warm p-3.5 text-left active:scale-[0.98] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-1",
        className
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sage/10">
        <AnimatedIcon icon={icon} size={18} className="text-sage" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-body text-sm leading-tight text-charcoal">{label}</span>
        {hint && <span className="block font-body text-xs text-charcoal/50 leading-tight">{hint}</span>}
      </span>
      <ChevronRight size={18} className="shrink-0 text-sage/60" />
    </button>
  );
}
