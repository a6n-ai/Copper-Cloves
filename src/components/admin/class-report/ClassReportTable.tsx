import { memo, useCallback, useMemo } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { SortableHeader, useTableSort } from "@/components/admin/sortable-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import { Pill } from "@/components/ui/pill";
import { Pagination, usePagination } from "@/components/Pagination";
import { disciplineLabel, pointDelta, rates, type ClassEntry } from "@/lib/classReport";
import { fmtPct, plural, SAGE_DEEP } from "./format";

type SortKey = "name" | "sessions" | "signups" | "utilization" | "attendance" | "change";
export const ALL_DISCIPLINES = "all";
const ALL = ALL_DISCIPLINES;
// SortableHeader ships its own padding and type; these put it back on TableHead's, so
// headers line up with their cells and match the plain "Trend" header beside them.
const HEAD = "px-4 text-[11px] font-semibold tracking-wider text-muted-foreground";
const HEAD_NUM = `${HEAD} text-right`;
const NUM = "font-body text-sm tabular-nums text-right";

function Sparkline({ values }: Readonly<{ values: (number | null)[] }>) {
  const points = values
    .map((v, i) => (v === null ? null : `${(i / Math.max(1, values.length - 1)) * 100},${28 - (Math.min(100, v) / 100) * 26}`))
    .filter(Boolean);
  if (points.length < 2) return <span className="font-body text-xs text-charcoal/70">—</span>;
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-7 w-24" aria-hidden>
      <polyline points={points.join(" ")} fill="none" stroke={SAGE_DEEP} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function ChangeCell({ change }: Readonly<{ change: number | null }>) {
  if (change === null) return <span className="text-charcoal/70">—</span>;
  const n = Math.round(change);
  if (n === 0) return <span className="text-charcoal/70">Flat</span>;
  const up = n > 0;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <Pill tone={up ? "success" : "warning"} icon={<Icon className="h-3.5 w-3.5" />} className="font-body tabular-nums">
      <span className="sr-only">{up ? "Up" : "Down"} </span>
      {Math.abs(n)} pts
    </Pill>
  );
}

function ClassReportTableImpl({
  classes,
  disciplines,
  discipline,
  onDisciplineChange,
  onSelect,
}: Readonly<{
  classes: ClassEntry[];
  disciplines: string[];
  discipline: string;
  onDisciplineChange: (discipline: string) => void;
  onSelect: (classId: string) => void;
}>) {
  const running = useMemo(() => classes.filter((c) => c.current.sessions > 0), [classes]);

  const rows = useMemo(
    () =>
      running
        .filter((c) => discipline === ALL || c.category === discipline)
        .map((c) => {
          const cur = rates(c.current);
          return {
            ...c,
            utilization: cur.utilization,
            attendance: cur.attendance,
            change: pointDelta(cur.utilization, rates(c.previous).utilization),
          };
        }),
    [running, discipline],
  );
  type Row = (typeof rows)[number];

  const getValue = useCallback((row: Row, key: SortKey): number | string | null => {
    switch (key) {
      case "name":
        return row.name;
      case "sessions":
        return row.current.sessions;
      case "signups":
        return row.current.signups;
      case "utilization":
        return row.utilization;
      case "attendance":
        return row.attendance;
      case "change":
        return row.change;
    }
  }, []);
  const { sorted, sortKey, sortDir, toggle } = useTableSort(rows, {
    initialKey: "signups",
    initialDir: "desc",
    getValue,
    defaultDirFor: (k) => (k === "name" ? "asc" : "desc"),
  });
  const pg = usePagination(sorted, 10, `${sortKey}|${sortDir}|${discipline}`);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-body text-sm text-charcoal/70 tabular-nums">
          {plural(rows.length, "class", "classes")}
          {discipline === ALL ? "" : ` in ${disciplineLabel(discipline)}`}
        </p>
        {disciplines.length > 1 && (
          <Select value={discipline} onValueChange={onDisciplineChange}>
            <SelectTrigger className="w-full sm:w-[200px] font-body" aria-label="Filter by discipline">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All disciplines</SelectItem>
              {disciplines.map((d) => (
                <SelectItem key={d} value={d}>
                  {disciplineLabel(d)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <ResponsiveTable stack>
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader className={HEAD} sortKey="name" active={sortKey} dir={sortDir} onToggle={toggle}>Class</SortableHeader>
              <SortableHeader className={HEAD_NUM} sortKey="sessions" active={sortKey} dir={sortDir} onToggle={toggle}>Sessions</SortableHeader>
              <SortableHeader className={HEAD_NUM} sortKey="signups" active={sortKey} dir={sortDir} onToggle={toggle}>Signups</SortableHeader>
              <SortableHeader className={HEAD} sortKey="utilization" active={sortKey} dir={sortDir} onToggle={toggle}>Utilization</SortableHeader>
              <SortableHeader className={HEAD_NUM} sortKey="attendance" active={sortKey} dir={sortDir} onToggle={toggle}>Attendance</SortableHeader>
              <SortableHeader className={HEAD} sortKey="change" active={sortKey} dir={sortDir} onToggle={toggle}>Change</SortableHeader>
              <TableHead>Trend</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pg.pageItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="font-body text-sm text-charcoal/70 text-center py-8">
                  {discipline === ALL ? "No classes ran in this range." : "No classes ran in this discipline in this range."}
                </TableCell>
              </TableRow>
            )}
            {pg.pageItems.map((row) => (
              <TableRow key={row.classId}>
                <TableCell>
                  <button
                    type="button"
                    onClick={() => onSelect(row.classId)}
                    className="group/name -my-1 block rounded-sm py-1 text-left font-body active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage"
                  >
                    <span className="block font-medium text-charcoal underline decoration-sage/50 underline-offset-4 group-hover/name:decoration-sage">
                      {row.name}
                    </span>
                    <span className="block text-xs text-charcoal/70">{disciplineLabel(row.category)}</span>
                  </button>
                </TableCell>
                <TableCell className={NUM}>{row.current.sessions}</TableCell>
                <TableCell className={`${NUM} whitespace-nowrap`}>
                  {row.current.signups} <span className="text-charcoal/70">/ {row.current.seatsOffered}</span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <span className="w-10 text-right font-body text-sm tabular-nums">{fmtPct(row.utilization)}</span>
                    <div aria-hidden className="h-1.5 w-24 rounded-full bg-sage/15 overflow-hidden">
                      <div className="h-full rounded-full bg-sage" style={{ width: `${Math.min(100, row.utilization ?? 0)}%` }} />
                    </div>
                  </div>
                </TableCell>
                <TableCell className={NUM}>{fmtPct(row.attendance)}</TableCell>
                <TableCell className="font-body text-sm"><ChangeCell change={row.change} /></TableCell>
                <TableCell><Sparkline values={row.spark} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ResponsiveTable>
      <Pagination page={pg.page} total={pg.total} onChange={pg.setPage} />
    </div>
  );
}

export const ClassReportTable = memo(ClassReportTableImpl);
