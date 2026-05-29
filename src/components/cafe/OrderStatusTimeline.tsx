import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

const FLOW = [
  { id: "pending", label: "Placed" },
  { id: "preparing", label: "Preparing" },
  { id: "ready", label: "Ready" },
  { id: "completed", label: "Completed" },
] as const;

interface OrderStatusTimelineProps {
  /** Current café order status. */
  status: string;
  className?: string;
}

/**
 * Visual step progression for a café order. Sage owns reached steps (the
 * forward/action voice); upcoming steps are sand. A `cancelled` order renders a
 * single terracotta terminal row instead of the flow — it left the happy path.
 * Presentational only: status in, no callbacks; safe in live + history views.
 */
export function OrderStatusTimeline({ status, className }: OrderStatusTimelineProps) {
  if (status === "cancelled") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border border-terracotta/30 bg-terracotta/10 px-3 py-2",
          className,
        )}
      >
        <span className="flex size-5 items-center justify-center rounded-full bg-terracotta text-white-warm">
          <X size={12} strokeWidth={3} />
        </span>
        <span className="font-body text-sm font-medium text-terracotta">
          Order cancelled
        </span>
      </div>
    );
  }

  const currentIndex = FLOW.findIndex((s) => s.id === status);

  return (
    <ol className={cn("flex items-center", className)} aria-label="Order progress">
      {FLOW.map((step, i) => {
        const reached = i <= currentIndex;
        const isCurrent = i === currentIndex;
        const done = i < currentIndex;
        return (
          <li key={step.id} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full border font-body text-xs transition-colors",
                  done && "border-sage bg-sage text-white-warm",
                  isCurrent && "border-sage bg-sage/15 text-sage ring-2 ring-sage/30",
                  !reached && "border-border bg-sand/40 text-charcoal/40",
                )}
              >
                {done ? <Check size={14} strokeWidth={3} /> : i + 1}
              </span>
              <span
                className={cn(
                  "whitespace-nowrap font-body text-[0.7rem]",
                  reached ? "text-charcoal" : "text-charcoal/40",
                )}
              >
                {step.label}
              </span>
            </div>
            {i < FLOW.length - 1 ? (
              <span
                className={cn(
                  "mx-1.5 -mt-5 h-0.5 flex-1 rounded-full transition-colors",
                  i < currentIndex ? "bg-sage" : "bg-border",
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export default OrderStatusTimeline;
