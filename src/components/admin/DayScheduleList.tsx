import type { ReactNode } from "react";
import { Repeat, CalendarIcon, ChevronRight } from "lucide-react";
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

export function DayScheduleList({
  items,
  onSelect,
  actions,
  emptyText = "No classes scheduled",
  variant = "compact",
  pageSize = 8,
}: Props) {
  const sorted = [...items].sort((a, b) => a.time.localeCompare(b.time));
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
              <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 w-[110px] px-5 py-3">Time</TableHead>
              <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3">Class</TableHead>
              <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3">Instructor</TableHead>
              <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 w-[220px] px-5 py-3">Capacity</TableHead>
              <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 w-[80px] px-5 py-3">Fill</TableHead>
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
