import { memo, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarCheck, CheckCircle2, ChevronRight, Repeat, UserPlus, UserX, Users } from "lucide-react";
import { SortableHeader, useTableSort } from "@/components/admin/sortable-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { FilterDateRange } from "@/components/filters/FilterDateRange";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import { MetricCard } from "@/components/admin/MetricCard";
import { Pagination, usePagination } from "@/components/Pagination";
import { percentDelta, pointDelta } from "@/lib/classReport";
import { EXPIRY_WARNING_DAYS, memberRates, type MemberReport, type MemberRow } from "@/lib/memberReport";
import { fmtPct, fmtRange, percentLabel, plural, pointsLabel } from "@/components/admin/class-report/format";
import { isObj, useReport } from "@/components/admin/class-report/useClassReport";
import { useReportRange } from "@/components/admin/class-report/useReportRange";
import { MemberTrendChart } from "@/components/admin/member-report/MemberTrendChart";

/** Live pass counts (not tied to the date range); loaded by the dashboard page. */
export interface MemberStats {
  expiring7Days: number;
  expiring15Days: number;
  expiring30Days: number;
  studioPassActive: number;
  classPassActive: number;
  [key: string]: unknown;
}

// Only what the tab dereferences unguarded.
function isMemberReport(b: unknown): b is MemberReport {
  return (
    isObj(b) &&
    isObj(b.range) &&
    isObj(b.current) &&
    isObj(b.previous) &&
    isObj(b.retention) &&
    Array.isArray(b.trend) &&
    Array.isArray(b.members) &&
    Array.isArray(b.atRisk)
  );
}

const AT_RISK_PREVIEW = 6;
const CARD = "border-sage/20 bg-white-warm shadow-none";
const FLAT = "shadow-none";
const TITLE = "font-body font-semibold text-xl text-charcoal";
const DESC = "font-body text-charcoal/70";
const HEAD = "px-4 text-[11px] font-semibold tracking-wider text-muted-foreground";
const HEAD_NUM = `${HEAD} text-right`;
const NUM = "font-body text-sm tabular-nums text-right";
const MEMBER_LINK =
  "rounded-sm font-medium text-charcoal underline decoration-sage/50 underline-offset-4 hover:decoration-sage focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage";
const memberHref = (userId: string) => `/admin/members/${encodeURIComponent(userId)}`;
const lastVisitFmt = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });

type SortKey = "name" | "attended" | "bookings" | "attendance" | "noShows" | "cancelled" | "lastVisit";

