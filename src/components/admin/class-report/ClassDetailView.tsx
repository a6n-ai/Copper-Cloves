import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, usePagination } from "@/components/Pagination";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import { disciplineLabel, emptyTotals, rates, UNASSIGNED_INSTRUCTOR, type SessionEntry } from "@/lib/classReport";
import { ClassHeatmap } from "./ClassHeatmap";
import { ClassReportKpis } from "./ClassReportKpis";
import { ClassTrendChart } from "./ClassTrendChart";
import { fmtPct, fmtRange, REPORT_KINDS, type ReportKind } from "./format";
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

const CARD = "border-sage/20 bg-white-warm shadow-none";
// Under md a table becomes a stack of cards, so its card drops its own frame to avoid cards inside a card.
const TABLE_CARD = `${CARD} max-md:border-0 max-md:bg-transparent`;
const TITLE = "font-body font-semibold text-xl text-charcoal";
const NUM = "font-body text-sm tabular-nums text-right";
const EMPTY_ROW = "font-body text-sm text-charcoal/70 text-center py-6";

/** One class's report, or one instructor's: `id` is read as whichever `kind` says. */
export function ClassDetailView({
  kind,
  id,
  from,
  to,
  fallbackName,
  onBack,
}: Readonly<{ kind: ReportKind; id: string; from: string; to: string; fallbackName?: string; onBack: () => void }>) {
  const { one, many, idParam } = REPORT_KINDS[kind];
  const byClass = kind === "class";
  const { data, error, loading, retry } = useClassReport(from, to, `${idParam}=${encodeURIComponent(id)}`);
  const cls = byClass ? data?.classes[0] : undefined;
  // A class splits by who taught it; an instructor splits by what they taught.
  const split = byClass
    ? (data?.instructors ?? []).map((i) => ({ key: i.instructorId ?? UNASSIGNED_INSTRUCTOR, name: i.name, totals: i.totals }))
    : (data?.classes ?? []).filter((c) => c.current.sessions > 0).map((c) => ({ key: c.classId, name: c.name, totals: c.current }));
  const splitNoun = byClass ? "instructor" : "class";
  const sessions = usePagination(data?.sessions ?? NO_SESSIONS, 10);
  const name = cls?.name ?? fallbackName ?? (byClass ? undefined : data?.sessions?.[0]?.instructorName);
  const heading = useRef<HTMLHeadingElement>(null);

  // The list above is long; without this the report opens scrolled to wherever the class was picked.
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    heading.current?.parentElement?.parentElement?.scrollIntoView({ block: "start", behavior: "instant" });
  }, []);

  return (
    <>
      <div className="scroll-mt-24 space-y-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="font-body -ml-2 text-charcoal hover:bg-sage/10 hover:text-charcoal">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All {many}
        </Button>
        <div>
          <h2 ref={heading} tabIndex={-1} className="font-body text-2xl font-semibold text-charcoal focus-visible:outline-none">
            {name ?? (loading ? `Loading ${one}…` : `${byClass ? "Class" : "Instructor"} report`)}
          </h2>
          <p className="font-body text-sm text-charcoal/70 tabular-nums">
            {cls ? `${disciplineLabel(cls.category)} · ${fmtRange(from, to)}` : fmtRange(from, to)}
          </p>
        </div>
      </div>

      {error && (
        <div className="flex flex-col gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-5 sm:flex-row sm:items-center sm:justify-between">
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

        {loading && !data && !error && <Skeleton className="h-[460px] w-full rounded-xl bg-sage/10" />}

        {data && data.current.sessions === 0 && (
          <p className="font-body text-sm text-charcoal/70 py-8 text-center">This {one} had no sessions in this range.</p>
        )}

        {data && data.current.sessions > 0 && (
          <>
            <Card className={`${CARD} min-w-0`}>
              <CardHeader>
                <CardTitle role="heading" aria-level={3} className={TITLE}>Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ClassTrendChart trend={data.trend} bucket={data.range.bucket} from={data.range.from} to={data.range.to} />
              </CardContent>
            </Card>

            <Card className={`${CARD} min-w-0`}>
              <CardHeader>
                <CardTitle role="heading" aria-level={3} className={TITLE}>By weekday and start time</CardTitle>
              </CardHeader>
              <CardContent>
                <ClassHeatmap heatmap={data.heatmap} />
              </CardContent>
            </Card>

            <Card className={`${TABLE_CARD} min-w-0`}>
              <CardHeader className="max-md:px-0">
                <CardTitle role="heading" aria-level={3} className={TITLE}>By {splitNoun}</CardTitle>
              </CardHeader>
              <CardContent className="max-md:px-0 max-md:pb-0">
                <ResponsiveTable stack>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="capitalize">{splitNoun}</TableHead>
                        <TableHead className="text-right">Sessions</TableHead>
                        <TableHead className="text-right">Signups</TableHead>
                        <TableHead className="text-right">Utilization</TableHead>
                        <TableHead className="text-right">Attendance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {split.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className={EMPTY_ROW}>No {splitNoun} is recorded for these sessions.</TableCell>
                        </TableRow>
                      )}
                      {split.map((i) => {
                        const r = rates(i.totals);
                        return (
                          <TableRow key={i.key}>
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
              </CardContent>
            </Card>

            <Card className={`${TABLE_CARD} min-w-0`}>
              <CardHeader className="max-md:px-0">
                <CardTitle role="heading" aria-level={3} className={TITLE}>Sessions</CardTitle>
              </CardHeader>
              <CardContent className="max-md:px-0 max-md:pb-0">
                <ResponsiveTable stack>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>When</TableHead>
                        <TableHead className="capitalize">{splitNoun}</TableHead>
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
                          <TableCell className="font-body text-sm">{byClass ? s.instructorName : s.className}</TableCell>
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
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </>
  );
}
