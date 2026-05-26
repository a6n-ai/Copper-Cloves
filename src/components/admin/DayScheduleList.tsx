import { useState, type ReactNode } from "react";
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
import { cn } from "@/lib/utils";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";

export interface ScheduleRow {
  id: string | number;
  name: string;
  time: string;
  instructor: string;
  instructorAvatarUrl?: string | null;
  enrolled: number;
  capacity: number;
  recurring?: boolean;
  instructorCheckedInAt?: string | null;
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
  if (pct >= 90) return "bg-red-500";
  if (pct >= 70) return "bg-amber-500";
  return "bg-sage";
}

function occupancyBadge(pct: number): string {
  if (pct >= 90) return "border-red-500/30 text-red-600 bg-red-50";
  if (pct >= 70) return "border-amber-500/20 text-amber-600 bg-amber-50";
  return "border-sage/20 text-sage bg-sage/5";
}

type SortKey = "time" | "name" | "instructor" | "capacity" | "fill";
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
  const [sortKey, setSortKey] = useState<SortKey>("time");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = [...items].sort((a, b) => {
    const cmp = compareRows(a, b, sortKey);
    return sortDir === "asc" ? cmp : -cmp;
  });
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
    <div className="space-y-3">
      <ResponsiveTable>
      <div className="rounded-xl border border-sage/15 bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-sage/5 hover:bg-sage/5 border-sage/10">
              <SortHead label="Time" sortKey="time" active={sortKey} dir={sortDir} onSort={toggleSort} className="w-[110px]" />
              <SortHead label="Class" sortKey="name" active={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortHead label="Instructor" sortKey="instructor" active={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortHead label="Capacity" sortKey="capacity" active={sortKey} dir={sortDir} onSort={toggleSort} className="w-[220px]" />
              <SortHead label="Fill" sortKey="fill" active={sortKey} dir={sortDir} onSort={toggleSort} className="w-[80px]" />
              {variant === "expanded" && (
                <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 w-[140px] px-5 py-3 text-right">Actions</TableHead>
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
                    "border-sage/10",
                    interactive && "cursor-pointer hover:bg-sage/5",
                  )}
                  onClick={interactive ? () => onSelect?.(row) : undefined}
                >
                  <TableCell className="font-display text-base text-charcoal px-5 py-4 align-middle whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {row.time}
                      {row.recurring && (
                        <Repeat className="h-3 w-3 text-sage/60" aria-label="Weekly" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-body font-medium text-charcoal px-5 py-4">
                    {row.name}
                  </TableCell>
                  <TableCell className="px-5 py-4">
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
                  </TableCell>
                  <TableCell className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-1.5 flex-1 max-w-[160px] rounded-full bg-sage/10 overflow-hidden">
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
                  <TableCell className="px-5 py-4">
                    <Badge variant="outline" className={cn("font-body", occupancyBadge(pct))}>
                      {pct}%
                    </Badge>
                  </TableCell>
                  {variant === "expanded" && (
                    <TableCell onClick={(e) => e.stopPropagation()} className="px-5 py-4 text-right">
                      <div className="flex items-center gap-1.5 justify-end">{actions?.(row)}</div>
                    </TableCell>
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
      </div>
      </ResponsiveTable>
      <Pagination page={pg.page} total={pg.total} pageSize={pg.pageSize} onChange={pg.setPage} />
    </div>
  );
}

export default DayScheduleList;
