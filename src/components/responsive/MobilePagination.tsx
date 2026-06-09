import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Windowed page numbers with ellipses so the row never grows unbounded. */
function pageWindow(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "ellipsis")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) out.push("ellipsis");
  for (let p = start; p <= end; p++) out.push(p);
  if (end < total - 1) out.push("ellipsis");
  out.push(total);
  return out;
}

/**
 * Mobile-first pagination: on phones a compact `‹ Page X of Y ›`; on `sm+` the
 * Prev/Next buttons gain labels and a windowed numbered strip (current ±1 with
 * first/last + ellipses) so it never overflows regardless of page count.
 */
export function MobilePagination({
  currentPage,
  totalPages,
  onPageChange,
  className,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  if (totalPages <= 1) return null;
  const go = (p: number) => onPageChange(Math.min(totalPages, Math.max(1, p)));

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border border-sage/20 bg-white-warm p-3 sm:p-4",
        className,
      )}
    >
      <Button
        variant="outline"
        onClick={() => go(currentPage - 1)}
        disabled={currentPage === 1}
        className="shrink-0 border-sage/30 font-body text-sage hover:bg-sage/10 disabled:opacity-30 hover:text-sage!"
      >
        <ChevronLeft size={16} className="sm:mr-1" />
        <span className="hidden sm:inline">Previous</span>
      </Button>

      <span className="font-body text-sm text-charcoal/70 sm:hidden">
        Page {currentPage} of {totalPages}
      </span>

      <div className="hidden items-center gap-1.5 sm:flex">
        {pageWindow(currentPage, totalPages).map((p, i) =>
          p === "ellipsis" ? (
            <span key={`e${i}`} className="w-9 text-center font-body text-charcoal/40">
              …
            </span>
          ) : (
            <Button
              key={p}
              type="button"
              variant={p === currentPage ? "sage" : "sage-outline"}
              size="icon-sm"
              onClick={() => go(p)}
              aria-current={p === currentPage ? "page" : undefined}
              className="rounded-lg"
            >
              {p}
            </Button>
          ),
        )}
      </div>

      <Button
        variant="outline"
        onClick={() => go(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="shrink-0 border-sage/30 font-body text-sage hover:bg-sage/10 disabled:opacity-30 hover:text-sage!"
      >
        <span className="hidden sm:inline">Next</span>
        <ChevronRight size={16} className="sm:ml-1" />
      </Button>
    </div>
  );
}
