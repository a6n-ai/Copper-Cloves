import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, startOfDay, subDays } from "date-fns";
import type { DateRange } from "react-day-picker";
import { AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { FilterDateRange } from "@/components/filters/FilterDateRange";
import { ATTENTION, attentionReason, disciplineLabel, emptyTotals, rates, UNASSIGNED_INSTRUCTOR } from "@/lib/classReport";
import { ClassDetailView } from "@/components/admin/class-report/ClassDetailView";
import { ClassHeatmap } from "@/components/admin/class-report/ClassHeatmap";
import { ClassReportKpis } from "@/components/admin/class-report/ClassReportKpis";
import { ALL_DISCIPLINES, ClassReportTable } from "@/components/admin/class-report/ClassReportTable";
import { ClassTrendChart } from "@/components/admin/class-report/ClassTrendChart";
import { fmtRange, plural, REPORT_KINDS, type ReportKind } from "@/components/admin/class-report/format";
import { useClassReport } from "@/components/admin/class-report/useClassReport";

const EMPTY = emptyTotals();
const DAY = "yyyy-MM-dd";
const RANGE_SETTLE_MS = 400;
const ATTENTION_PREVIEW = 6;
const ATTENTION_RULE = `under ${ATTENTION.lowUtilization}% full or down ${ATTENTION.dropPoints}+ points on the previous period`;

const CARD = "border-sage/20 bg-white-warm shadow-none";
const TITLE = "font-body font-semibold text-xl text-charcoal";
const DESC = "font-body text-charcoal/70";

function defaultRange(): DateRange {
  const today = startOfDay(new Date());
  return { from: subDays(today, 29), to: today };
}

function sameDay(a: Date | undefined, b: Date | undefined): boolean {
  return !!a && !!b && format(a, DAY) === format(b, DAY);
}

function ReportTabImpl({ kind }: Readonly<{ kind: ReportKind }>) {
  const { one, many, title, listQuery } = REPORT_KINDS[kind];
  // The picker reports a complete one-day range on the first click, so `picked`
  // (drives the filter button) updates at once while `applied` (drives the fetch)
  // only follows after the selection has been stable for RANGE_SETTLE_MS.
  const [picked, setPicked] = useState<DateRange | undefined>(defaultRange);
  const [applied, setApplied] = useState<DateRange>(defaultRange);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [showAllAttention, setShowAllAttention] = useState(false);
  const [pickedDiscipline, setPickedDiscipline] = useState(ALL_DISCIPLINES);

  useEffect(() => {
    if (!picked?.from || !picked.to) return;
    const { from: f, to: t } = picked;
    const timer = setTimeout(() => setApplied({ from: f, to: t }), RANGE_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [picked]);

  const from = format(applied.from as Date, DAY);
  const to = format(applied.to as Date, DAY);
  const { data, error, loading, retry } = useClassReport(from, to, listQuery);

  const onRangeChange = (next: DateRange | undefined) => {
    if (!next?.from) {
      const reset = defaultRange();
      setPicked(reset);
      setApplied(reset);
      return;
    }
    setPicked(next);
  };
  // The overview stays mounted (hidden) under a class report, so going back lands on the
  // control that opened it, at the same scroll position.
  const opener = useRef<{ el: HTMLElement | null; scrollY: number } | null>(null);
  const openDetail = useCallback((classId: string) => {
    const el = document.activeElement;
    opener.current = { el: el instanceof HTMLElement && el !== document.body ? el : null, scrollY: window.scrollY };
    setSelectedClassId(classId);
  }, []);
  const closeDetail = useCallback(() => setSelectedClassId(null), []);
  useEffect(() => {
    const from = opener.current;
    if (selectedClassId !== null || !from) return;
    opener.current = null;
    from.el?.focus({ preventScroll: true });
    window.scrollTo({ top: from.scrollY, behavior: "instant" });
  }, [selectedClassId]);

  const disciplines = useMemo(
    () => [...new Set((data?.classes ?? []).filter((c) => c.current.sessions > 0).map((c) => c.category))].sort(),
    [data],
  );
  // A new date range can drop the chosen discipline; fall back rather than strand an empty table.
  // With one discipline the select is hidden, so a stale choice must not leak into headings.
  const discipline = disciplines.length > 1 && disciplines.includes(pickedDiscipline) ? pickedDiscipline : ALL_DISCIPLINES;
  const onDisciplineChange = useCallback((next: string) => {
    setPickedDiscipline(next);
    setShowAllAttention(false);
  }, []);

  // Emptiest first: the class with the most unsold seats is the one to act on.
  const flagged = useMemo(
    () =>
      (data?.classes ?? [])
        .flatMap((c) => {
          // Sessions nobody is recorded against are a data gap, not an instructor to follow up with.
          if (kind === "instructor" && c.classId === UNASSIGNED_INSTRUCTOR) return [];
          const reason = attentionReason(c.current, c.previous);
          return reason
            ? [{ classId: c.classId, name: c.name, category: c.category, reason, utilization: rates(c.current).utilization ?? 0 }]
            : [];
        })
        .sort((a, b) => a.utilization - b.utilization),
    [data, kind],
  );
  const attention = useMemo(
    () => (discipline === ALL_DISCIPLINES ? flagged : flagged.filter((c) => c.category === discipline)),
    [flagged, discipline],
  );
  const otherFlagged = flagged.length - attention.length;
  const inDiscipline = discipline === ALL_DISCIPLINES ? "" : ` in ${disciplineLabel(discipline)}`;
  const shownAttention = showAllAttention ? attention : attention.slice(0, ATTENTION_PREVIEW);

  // At the default the filter gets no value, so it reads "Last 30 days" and offers no
  // clear control: clearing a range that is already the default would do nothing.
  const base = defaultRange();
  const isDefault = sameDay(picked?.from, base.from) && sameDay(picked?.to, base.to);

  const firstLoad = loading && !data;
  const refreshing = loading && !!data;
  const isEmpty = !!data && data.current.sessions === 0;
  const dim = `transition-opacity duration-200 motion-reduce:transition-none ${refreshing ? "opacity-60" : ""}`;

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <FilterDateRange
          value={isDefault ? undefined : picked}
          onChange={onRangeChange}
          placeholder="Last 30 days"
          allTimeLabel="Reset to 30 days"
          className="w-full sm:w-[260px] text-charcoal"
        />
        {data && (
          <p className={`font-body text-xs text-charcoal/70 tabular-nums ${dim}`}>
            Showing {fmtRange(data.range.from, data.range.to)}, compared with{" "}
            {fmtRange(data.range.prevFrom, data.range.prevTo)}
          </p>
        )}
      </div>

      {selectedClassId && (
        // key resets fetch state per class, so one class's numbers never flash under another's name
        <ClassDetailView
          key={selectedClassId}
          kind={kind}
          id={selectedClassId}
          from={from}
          to={to}
          fallbackName={data?.classes.find((c) => c.classId === selectedClassId)?.name}
          onBack={closeDetail}
        />
      )}

      <div className="space-y-6" hidden={selectedClassId !== null}>
        {error && (
          <Card className="border-destructive/40 bg-destructive/10 shadow-none">
            <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div role="alert" className="space-y-1">
                <p className="font-body text-sm font-medium text-charcoal">{error}</p>
                {data && (
                  <p className="font-body text-xs text-charcoal/75 tabular-nums">
                    Still showing {fmtRange(data.range.from, data.range.to)}, the last range that loaded.
                  </p>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={retry} disabled={loading} className="font-body w-full sm:w-auto">
                Try again
              </Button>
            </CardContent>
          </Card>
        )}

        <div className={`space-y-6 ${dim}`} aria-busy={loading}>
          {(data || !error) && (
            <ClassReportKpis current={data?.current ?? EMPTY} previous={data?.previous ?? EMPTY} loading={firstLoad} />
          )}

          {firstLoad && <Skeleton className="h-[460px] w-full rounded-xl bg-sage/10" />}

          {isEmpty ? (
            <Card className={CARD}>
              <CardContent className="py-16 text-center">
                <p className="font-body text-base text-charcoal">No classes ran in this range.</p>
                <p className="font-body text-sm text-charcoal/70 mt-1">Pick a wider range to see how {many} are doing.</p>
                {!isDefault && (
                  <Button variant="outline" size="sm" onClick={() => onRangeChange(undefined)} className="font-body mt-4">
                    Back to the last 30 days
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            data && (
              <>
                <div className={attention.length > 0 ? "grid gap-6 xl:grid-cols-3" : undefined}>
                  <Card className={`${CARD} min-w-0 xl:col-span-2`}>
                    <CardHeader>
                      <CardTitle role="heading" aria-level={2} className={TITLE}>Trend</CardTitle>
                      <CardDescription className={DESC}>
                        Signups, utilization and attendance, {data.range.bucket === "week" ? "week by week" : "day by day"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ClassTrendChart trend={data.trend} bucket={data.range.bucket} from={data.range.from} to={data.range.to} />
                    </CardContent>
                  </Card>

                  {attention.length > 0 && (
                    <Card className="min-w-0 border-terracotta/25 bg-terracotta/5 shadow-none">
                      <CardHeader>
                        <CardTitle role="heading" aria-level={2} className={`${TITLE} flex items-center gap-2`}>
                          <AlertTriangle className="h-5 w-5 text-terracotta" aria-hidden />
                          Needs attention
                        </CardTitle>
                        <CardDescription className={DESC}>
                          {plural(attention.length, one, many)}{inDiscipline} with {ATTENTION.minSessions}+ sessions{" "}
                          {ATTENTION_RULE}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                          {shownAttention.map((c) => (
                            <li key={c.classId}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.currentTarget.focus(); // Safari does not focus buttons on click; going back restores focus here
                                  openDetail(c.classId);
                                }}
                                className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md border border-terracotta/25 bg-white-warm px-3 py-2 text-left font-body text-sm text-charcoal transition-colors duration-150 hover:border-terracotta/60 active:bg-terracotta/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage"
                              >
                                <span className="min-w-0 font-medium">{c.name}</span>
                                <span className="flex shrink-0 items-center gap-1">
                                  <Pill tone="warning" noIcon className="font-body tabular-nums">{c.reason}</Pill>
                                  <ChevronRight className="h-4 w-4 text-charcoal/50" aria-hidden />
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                        {attention.length > ATTENTION_PREVIEW && (
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-expanded={showAllAttention}
                            onClick={() => setShowAllAttention((v) => !v)}
                            className="font-body mt-3 text-charcoal hover:bg-terracotta/10 hover:text-charcoal"
                          >
                            {showAllAttention ? "Show fewer" : `Show all ${attention.length}`}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>

                {attention.length === 0 && (
                  <p className="flex items-start gap-2 font-body text-sm text-charcoal/75">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sage" aria-hidden />
                    {otherFlagged > 0
                      ? `No class${inDiscipline} needs attention. ${plural(otherFlagged, "class", "classes")} in other disciplines ${otherFlagged === 1 ? "does" : "do"}: choose All disciplines to see ${otherFlagged === 1 ? "it" : "them"}.`
                      : `Nothing needs attention: no ${one} with ${ATTENTION.minSessions}+ sessions is ${ATTENTION_RULE}.`}
                  </p>
                )}

                {/* Under md the table becomes a stack of cards, so this card drops its own frame to avoid cards inside a card. */}
                <Card className={`${CARD} max-md:border-0 max-md:bg-transparent`}>
                  <CardHeader className="max-md:px-0">
                    <CardTitle role="heading" aria-level={2} className={TITLE}>{title}</CardTitle>
                    <CardDescription className={DESC}>Select {kind === "class" ? "a class to see its" : "an instructor to see their"} own report</CardDescription>
                  </CardHeader>
                  <CardContent className="max-md:px-0 max-md:pb-0">
                    <ClassReportTable
                      kind={kind}
                      classes={data.classes}
                      disciplines={disciplines}
                      discipline={discipline}
                      onDisciplineChange={onDisciplineChange}
                      onSelect={openDetail}
                    />
                  </CardContent>
                </Card>

                <Card className={CARD}>
                  <CardHeader>
                    <CardTitle role="heading" aria-level={2} className={TITLE}>Busiest times</CardTitle>
                    <CardDescription className={DESC}>
                      How full classes run by weekday and start time (IST)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ClassHeatmap heatmap={data.heatmap} />
                  </CardContent>
                </Card>
              </>
            )
          )}
        </div>
      </div>
    </>
  );
}

export const ReportTab = memo(ReportTabImpl);