function MemberTable({ members }: Readonly<{ members: MemberRow[] }>) {
  const [search, setSearch] = useState("");
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members
      .filter((m) => !q || m.name.toLowerCase().includes(q))
      .map((m) => ({ ...m, attendance: memberRates({ ...m, active: 1 }).attendance }));
  }, [members, search]);
  type Row = (typeof rows)[number];

  const getValue = useCallback((row: Row, key: SortKey): number | string | null => row[key], []);
  const { sorted, sortKey, sortDir, toggle } = useTableSort(rows, {
    initialKey: "attended",
    initialDir: "desc",
    getValue,
    defaultDirFor: (k) => (k === "name" ? "asc" : "desc"),
  });
  const pg = usePagination(sorted, 10, `${sortKey}|${sortDir}|${search}`);
  const head = (key: SortKey, label: string, num = true) => (
    <SortableHeader className={num ? HEAD_NUM : HEAD} sortKey={key} active={sortKey} dir={sortDir} onToggle={toggle}>
      {label}
    </SortableHeader>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-body text-sm text-charcoal/70 tabular-nums">{plural(rows.length, "member")} with a booking in this range</p>
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name"
          aria-label="Search members by name"
          className="w-full sm:w-[220px] font-body"
        />
      </div>
      <ResponsiveTable stack>
        <Table>
          <TableHeader>
            <TableRow>
              {head("name", "Member", false)}
              {head("attended", "Visits")}
              {head("bookings", "Booked")}
              {head("attendance", "Attendance")}
              {head("noShows", "No-shows")}
              {head("cancelled", "Cancelled")}
              {head("lastVisit", "Last visit")}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pg.pageItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="font-body text-sm text-charcoal/70 text-center py-8">
                  {search ? "No member matches that name." : "No member booked a class in this range."}
                </TableCell>
              </TableRow>
            )}
            {pg.pageItems.map((m) => (
              <TableRow key={m.userId}>
                <TableCell className="font-body">
                  <Link href={memberHref(m.userId)} className={MEMBER_LINK}>{m.name}</Link>
                </TableCell>
                <TableCell className={NUM}>{m.attended}</TableCell>
                <TableCell className={NUM}>{m.bookings}</TableCell>
                <TableCell className={NUM}>{fmtPct(m.attendance)}</TableCell>
                <TableCell className={NUM}>{m.noShows}</TableCell>
                <TableCell className={NUM}>{m.cancelled}</TableCell>
                <TableCell className={`${NUM} whitespace-nowrap`}>
                  {m.lastVisit ? lastVisitFmt.format(new Date(m.lastVisit)) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ResponsiveTable>
      <Pagination page={pg.page} total={pg.total} onChange={pg.setPage} />
    </div>
  );
}

function PassCount({ label, value }: Readonly<{ label: string; value: number }>) {
  return (
    <div className="rounded-lg border border-sage/15 px-4 py-3">
      <dt className="font-body text-xs text-charcoal/70">{label}</dt>
      <dd className="font-body text-2xl font-semibold tabular-nums text-charcoal">{value}</dd>
    </div>
  );
}

function MembersTabImpl({ memberStats }: Readonly<{ memberStats: MemberStats }>) {
  const { picked, onRangeChange, from, to, isDefault } = useReportRange();
  const { data, error, loading, retry } = useReport("member-report", isMemberReport, from, to);
  const [showAllRisk, setShowAllRisk] = useState(false);

  const firstLoad = loading && !data;
  const dim = `transition-opacity duration-200 motion-reduce:transition-none ${loading && data ? "opacity-60" : ""}`;
  const cur = data?.current;
  const prev = data?.previous;
  const c = cur ? memberRates(cur) : null;
  const p = prev ? memberRates(prev) : null;
  const rate = (v: number | null | undefined) => (v == null ? { value: "—" } : { value: Math.round(v), suffix: "%" });
  const retention = data && data.retention.base > 0 ? Math.round((data.retention.returned / data.retention.base) * 100) : null;
  const visitsDelta =
    c?.visitsPerActive != null && p?.visitsPerActive != null ? percentDelta(c.visitsPerActive * 10, p.visitsPerActive * 10) : null;
  const atRisk = data?.atRisk ?? [];
  const shownRisk = showAllRisk ? atRisk : atRisk.slice(0, AT_RISK_PREVIEW);
  const isEmpty = !!cur && cur.bookings === 0 && cur.cancelled === 0 && cur.newMembers === 0;

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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {/* Full row on phones: five cards in two columns would strand one, and this is the number the tab leads with. */}
            <MetricCard
              label="Active members"
              value={cur?.active ?? 0}
              icon={Users}
              tone="sage"
              loading={firstLoad}
              className={`${FLAT} col-span-2 md:col-span-1`}
              hint={percentLabel(cur && prev ? percentDelta(cur.active, prev.active) : null)}
              description="Members who attended at least one class in the selected range."
            />
            <MetricCard
              label="New members"
              value={cur?.newMembers ?? 0}
              icon={UserPlus}
              tone="sage"
              loading={firstLoad}
              className={FLAT}
              hint={percentLabel(cur && prev ? percentDelta(cur.newMembers, prev.newMembers) : null)}
              description="Member accounts created in the selected range."
            />
            <MetricCard
              label="Visits per member"
              value={c?.visitsPerActive ?? "—"}
              decimals={1}
              icon={CalendarCheck}
              tone="sage"
              loading={firstLoad}
              className={FLAT}
              hint={percentLabel(visitsDelta)}
              description="Classes attended, divided by active members."
            />
            <MetricCard
              label="Attendance rate"
              {...rate(c?.attendance)}
              icon={CheckCircle2}
              tone="sage"
              loading={firstLoad}
              className={FLAT}
              hint={pointsLabel(pointDelta(c?.attendance ?? null, p?.attendance ?? null))}
              description="Share of confirmed bookings that checked in, for classes that have already ended."
            />
            <MetricCard
              label="No-show rate"
              {...rate(c?.noShowRate)}
              icon={UserX}
              tone="terracotta"
              loading={firstLoad}
              className={FLAT}
              hint={pointsLabel(pointDelta(c?.noShowRate ?? null, p?.noShowRate ?? null))}
              description="Share of confirmed bookings marked no-show, for classes that have ended."
            />
          </div>
        )}

        {firstLoad && <Skeleton className="h-[420px] w-full rounded-xl bg-sage/10" />}

        {isEmpty && (
          <Card className={CARD}>
            <CardContent className="py-16 text-center">
              <p className="font-body text-base text-charcoal">No member activity in this range.</p>
              <p className="font-body text-sm text-charcoal/70 mt-1">Pick a wider range to see how members are doing.</p>
            </CardContent>
          </Card>
        )}

        {data && !isEmpty && (
          <>
            <p className="flex items-start gap-2 font-body text-sm text-charcoal">
              <Repeat className="mt-0.5 h-4 w-4 shrink-0 text-sage" aria-hidden />
              {retention === null
                ? "No one attended in the previous period, so there is no return rate to show."
                : `${data.retention.returned} of the ${plural(data.retention.base, "member")} who attended in the previous period came back (${retention}%).`}
            </p>

            <div className={atRisk.length > 0 ? "grid gap-6 xl:grid-cols-3" : undefined}>
              <Card className={`${CARD} min-w-0 xl:col-span-2`}>
                <CardHeader>
                  <CardTitle role="heading" aria-level={2} className={TITLE}>Trend</CardTitle>
                  <CardDescription className={DESC}>
                    Members attending and new accounts, {data.range.bucket === "week" ? "week by week" : "day by day"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <MemberTrendChart trend={data.trend} bucket={data.range.bucket} from={data.range.from} to={data.range.to} />
                </CardContent>
              </Card>

              {atRisk.length > 0 && (
                <Card className="min-w-0 border-terracotta/25 bg-terracotta/5 shadow-none">
                  <CardHeader>
                    <CardTitle role="heading" aria-level={2} className={`${TITLE} flex items-center gap-2`}>
                      <AlertTriangle className="h-5 w-5 text-terracotta" aria-hidden />
                      At risk
                    </CardTitle>
                    <CardDescription className={DESC}>
                      {plural(atRisk.length, "member")} who stopped coming, or whose pass ends within {EXPIRY_WARNING_DAYS} days
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                      {shownRisk.map((m) => (
                        <li key={m.userId}>
                          <Link
                            href={memberHref(m.userId)}
                            className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md border border-terracotta/25 bg-white-warm px-3 py-2 font-body text-sm text-charcoal transition-colors duration-150 hover:border-terracotta/60 active:bg-terracotta/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage"
                          >
                            <span className="min-w-0 space-y-1">
                              <span className="block font-medium">{m.name}</span>
                              <span className="flex flex-wrap gap-1">
                                {m.reasons.map((r) => (
                                  <Pill key={r} tone="warning" noIcon className="font-body tabular-nums">{r}</Pill>
                                ))}
                              </span>
                            </span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-charcoal/50" aria-hidden />
                          </Link>
                        </li>
                      ))}
                    </ul>
                    {atRisk.length > AT_RISK_PREVIEW && (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-expanded={showAllRisk}
                        onClick={() => setShowAllRisk((v) => !v)}
                        className="font-body mt-3 text-charcoal hover:bg-terracotta/10 hover:text-charcoal"
                      >
                        {showAllRisk ? "Show fewer" : `Show all ${atRisk.length}`}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Under md the table becomes a stack of cards, so this card drops its own frame to avoid cards inside a card. */}
            <Card className={`${CARD} max-md:border-0 max-md:bg-transparent`}>
              <CardHeader className="max-md:px-0">
                <CardTitle role="heading" aria-level={2} className={TITLE}>Members</CardTitle>
                <CardDescription className={DESC}>Select a member to open their profile</CardDescription>
              </CardHeader>
              <CardContent className="max-md:px-0 max-md:pb-0">
                <MemberTable members={data.members} />
              </CardContent>
            </Card>
          </>
        )}

        <Card className={CARD}>
          <CardHeader>
            <CardTitle role="heading" aria-level={2} className={TITLE}>Passes right now</CardTitle>
            <CardDescription className={DESC}>Live counts, not affected by the date range</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <PassCount label="Studio pass holders" value={memberStats.studioPassActive} />
              <PassCount label="Class pass holders" value={memberStats.classPassActive} />
              <PassCount label="Ending within 7 days" value={memberStats.expiring7Days} />
              <PassCount label="Ending within 15 days" value={memberStats.expiring15Days} />
              <PassCount label="Ending within 30 days" value={memberStats.expiring30Days} />
            </dl>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export const MembersTab = memo(MembersTabImpl);
