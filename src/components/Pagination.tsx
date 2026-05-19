import { useEffect, useId, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Pagination as ShadPagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

const DEFAULT_PAGE_SIZE = 10;

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

function buildPageWindow(current: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages: (number | "ellipsis")[] = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(totalPages - 1, current + 1);
  if (left > 2) pages.push("ellipsis");
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < totalPages - 1) pages.push("ellipsis");
  pages.push(totalPages);
  return pages;
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
  const layoutId = useId();
  if (total <= pageSize) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const items = buildPageWindow(page, totalPages);

  return (
    <div className={cn("flex flex-col sm:flex-row items-center justify-between gap-3 pt-4", className)}>
      <p className="font-body text-sm text-charcoal/60">
        Showing {start}–{end} of {total}
      </p>
      <ShadPagination className="mx-0 w-auto">
        <PaginationContent className="bg-white/80 border border-sage/20 p-1 rounded-full shadow-xs">
          <PaginationItem>
            <PaginationPrevious
              href="#"
              aria-disabled={page <= 1}
              onClick={(e) => {
                e.preventDefault();
                if (page > 1) onChange(page - 1);
              }}
              className={cn(
                "rounded-full text-sage hover:bg-sage/10 hover:text-sage",
                page <= 1 && "pointer-events-none opacity-40",
              )}
            />
          </PaginationItem>

          <div className="relative flex items-center mx-1">
            {items.map((it, idx) =>
              it === "ellipsis" ? (
                <PaginationItem key={`e-${idx}`}>
                  <PaginationEllipsis className="text-charcoal/40" />
                </PaginationItem>
              ) : (
                <PaginationItem key={it} className="relative">
                  <PaginationLink
                    href="#"
                    isActive={page === it}
                    onClick={(e) => {
                      e.preventDefault();
                      onChange(it);
                    }}
                    className={cn(
                      "relative z-10 w-9 h-9 rounded-full border-0 transition-colors text-xs font-bold tracking-tighter",
                      page === it
                        ? "bg-transparent text-white hover:bg-transparent hover:text-white"
                        : "text-charcoal/60 hover:text-charcoal hover:bg-sage/10",
                    )}
                  >
                    {it}
                  </PaginationLink>
                  {page === it && (
                    <motion.div
                      layoutId={`pill-active-${layoutId}`}
                      className="absolute inset-0 bg-sage rounded-full shadow-md"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </PaginationItem>
              ),
            )}
          </div>

          <PaginationItem>
            <PaginationNext
              href="#"
              aria-disabled={page >= totalPages}
              onClick={(e) => {
                e.preventDefault();
                if (page < totalPages) onChange(page + 1);
              }}
              className={cn(
                "rounded-full text-sage hover:bg-sage/10 hover:text-sage",
                page >= totalPages && "pointer-events-none opacity-40",
              )}
            />
          </PaginationItem>
        </PaginationContent>
      </ShadPagination>
    </div>
  );
}
