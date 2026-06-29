import { memo, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { NumberTicker } from "@/components/admin/NumberTicker";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  /** Numeric → animated ticker. String → plain text (e.g. "Mon, May 19"). */
  value: number | string;
  icon: LucideIcon;
  /** Optional small sub-text under the number (e.g. "+5 this month"). */
  hint?: string;
  /** Accent color theme. ("clay" is deep terracotta.) */
  tone?: "sage" | "terracotta" | "clay" | "charcoal";
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
  /** When true, show a skeleton in place of the value. */
  loading?: boolean;
  /** Optional trailing slot below the number (e.g. a small badge or button). */
  footer?: ReactNode;
  /** Square tile (Apple-Fitness bento): forces a 1:1 aspect and drops the number to the bottom. */
  square?: boolean;
}

const tones = {
  sage: {
     chip: "bg-sage/10 text-sage group-hover:bg-sage/25 group-hover:text-sage",
    ring: "ring-sage/15 group-hover:ring-sage/40",
    glow: "group-hover:shadow-[0_10px_30px_-12px_rgba(124,148,108,0.45)]",
    border: "group-hover:border-sage/40",
  },
  terracotta: {
    chip: "bg-terracotta/10 text-terracotta group-hover:bg-terracotta/25",
    ring: "ring-terracotta/15 group-hover:ring-terracotta/40",
    glow: "group-hover:shadow-[0_10px_30px_-12px_rgba(196,107,82,0.45)]",
    border: "group-hover:border-terracotta/40",
  },
  // Deep terracotta ("clay") — on-brand warm accent.
  clay: {
    chip: "bg-[#a05e38]/10 text-[#a05e38] group-hover:bg-[#a05e38]/20 group-hover:text-[#a05e38]",
    ring: "ring-[#a05e38]/15 group-hover:ring-[#a05e38]/40",
    glow: "group-hover:shadow-[0_10px_30px_-12px_rgba(160,94,56,0.45)]",
    border: "group-hover:border-[#a05e38]/40",
  },
  charcoal: {
    chip: "bg-charcoal/10 text-charcoal/70 group-hover:bg-charcoal/20 group-hover:text-charcoal",
    ring: "ring-charcoal/15 group-hover:ring-charcoal/35",
    glow: "group-hover:shadow-[0_10px_30px_-12px_rgba(40,40,40,0.4)]",
    border: "group-hover:border-charcoal/30",
  },
};

function MetricCardImpl({
  label,
  value,
  icon: Icon,
  hint,
  tone = "sage",
  prefix,
  suffix,
  decimals = 0,
  className,
  loading = false,
  footer,
  square = false,
}: Readonly<MetricCardProps>) {
  const t = tones[tone];
  let valueBody: ReactNode;
  if (loading) {
    valueBody = <Skeleton className="h-8 w-24 bg-sage/10" />;
  } else if (typeof value === "number") {
    valueBody = (
      <div
        className={cn(
          "font-display text-charcoal leading-none tabular-nums truncate",
          square ? "text-5xl sm:text-6xl" : "text-3xl",
        )}
      >
        <NumberTicker end={value} prefix={prefix} suffix={suffix} decimals={decimals} />
      </div>
    );
  } else {
    valueBody = (
      <div
        className={cn(
          "font-display text-charcoal leading-tight wrap-break-word",
          square ? "text-2xl sm:text-3xl" : "text-lg",
        )}
        title={`${prefix ?? ""}${value}${suffix ?? ""}`}
      >
        {prefix}{value}{suffix}
      </div>
    );
  }
  return (
    <Card
      className={cn(
        "group relative border-sage/15 bg-white-warm h-full overflow-hidden cursor-default",
        "transition-all duration-300 ease-out transform-gpu will-change-transform",
        "hover:-translate-y-1 hover:bg-white-warm hover:brightness-[1.02]",
        square && "min-h-[140px]",
        t.glow,
        t.border,
        className,
      )}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300",
          "group-hover:opacity-100",
          "bg-[radial-gradient(circle_at_top_right,rgba(250,250,248,0.9),transparent_60%)]",
        )}
      />
      <CardContent className="relative p-4 sm:p-5 flex flex-col h-full">
        <div className="flex items-start justify-between gap-3">
          <span className="font-body text-xs uppercase tracking-wide text-muted-text leading-snug min-w-0 line-clamp-2 min-h-[2.25rem] transition-colors duration-300 group-hover:text-charcoal/80">
            {label}
          </span>
          <div
            className={cn(
              "h-9 w-9 rounded-xl flex items-center justify-center ring-2 shrink-0",
              "transition-all duration-300 ease-out transform-gpu",
              "group-hover:scale-110 group-hover:-rotate-6 group-hover:ring-[3px]",
              t.chip,
              t.ring,
            )}
          >
            <Icon className="h-4 w-4 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12" />
          </div>
        </div>
        <div className={cn("mt-3", square && "mt-auto")}>{valueBody}</div>
        {hint && !loading && (
          <div className="font-body text-xs text-charcoal/50 mt-1.5">{hint}</div>
        )}
        {footer && !loading && <div className="mt-2">{footer}</div>}
      </CardContent>
    </Card>
  );
}

// Memoized so MetricCards skip rerender when parent state changes but their props don't.
export const MetricCard = memo(MetricCardImpl);
export default MetricCard;
