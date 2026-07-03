import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Phone-only sort affordance for card-stacked tables. The `stack` view has no
 * column headers to click, so this replaces them: a native <select> to pick the
 * sort column + a button to flip direction. Wired to the SAME `useTableSort`
 * contract the desktop SortableHeader uses — `onToggle(key)` sets/flips exactly
 * as clicking a header does, so both views stay in lockstep. `md:hidden`; the
 * desktop headers own sorting at md+.
 */
export function MobileSortControl({
  options,
  activeKey,
  dir,
  onToggle,
  className,
}: {
  options: { value: string; label: string }[];
  activeKey: string | null;
  dir: "asc" | "desc";
  onToggle: (key: string) => void;
  className?: string;
}) {
  if (options.length === 0) return null;
  return (
    <div className={cn("flex items-center gap-2 md:hidden", className)}>
      <label className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Sort
      </label>
      <select
        value={activeKey ?? ""}
        onChange={(e) => onToggle(e.target.value)}
        className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage"
      >
        {activeKey == null && <option value="">Default</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => activeKey && onToggle(activeKey)}
        disabled={!activeKey}
        aria-label={dir === "asc" ? "Sort ascending, tap to reverse" : "Sort descending, tap to reverse"}
        className="shrink-0 rounded-lg border border-border bg-card p-2 text-foreground transition-colors active:bg-muted/60 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage"
      >
        {dir === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
      </button>
    </div>
  );
}
