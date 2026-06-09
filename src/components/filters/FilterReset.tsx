import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export function FilterReset({
  onReset,
  className,
  label = "Reset",
}: {
  onReset: () => void;
  className?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onReset}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 font-body text-xs font-medium",
        "text-terracotta transition-colors hover:bg-terracotta/10 hover:underline",
        "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-terracotta/40 cursor-pointer",
        className,
      )}
    >
      <RotateCcw className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  );
}
