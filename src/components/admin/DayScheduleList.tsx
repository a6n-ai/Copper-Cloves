import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/router";
import { Repeat, CalendarIcon, ChevronRight, ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pagination, usePagination } from "@/components/Pagination";
import { ListAvatar } from "@/components/admin/ListAvatar";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import { cn } from "@/lib/utils";

export interface ScheduleRow {
  id: string | number;
  name: string;
  time: string;
  instructor: string;
  instructorId?: string | null;
  instructorAvatarUrl?: string | null;
  enrolled: number;
  capacity: number;
  recurring?: boolean;
  instructorCheckedInAt?: string | null;
  status?: string;
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "available":
      return "border-sage/30 text-sage bg-sage/10";
    case "inactive":
      return "border-terracotta/30 text-terracotta bg-terracotta/10";
    case "started":
      return "border-sage/30 text-sage bg-sage/10";
    case "completed":
      return "border-charcoal/20 text-charcoal/70 bg-charcoal/5";
    case "cancelled":
      return "border-[#a05e38]/25 text-[#a05e38] bg-[#a05e38]/10";
    case "abandoned":
      return "border-[#a05e38]/20 text-[#a05e38]/80 bg-[#a05e38]/5";
    default:
      return "border-charcoal/20 text-charcoal/60 bg-white-warm";
  }
}

interface Props {
  items: ScheduleRow[];
  onSelect?: (item: ScheduleRow) => void;
  actions?: (item: ScheduleRow) => ReactNode;
  emptyText?: string;
  /** compact = dashboard-style; expanded = schedule page detail with action column */
  variant?: "compact" | "expanded";
  pageSize?: number;
}

function occupancyColor(pct: number): string {
  if (pct >= 90) return "bg-[#a05e38]";
  if (pct >= 70) return "bg-terracotta";
  return "bg-sage";
}

function occupancyBadge(pct: number): string {
  if (pct >= 90) return "border-[#a05e38]/25 text-[#a05e38] bg-[#a05e38]/10";
  if (pct >= 70) return "border-terracotta/20 text-terracotta bg-terracotta/10";
  return "border-sage/20 text-sage bg-sage/5";
}

type SortKey = "time" | "name" | "instructor" | "capacity" | "fill" | "status";

const STATUS_ORDER: Record<string, number> = {
  available: 0,
  started: 1,
  inactive: 2,
  completed: 3,
  cancelled: 4,
  abandoned: 5,
};
type SortDir = "asc" | "desc";

/** Parse "07:00 AM" / "01:30 PM" / "14:05" into minutes-of-day for correct ordering. */
function timeToMinutes(t: string): number {
  const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return Number.MAX_SAFE_INTEGER;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const mer = m[3]?.toUpperCase();
  if (mer === "PM" && h !== 12) h += 12;
  if (mer === "AM" && h === 12) h = 0;
  return h * 60 + min;
}

function fillPct(row: ScheduleRow): number {
  return row.enrolled / Math.max(row.capacity, 1);
}

function compareRows(a: ScheduleRow, b: ScheduleRow, key: SortKey): number {
  switch (key) {
    case "time":
      return timeToMinutes(a.time) - timeToMinutes(b.time);
    case "name":
      return a.name.localeCompare(b.name);
    case "instructor":
      return (a.instructor || "").localeCompare(b.instructor || "");
    case "capacity":
      return a.enrolled - b.enrolled;
    case "fill":
      return fillPct(a) - fillPct(b);
    case "status": {
      const av = STATUS_ORDER[a.status ?? "available"] ?? 99;
      const bv = STATUS_ORDER[b.status ?? "available"] ?? 99;
      return av - bv;
    }
  }
}

