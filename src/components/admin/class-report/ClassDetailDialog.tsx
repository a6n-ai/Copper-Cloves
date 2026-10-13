import { useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, usePagination } from "@/components/Pagination";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/responsive/ResponsiveDialog";
import { disciplineLabel, emptyTotals, rates, type SessionEntry } from "@/lib/classReport";
import { ClassHeatmap } from "./ClassHeatmap";
import { ClassReportKpis } from "./ClassReportKpis";
import { ClassTrendChart } from "./ClassTrendChart";
import { fmtPct, fmtRange } from "./format";
import { useClassReport } from "./useClassReport";

const EMPTY = emptyTotals();
const NO_SESSIONS: SessionEntry[] = [];
const sessionTime = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

const SECTION = "font-body font-semibold text-base text-charcoal";
const NUM = "font-body text-sm tabular-nums text-right";
const EMPTY_ROW = "font-body text-sm text-charcoal/70 text-center py-6";

function DetailBody({
  classId,
  from,
  to,
  fallbackName,
}: Readonly<{ classId: string; from: string; to: string; fallbackName?: string }>) {
  const { data, error, loading, retry } = useClassReport(from, to, classId);
  const cls = data?.classes[0];
  const instructors = data?.instructors ?? [];
  const sessions = usePagination(data?.sessions ?? NO_SESSIONS, 10);
  const name = cls?.name ?? fallbackName;

  return (
    <>
      <ResponsiveDialogHeader>
        <ResponsiveDialogTitle className="font-body text-xl text-charcoal">
          {name ?? (loading ? "Loading class…" : "Class report")}
        </ResponsiveDialogTitle>
        <ResponsiveDialogDescription className="font-body text-charcoal/70 tabular-nums">
          {cls ? `${disciplineLabel(cls.category)} · ${fmtRange(from, to)}` : fmtRange(from, to)}
        </ResponsiveDialogDescription>
      </ResponsiveDialogHeader>

      {error && (
        <div className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div role="alert" className="space-y-1">
            <p className="font-body text-sm font-medium text-charcoal">{error}</p>
            {data && <p className="font-body text-xs text-charcoal/75">The figures below are from before the retry.</p>}
          </div>
          <Button variant="outline" size="sm" onClick={retry} disabled={loading} className="font-body w-full sm:w-auto">
            Try again
          </Button>
        </div>
      )}

      <div
        className={`space-y-6 transition-opacity duration-200 motion-reduce:transition-none ${loading && data ? "opacity-60" : ""}`}
        aria-busy={loading}
      >
        {(data || !error) && (
          <ClassReportKpis current={data?.current ?? EMPTY} previous={data?.previous ?? EMPTY} loading={loading && !data} />
        )}

        {loading && !data && !error && <Skeleton className="h-[380px] w-full bg-sage/10" />}

        {data && data.current.sessions === 0 && (
          <p className="font-body text-sm text-charcoal/70 py-8 text-center">This class had no sessions in this range.</p>
        )}

        {data && data.current.sessions > 0 && (
          <>
            <section className="space-y-3">
              <h3 className={SECTION}>Trend</h3>
              <ClassTrendChart trend={data.trend} bucket={data.range.bucket} from={data.range.from} to={data.range.to} />
            </section>

            <section className="space-y-3">
              <h3 className={SECTION}>By weekday and start time</h3>
              <ClassHeatmap heatmap={data.heatmap} />
            </section>

            <section className="space-y-3">
              <h3 className={SECTION}>By instructor</h3>
              <ResponsiveTable stack>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Instructor</TableHead>
                      <TableHead className="text-right">Sessions</TableHead>
                      <TableHead className="text-right">Signups</TableHead>
                      <TableHead className="text-right">Utilization</TableHead>
                      <TableHead className="text-right">Attendance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {instructors.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className={EMPTY_ROW}>No instructor is recorded for these sessions.</TableCell>
                      </TableRow>
                    )}
                    {instructors.map((i) => {
                      const r = rates(i.totals);
                      return (
                        <TableRow key={i.instructorId ?? "unassigned"}>
                          <TableCell className="font-body font-medium text-charcoal">{i.name}</TableCell>
                          <TableCell className={NUM}>{i.totals.sessions}</TableCell>
                          <TableCell className={NUM}>
                            {i.totals.signups} <span className="text-charcoal/70">/ {i.totals.seatsOffered}</span>
                          </TableCell>
                          <TableCell className={NUM}>{fmtPct(r.utilization)}</TableCell>
                          <TableCell className={NUM}>{fmtPct(r.attendance)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ResponsiveTable>
            </section>

            <section className="space-y-3">
              <h3 className={SECTION}>Sessions</h3>
              <ResponsiveTable stack>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Instructor</TableHead>
                      <TableHead className="text-right">Signups</TableHead>
                      <TableHead className="text-right">Attended</TableHead>
                      <TableHead className="text-right">No-shows</TableHead>
                      <TableHead className="text-right">Cancelled</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.total === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className={EMPTY_ROW}>No sessions to list for this range.</TableCell>
                      </TableRow>
                    )}
                    {sessions.pageItems.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-body text-sm whitespace-nowrap tabular-nums">
                          <Link
                            href={`/admin/schedule/${s.id}`}
                            className="text-charcoal underline underline-offset-4 decoration-sage/50 hover:decoration-sage focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage rounded-sm"
                          >
                            {sessionTime.format(new Date(s.startTime))}
                          </Link>
                          {!s.ended && <Pill tone="info" className="font-body ml-2">Upcoming</Pill>}
                        </TableCell>
                        <TableCell className="font-body text-sm">{s.instructorName}</TableCell>
                        <TableCell className={NUM}>
                          {s.signups} <span className="text-charcoal/70">/ {s.capacity}</span>
                        </TableCell>
                        <TableCell className={NUM}>{s.ended ? s.attended : "—"}</TableCell>
                        <TableCell className={NUM}>{s.ended ? s.noShows : "—"}</TableCell>
                        <TableCell className={NUM}>{s.cancelled}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ResponsiveTable>
              <Pagination page={sessions.page} total={sessions.total} onChange={sessions.setPage} />
            </section>
          </>
        )}
      </div>
    </>
  );
}

export function ClassDetailDialog({
  classId,
  from,
  to,
  fallbackName,
  onClose,
}: Readonly<{ classId: string | null; from: string; to: string; fallbackName?: string; onClose: () => void }>) {
  const isOpen = classId !== null;
  const opener = useRef<HTMLElement | null>(null);

  // Layout effects run before Radix's focus scope moves focus into the content.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const el = document.activeElement;
    opener.current = el instanceof HTMLElement && el !== document.body ? el : null;
  }, [isOpen]);

  return (
    <ResponsiveDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ResponsiveDialogContent
        className="sm:max-w-4xl max-h-[88dvh] overflow-y-auto bg-white-warm"
        onCloseAutoFocus={(e) => {
          const el = opener.current;
          opener.current = null;
          if (el?.isConnected) {
            e.preventDefault();
            el.focus();
          }
        }}
      >
        {/* key resets fetch state per class, so one class's numbers never flash under another's name */}
        {classId && <DetailBody key={classId} classId={classId} from={from} to={to} fallbackName={fallbackName} />}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
