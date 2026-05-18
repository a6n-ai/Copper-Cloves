import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

const DEFAULT_PAGE_SIZE = 10;

/**
 * Client-side pagination hook. Returns the slice for the current page plus
 * controls + meta. Page resets to 1 if the underlying items shrink past it.
 */
export function usePagination<T>(
  items: T[],
  pageSize: number = DEFAULT_PAGE_SIZE,
  resetKey?: unknown,
) {
  const [page, setPage] = useState(1);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  return { page, setPage, pageItems, total, totalPages, pageSize };
}

export function Pagination({
  page,
  total,
  pageSize = DEFAULT_PAGE_SIZE,
  onChange,
  className,
}: {
  page: number;
  total: number;
  pageSize?: number;
  onChange: (page: number) => void;
  className?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className={`flex items-center justify-between pt-4 ${className ?? ""}`}>
      <p className="font-body text-sm text-charcoal/60">
        Showing {start}–{end} of {total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="border-sage/20 text-sage hover:bg-sage/5"
          disabled={page <= 1}
          onClick={() => onChange(Math.max(1, page - 1))}
        >
          Previous
        </Button>
        <span className="font-body text-sm text-charcoal/70 px-2">
          Page {page} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="border-sage/20 text-sage hover:bg-sage/5"
          disabled={page >= totalPages}
          onClick={() => onChange(Math.min(totalPages, page + 1))}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