function SortHead({
  label,
  sortKey,
  active,
  dir,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  active: SortKey;
  dir: SortDir;
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const isActive = active === sortKey;
  return (
    <TableHead className={cn("font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3", className)}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 transition-colors hover:text-charcoal",
          isActive && "text-charcoal",
        )}
      >
        {label}
        {isActive ? (
          dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ChevronsUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </TableHead>
  );
}

export function DayScheduleList({
  items,
  onSelect,
  actions,
  emptyText = "No classes scheduled",
  variant = "compact",
  pageSize = 8,
}: Props) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>("time");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Don't nest setSortDir inside a setSortKey updater — StrictMode invokes the
  // updater twice which flips direction back. Read latest key via ref.
  const sortKeyRef = useRef(sortKey);
  sortKeyRef.current = sortKey;
  const toggleSort = useCallback((key: SortKey) => {
    if (sortKeyRef.current === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }, []);

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const cmp = compareRows(a, b, sortKey);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [items, sortKey, sortDir]);
  const pg = usePagination(sorted, pageSize);

  if (items.length === 0) {
    return (
      <div className="text-center py-10">
        <CalendarIcon className="h-10 w-10 text-charcoal/20 mx-auto mb-2" />
        <p className="font-body text-sm text-charcoal/50">{emptyText}</p>
      </div>
    );
  }

  const interactive = Boolean(onSelect);

  return (
    <div className="space-y-3 min-w-0">
      <div className="rounded-xl border border-sage/15 bg-white-warm overflow-hidden">
        <ResponsiveTable>
        <Table className="w-full table-fixed min-w-[640px]">
          <TableHeader>
            <TableRow className="bg-sage/5 hover:bg-sage/5 border-sage/10">
              <SortHead label="Class & Time" sortKey="time" active={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortHead label="Instructor" sortKey="instructor" active={sortKey} dir={sortDir} onSort={toggleSort} className="w-[22%]" />
              <SortHead label="Capacity" sortKey="capacity" active={sortKey} dir={sortDir} onSort={toggleSort} className="w-[180px] hidden md:table-cell" />
              <SortHead label="Fill" sortKey="fill" active={sortKey} dir={sortDir} onSort={toggleSort} className="w-[72px] hidden md:table-cell" />
              {variant === "expanded" && (
                <>
                  <SortHead label="Status" sortKey="status" active={sortKey} dir={sortDir} onSort={toggleSort} className="w-[110px] hidden lg:table-cell" />
                  <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 w-[150px] px-3 py-3 text-right">Actions</TableHead>
                </>
              )}
              {variant === "compact" && interactive && <TableHead className="w-[40px] px-3" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pg.pageItems.map((row) => {
              const cap = Math.max(row.capacity, 1);
              const pct = Math.min(100, Math.round((row.enrolled / cap) * 100));
              return (
                <TableRow
                  key={row.id}
                  className={cn(
                    "border-sage/10 transition-colors",
                    interactive && "cursor-pointer hover:bg-sage/10",
                  )}
                  onClick={interactive ? () => onSelect?.(row) : undefined}
                >
                  <TableCell className="px-3 py-4">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="font-body font-medium text-charcoal truncate">
                        {row.name}
                      </div>
                      <div className="flex items-center gap-2 text-xs font-body text-charcoal/60 whitespace-nowrap">
                        <span className="font-display text-sm text-charcoal/80">{row.time}</span>
                        {row.recurring && (
                          <Repeat className="h-3 w-3 text-sage/60" aria-label="Weekly" />
                        )}
                        {variant === "expanded" && row.status && row.status !== "available" && (
                          <span className="lg:hidden">
                            <Badge variant="outline" className={cn("font-body capitalize text-[10px] py-0", statusBadgeClass(row.status))}>
                              {row.status}
                            </Badge>
                          </span>
                        )}
                        <span className="md:hidden tabular-nums">· {row.enrolled}/{row.capacity}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-4" onClick={(e) => e.stopPropagation()}>
                    {row.instructorId ? (
                      <button
                        type="button"
                        onClick={() => router.push(`/admin/instructors/${row.instructorId}`)}
                        className="group flex items-center gap-3 min-w-0 rounded-md -mx-1 px-1 py-0.5 hover:bg-sage/10 transition-colors text-left"
                        aria-label={`Open profile for ${row.instructor || "instructor"}`}
                      >
                        <ListAvatar
                          name={row.instructor || "—"}
                          src={row.instructorAvatarUrl}
                          size="sm"
                          ringClassName="ring-sage/20"
                        />
                        <div className="font-body text-sm text-charcoal truncate group-hover:text-sage transition-colors">
                          {row.instructor || "—"}
                        </div>
                      </button>
                    ) : (
                      <div className="flex items-center gap-3 min-w-0">
                        <ListAvatar
                          name={row.instructor || "—"}
                          src={row.instructorAvatarUrl}
                          size="sm"
                          ringClassName="ring-sage/20"
                        />
                        <div className="font-body text-sm text-charcoal truncate">
                          {row.instructor || "—"}
                        </div>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-4 hidden md:table-cell">
                    <div className="flex items-center gap-3">
                      <div className="h-1.5 flex-1 max-w-[120px] rounded-full bg-sage/10 overflow-hidden">
                        <div
                          className={cn("h-full transition-all", occupancyColor(pct))}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs font-body text-charcoal/60 tabular-nums whitespace-nowrap">
                        {row.enrolled}/{row.capacity}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-4 hidden md:table-cell">
                    <Badge variant="outline" className={cn("font-body", occupancyBadge(pct))}>
                      {pct}%
                    </Badge>
                  </TableCell>
                  {variant === "expanded" && (
                    <>
                      <TableCell className="px-3 py-4 hidden lg:table-cell">
                        <Badge variant="outline" className={cn("font-body capitalize", statusBadgeClass(row.status ?? "available"))}>
                          {row.status ?? "available"}
                        </Badge>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()} className="px-3 py-4 text-right">
                        <div className="flex items-center gap-1.5 justify-end">{actions?.(row)}</div>
                      </TableCell>
                    </>
                  )}
                  {variant === "compact" && interactive && (
                    <TableCell className="text-charcoal/30 px-3 py-4">
                      <ChevronRight className="h-4 w-4" />
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </ResponsiveTable>
      </div>
      <Pagination page={pg.page} total={pg.total} pageSize={pg.pageSize} onChange={pg.setPage} />
    </div>
  );
}

export default DayScheduleList;
