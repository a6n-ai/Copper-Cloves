import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowUpDown, ChevronDown, ChevronUp } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type SortDir = "asc" | "desc";

interface UseTableSortOptions<T, K extends string> {
  initialKey?: K | null;
  initialDir?: SortDir;
  /**
   * Return a comparable primitive (number or string) for a given row + key.
   * Numbers sort numerically; strings via localeCompare.
   */
  getValue: (row: T, key: K) => number | string | null | undefined;
  /** Per-key default direction when first activating (e.g. names asc, counts desc). */
  defaultDirFor?: (key: K) => SortDir;
}

interface UseTableSortResult<T, K extends string> {
  sorted: T[];
  sortKey: K | null;
  sortDir: SortDir;
  toggle: (k: K) => void;
}

/**
 * Generic up/down sort hook for admin tables. Keeps a single source of truth for
 * sort state per table. Sort is recomputed only when items / key / dir change.
 */
export function useTableSort<T, K extends string>(
  items: T[],
  options: UseTableSortOptions<T, K>,
): UseTableSortResult<T, K> {
  const { initialKey = null, initialDir = "desc", getValue, defaultDirFor } = options;
  const [sortKey, setSortKey] = useState<K | null>(initialKey);
  const [sortDir, setSortDir] = useState<SortDir>(initialDir);

  // IMPORTANT: do NOT nest setSortDir inside a setSortKey updater — React 18
  // StrictMode invokes setState updaters twice, which would flip direction back.
  // Read current key from a ref so the callback identity stays stable.
  const sortKeyRef = useRef<K | null>(sortKey);
  sortKeyRef.current = sortKey;
  const toggle = useCallback(
    (key: K) => {
      if (sortKeyRef.current === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir(defaultDirFor ? defaultDirFor(key) : "desc");
      }
    },
    [defaultDirFor],
  );

  const sorted = useMemo(() => {
    if (!sortKey) return items;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...items].sort((a, b) => {
      const av = getValue(a, sortKey);
      const bv = getValue(b, sortKey);
      // Nullish values sink to the bottom regardless of direction.
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [items, sortKey, sortDir, getValue]);

  return { sorted, sortKey, sortDir, toggle };
}

interface SortableHeaderProps<K extends string> {
  /** Sort key this header controls. */
  sortKey: K;
  /** Currently active key on the table (or null). */
  active: K | null;
  dir: SortDir;
  onToggle: (k: K) => void;
  children: ReactNode;
  /** Pass-through to TableHead (column width, alignment, etc.) */
  className?: string;
  align?: "left" | "right";
}

export function SortableHeader<K extends string>({
  sortKey,
  active,
  dir,
  onToggle,
  children,
  className,
  align = "left",
}: SortableHeaderProps<K>) {
  const isActive = active === sortKey;
  return (
    <TableHead
      className={cn(
        "font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onToggle(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 uppercase transition-colors hover:text-charcoal",
          "rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-1",
          align === "right" && "ml-auto",
          isActive && "text-charcoal",
        )}
      >
        {children}
        {isActive
          ? (dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)
          : <ArrowUpDown className="h-3 w-3 opacity-40" />}
      </button>
    </TableHead>
  );
}
