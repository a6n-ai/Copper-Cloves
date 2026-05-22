import type { ReactNode } from "react";
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
  /** Accent color theme. */
  tone?: "sage" | "terracotta" | "amber" | "charcoal";
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
  /** When true, show a skeleton in place of the value. */
  loading?: boolean;
  /** Optional trailing slot below the number (e.g. a small badge or button). */
  footer?: ReactNode;
}

const tones = {
  sage: {
    chip: "bg-sage/10 text-sage",
    ring: "ring-sage/15",
  },
  terracotta: {
    chip: "bg-terracotta/10 text-terracotta",
    ring: "ring-terracotta/15",
  },
  amber: {
    chip: "bg-amber-100 text-amber-600",
    ring: "ring-amber-200",
  },
  charcoal: {
    chip: "bg-charcoal/10 text-charcoal/70",
    ring: "ring-charcoal/15",
  },
};

export function MetricCard({
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
}: MetricCardProps) {
  const t = tones[tone];
  return (
    <Card className={cn("border-sage/15 bg-white h-full", className)}>
      <CardContent className="p-5 flex flex-col h-full">
        <div className="flex items-start justify-between gap-3">
          <span className="font-body text-xs uppercase tracking-wide text-charcoal/50 leading-snug min-w-0 line-clamp-2 min-h-[2.25rem]">
            {label}
          </span>
          <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center ring-2 shrink-0", t.chip, t.ring)}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-3">
          {loading ? (
            <Skeleton className="h-8 w-24 bg-sage/10" />
          ) : typeof value === "number" ? (
            <div className="font-display text-3xl text-charcoal leading-none tabular-nums truncate">
              <NumberTicker end={value} prefix={prefix} suffix={suffix} decimals={decimals} />
            </div>
          ) : (
            <div
              className="font-display text-lg text-charcoal leading-tight wrap-break-word"
              title={`${prefix ?? ""}${value}${suffix ?? ""}`}
            >
              {prefix}{value}{suffix}
            </div>
          )}
        </div>
        {hint && !loading && (
          <div className="font-body text-xs text-charcoal/50 mt-1.5">{hint}</div>
        )}
        {footer && !loading && <div className="mt-2">{footer}</div>}
      </CardContent>
    </Card>
  );
}

export default MetricCard;
