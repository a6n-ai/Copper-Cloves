import { Fragment, useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pill } from "@/components/ui/pill";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import {
  currentMonthPeriod,
  resolvePayoutPeriod,
  payoutPeriodToQuery,
  type PayoutPeriod,
} from "@/lib/payoutCalc";
import { PayoutPeriodPicker } from "@/components/admin/PayoutPeriodPicker";
import { downloadInstructorPayoutExcel, type PayoutDetail } from "@/lib/instructorPayoutExport";

// ── money helpers ─────────────────────────────────────────────────────────────
const r = (paise: number) =>
  "₹" + (paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });

const toRupeesStr = (paise: number | null | undefined): string =>
  paise == null ? "" : String(paise / 100);

const toInt = (rupeesStr: string): number | null => {
  const v = parseFloat(rupeesStr.trim());
  if (!Number.isFinite(v)) return null;
  return Math.round(v * 100);
};

// ── API shape ─────────────────────────────────────────────────────────────────
type RateOverride = {
  rate_12_paise: number | null;
  rate_8_paise: number | null;
  rate_4_paise: number | null;
  rate_1_paise: number | null;
};

type LineItem = {
  scheduleId: string;
  date: string;
  startTime: string;
  endTime: string;
  className: string;
  member: string;
  membershipType: string;
  count: number;
  checkedIn: boolean;
  isPlaceholder: boolean;
};

type DetailResponse = {
  instructor: {
    id: string;
    name: string;
    imageUrl: string | null;
    specialties: string[];
    studioCutPercent: number;
    rateOverride: RateOverride;
  };
  granularity: string;
  key: string;
  label: string;
  periodStart: string;
  periodEnd: string;
  lineItems: LineItem[];
  footer: {
    gstPercent: number;
    instructorPct: number;
    rateCard: { rate12: number; rate8: number; rate4: number; rate1: number };
    netBreakdown: { net12: number; net8: number; net4: number; net1: number };
    averageNetPaise: number;
    autoBlendedRatePaise: number;
    overrideBlendedRatePaise: number | null;
    blendedRatePaise: number;
    payableUnits: number;
    computedPayableUnits: number;
    extraPayableUnits: number;
    totalPaise: number;
    overridePayoutPaise: number | null;
    status: "paid" | "pending";
    paidAt: string | null;
  };
};

// ── grouped class type ────────────────────────────────────────────────────────
type Group = {
  scheduleId: string;
  className: string;
  date: string;
  startTime: string;
  endTime: string;
  members: LineItem[];
  units: number;
  attendees: number;
  checkIns: number;
  lineTotalPaise: number;
};

type SortKey = "className" | "date" | "units" | "lineTotalPaise";
type SortDir = "asc" | "desc";

function buildGroups(lineItems: LineItem[], blendedRatePaise: number): Group[] {
  const order: string[] = [];
  const map = new Map<string, Group>();
  for (const item of lineItems) {
    if (!map.has(item.scheduleId)) {
      order.push(item.scheduleId);
      map.set(item.scheduleId, {
        scheduleId: item.scheduleId,
        className: item.className,
        date: item.date,
        startTime: item.startTime,
        endTime: item.endTime,
        members: [],
        units: 0,
        attendees: 0,
        checkIns: 0,
        lineTotalPaise: 0,
      });
    }
    const g = map.get(item.scheduleId);
    g.members.push(item);
    g.units += item.count;
    if (!item.isPlaceholder) g.attendees += 1;
    if (item.checkedIn) g.checkIns += 1;
  }
  const groups = order.map((id) => map.get(id) as Group);
  for (const g of groups) {
    g.lineTotalPaise = g.units * blendedRatePaise;
  }
  return groups;
}

function sortGroups(groups: Group[], key: SortKey, dir: SortDir): Group[] {
  return [...groups].sort((a, b) => {
    let cmp = 0;
    if (key === "className") cmp = a.className.localeCompare(b.className);
    else if (key === "date") cmp = a.date.localeCompare(b.date);
    else if (key === "units") cmp = a.units - b.units;
    else if (key === "lineTotalPaise") cmp = a.lineTotalPaise - b.lineTotalPaise;
    return dir === "asc" ? cmp : -cmp;
  });
}

// ── small sub-components ──────────────────────────────────────────────────────
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 font-body text-sm">
      <span className="text-charcoal/60">{label}</span>
      <span className="tabular-nums text-charcoal font-medium">{value}</span>
    </div>
  );
}

function AnalyticsCard({
  label,
  value,
  sub,
  pill,
}: {
  label: string;
  value: string;
  sub?: string;
  pill?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-white-warm p-3 space-y-0.5">
      <p className="font-body text-xs text-charcoal/50">{label}</p>
      <p className="font-body text-lg font-semibold text-charcoal tabular-nums leading-tight">{value}</p>
      {sub && <p className="font-body text-xs text-charcoal/50">{sub}</p>}
      {pill && <div className="pt-1">{pill}</div>}
    </div>
  );
}

function SortableHead({
  children,
  sortKey,
  currentKey,
  dir,
  onSort,
}: {
  children: React.ReactNode;
  sortKey: SortKey;
  currentKey: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const active = currentKey === sortKey;
  return (
    <TableHead
      className="font-body text-xs text-charcoal/60 uppercase tracking-wide cursor-pointer select-none hover:text-charcoal/80 whitespace-nowrap"
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {active ? (
          dir === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </span>
    </TableHead>
  );
}

function RateRow({
  label,
  rateCardPaise,
  numClasses,
  gstPercent,
  netPaise,
}: {
  label: string;
  rateCardPaise: number;
  numClasses: number;
  gstPercent: number;
  netPaise: number;
}) {
  const perClass = rateCardPaise / numClasses / 100;
  const withoutGst = perClass / (1 + gstPercent / 100);
  return (
    <TableRow>
      <TableCell className="font-body text-sm text-charcoal/80">{label}</TableCell>
      <TableCell className="font-body text-sm text-charcoal/80 tabular-nums text-right">
        {r(rateCardPaise)}
      </TableCell>
      <TableCell className="font-body text-sm text-charcoal/60 tabular-nums text-right">
        ₹{perClass.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
      </TableCell>
      <TableCell className="font-body text-sm text-charcoal/60 tabular-nums text-right">
        ₹{withoutGst.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
      </TableCell>
      <TableCell className="font-body text-sm font-medium text-charcoal tabular-nums text-right">
        {r(netPaise)}
      </TableCell>
    </TableRow>
  );
}

// ── main component ────────────────────────────────────────────────────────────
export function InstructorPayoutLedger({ instructorId }: { instructorId: string }) {
  const [period, setPeriod] = useState<PayoutPeriod>(() => currentMonthPeriod());
  const resolvedPeriod = resolvePayoutPeriod(period);
  // Writes: only a monthly period may be recorded (the adjustment API 400s otherwise).
  const canRecord =
    period.granularity === "month" && !!resolvedPeriod.start && resolvedPeriod.start <= new Date();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // blended rate override input (₹ string)
  const [blendedInput, setBlendedInput] = useState("");
  // per-instructor rate override inputs (₹ strings)
  const [rates, setRates] = useState({ r12: "", r8: "", r4: "", r1: "" });
  // collapse state for rate overrides card
  const [ratesOpen, setRatesOpen] = useState(false);

  // grouped table state
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const load = useCallback(async () => {
    if (!instructorId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/instructor-payout-detail?instructorId=${encodeURIComponent(instructorId)}&${payoutPeriodToQuery(period)}`,
      );
      if (!res.ok) {
        toast.error("Failed to load payout detail");
        return;
      }
      const d: DetailResponse = await res.json();
      setData(d);
      setBlendedInput(
        d.footer.overrideBlendedRatePaise != null
          ? toRupeesStr(d.footer.overrideBlendedRatePaise)
          : "",
      );
      setRates({
        r12: toRupeesStr(d.instructor.rateOverride.rate_12_paise),
        r8: toRupeesStr(d.instructor.rateOverride.rate_8_paise),
        r4: toRupeesStr(d.instructor.rateOverride.rate_4_paise),
        r1: toRupeesStr(d.instructor.rateOverride.rate_1_paise),
      });
    } catch {
      toast.error("Network error loading payout detail");
    } finally {
      setLoading(false);
    }
  }, [instructorId, period]);

  useEffect(() => {
    void load();
  }, [load, period]);

  function toggleExpand(scheduleId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(scheduleId)) next.delete(scheduleId);
      else next.add(scheduleId);
      return next;
    });
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  async function saveBlendedRate(raw: string = blendedInput) {
    if (!data) return;
    const trimmed = raw.trim();
    const override = trimmed === "" ? null : toInt(trimmed);
    if (trimmed !== "" && override === null) {
      toast.error("Enter a valid ₹ amount");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/instructor-payout-adjustment", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instructorId,
          granularity: "month",
          year: period.year,
          index: period.index,
          override_blended_rate_paise: override,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error ?? "Save failed");
        return;
      }
      toast.success(override == null ? "Blended rate override cleared" : "Blended rate saved");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function saveRates() {
    if (!data) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/instructors", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: instructorId,
          rate_12_paise: toInt(rates.r12),
          rate_8_paise: toInt(rates.r8),
          rate_4_paise: toInt(rates.r4),
          rate_1_paise: toInt(rates.r1),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error ?? "Save failed");
        return;
      }
      toast.success("Rate overrides saved");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function markPaid() {
    if (!data) return;
    const isPaid = data.footer.status === "paid";
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        instructorId,
        granularity: "month",
        year: period.year,
        index: period.index,
        paid: !isPaid,
      };
      if (!isPaid) {
        body.blended_rate_paise = data.footer.blendedRatePaise;
        body.payout_paise = data.footer.totalPaise;
      }
      const res = await fetch("/api/admin/instructor-payout-adjustment", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error ?? "Save failed");
        return;
      }
      toast.success(isPaid ? "Marked unpaid" : "Marked paid");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function downloadSheet() {
    // All-time can span years -> dozens of sheets; match the export dialog and forbid it here too.
    if (!data || period.granularity === "all") return;
    setDownloading(true);
    try {
      // The exporter reads lineItems/footer/instructor/key; DetailResponse supplies all four.
      await downloadInstructorPayoutExcel(
        [data as unknown as PayoutDetail],
        `payout-${data.instructor.name}-${resolvePayoutPeriod(period).key}`,
      );
    } finally {
      setDownloading(false);
    }
  }

  const isPaid = data?.footer.status === "paid";

  // ── derived analytics values ─────────────────────────────────────────────────
  const classesCount = data
    ? new Set(data.lineItems.map((l) => l.scheduleId)).size
    : 0;
  const attendees = data ? data.lineItems.filter((l) => !l.isPlaceholder).length : 0;
  const checkIns = data ? data.lineItems.filter((l) => l.checkedIn).length : 0;

  // ── derived groups ───────────────────────────────────────────────────────────
  const groups =
    data && data.lineItems.length > 0
      ? sortGroups(
          buildGroups(data.lineItems, data.footer.blendedRatePaise),
          sortKey,
          sortDir,
        )
      : [];

  return (
    <div className="space-y-5">
      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-3">
        <PayoutPeriodPicker value={period} onChange={setPeriod} className="w-44" />

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 border-sage/20 text-sage hover:bg-sage/5 hover:text-sage!"
          onClick={() => void downloadSheet()}
          disabled={!data || downloading || period.granularity === "all"}
        >
          {downloading ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <FileSpreadsheet className="h-4 w-4 mr-1.5" />
          )}
          Download sheet
        </Button>

        {/* Paid is truthful in any window: a row exists, so money moved. Pending is only truthful
            where a payment could be recorded — off-month the missing row means "unknown", not
            "unpaid", because nothing ever writes that period key. */}
        {data && isPaid && (
          <Pill tone="success">
            {`Paid${data.footer.paidAt ? " · " + format(new Date(data.footer.paidAt), "dd MMM yyyy") : ""}`}
          </Pill>
        )}
        {data && !isPaid && canRecord && <Pill tone="warning">Pending</Pill>}
        {data && !canRecord && (
          <span className="font-body text-xs text-charcoal/45">
            Switch to This Month to record payment
          </span>
        )}

        {loading && <Loader2 className="h-4 w-4 animate-spin text-charcoal/40" />}
      </div>

      {data && (
        <>
          {/* Analytics cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <AnalyticsCard
              label="Total payout"
              value={r(data.footer.totalPaise)}
              pill={
                isPaid ? (
                  <Pill tone="success">Paid</Pill>
                ) : canRecord ? (
                  <Pill tone="warning">Pending</Pill>
                ) : undefined
              }
            />
            <AnalyticsCard
              label="Classes & payable units"
              value={`${classesCount} classes`}
              sub={`${data.footer.payableUnits} payable units`}
            />
            <AnalyticsCard
              label="Attendees & check-ins"
              value={`${attendees} attendees`}
              sub={`${checkIns} checked in`}
            />
            <AnalyticsCard
              label="Blended rate & share"
              value={`${r(data.footer.blendedRatePaise)}/class`}
              sub={`${data.footer.instructorPct}% share`}
            />
          </div>

          {/* Grouped + expandable class table */}
          <div className="rounded-xl border border-border bg-white-warm overflow-hidden">
            <ResponsiveTable>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <SortableHead
                      sortKey="className"
                      currentKey={sortKey}
                      dir={sortDir}
                      onSort={handleSort}
                    >
                      Class
                    </SortableHead>
                    <SortableHead
                      sortKey="date"
                      currentKey={sortKey}
                      dir={sortDir}
                      onSort={handleSort}
                    >
                      Date
                    </SortableHead>
                    <TableHead className="font-body text-xs text-charcoal/60 uppercase tracking-wide whitespace-nowrap">
                      Time
                    </TableHead>
                    <TableHead className="font-body text-xs text-charcoal/60 uppercase tracking-wide">
                      Attendees
                    </TableHead>
                    <SortableHead
                      sortKey="units"
                      currentKey={sortKey}
                      dir={sortDir}
                      onSort={handleSort}
                    >
                      Units
                    </SortableHead>
                    <SortableHead
                      sortKey="lineTotalPaise"
                      currentKey={sortKey}
                      dir={sortDir}
                      onSort={handleSort}
                    >
                      <span className="ml-auto">Line ₹</span>
                    </SortableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-10 text-center font-body text-sm text-charcoal/40 italic"
                      >
                        No classes in this period.
                      </TableCell>
                    </TableRow>
                  ) : (
                    groups.map((g) => {
                      const isOpen = expanded.has(g.scheduleId);
                      return (
                        <Fragment key={g.scheduleId}>
                          {/* Group header row */}
                          <TableRow
                            className="cursor-pointer bg-muted/30 hover:bg-muted/50 transition-colors"
                            onClick={() => toggleExpand(g.scheduleId)}
                          >
                            <TableCell className="w-8 pr-0 text-charcoal/40">
                              {isOpen ? (
                                <ChevronDown className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5" />
                              )}
                            </TableCell>
                            <TableCell className="font-body text-sm text-charcoal font-medium">
                              {g.className}
                            </TableCell>
                            <TableCell className="font-body text-sm text-charcoal/70 tabular-nums whitespace-nowrap">
                              {format(new Date(g.date), "dd MMM")}
                            </TableCell>
                            <TableCell className="font-body text-sm text-charcoal/70 tabular-nums whitespace-nowrap">
                              {format(new Date(g.startTime), "HH:mm")}–{format(new Date(g.endTime), "HH:mm")}
                            </TableCell>
                            <TableCell className="font-body text-sm text-charcoal/70">
                              {g.attendees}
                            </TableCell>
                            <TableCell className="font-body text-sm text-charcoal/80 tabular-nums">
                              {g.units}
                            </TableCell>
                            <TableCell className="font-body text-sm text-charcoal font-medium tabular-nums text-right">
                              {r(g.lineTotalPaise)}
                            </TableCell>
                          </TableRow>

                          {/* Member sub-rows */}
                          {isOpen &&
                            g.members.map((m, i) => (
                              <TableRow
                                key={`${g.scheduleId}-${i}`}
                                className="bg-cream/20 border-t-0"
                              >
                                <TableCell />
                                <TableCell
                                  colSpan={2}
                                  className={`font-body text-sm pl-6 ${
                                    m.isPlaceholder
                                      ? "text-charcoal/35 italic"
                                      : "text-charcoal/80"
                                  }`}
                                >
                                  {m.isPlaceholder ? "No attendees" : m.member}
                                </TableCell>
                                <TableCell className="font-body text-xs text-charcoal/45">
                                  {m.isPlaceholder ? "—" : m.membershipType}
                                </TableCell>
                                <TableCell>
                                  {m.checkedIn && (
                                    <Pill tone="success" className="text-[10px] px-1.5 py-0">
                                      ✓
                                    </Pill>
                                  )}
                                </TableCell>
                                <TableCell className="font-body text-sm text-charcoal/70 tabular-nums text-right">
                                  {m.count}
                                </TableCell>
                                <TableCell />
                              </TableRow>
                            ))}
                        </Fragment>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </ResponsiveTable>
          </div>

          {/* Rate-card footer block */}
          <div className="rounded-xl border border-border bg-white-warm overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <h3 className="font-body font-semibold text-base text-charcoal">Rate card &amp; payout</h3>
            </div>
            <div className="p-5 space-y-5">
              {/* Rate-card table */}
              <ResponsiveTable>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-body text-xs text-charcoal/60 uppercase tracking-wide">Classes</TableHead>
                      <TableHead className="font-body text-xs text-charcoal/60 uppercase tracking-wide text-right">Rate (₹)</TableHead>
                      <TableHead className="font-body text-xs text-charcoal/60 uppercase tracking-wide text-right">Per-class</TableHead>
                      <TableHead className="font-body text-xs text-charcoal/60 uppercase tracking-wide text-right">Without GST</TableHead>
                      <TableHead className="font-body text-xs text-charcoal/60 uppercase tracking-wide text-right">
                        Net @ {data.footer.instructorPct}%
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <RateRow
                      label="12-class pack"
                      rateCardPaise={data.footer.rateCard.rate12}
                      numClasses={12}
                      gstPercent={data.footer.gstPercent}
                      netPaise={data.footer.netBreakdown.net12}
                    />
                    <RateRow
                      label="8-class pack"
                      rateCardPaise={data.footer.rateCard.rate8}
                      numClasses={8}
                      gstPercent={data.footer.gstPercent}
                      netPaise={data.footer.netBreakdown.net8}
                    />
                    <RateRow
                      label="4-class pack"
                      rateCardPaise={data.footer.rateCard.rate4}
                      numClasses={4}
                      gstPercent={data.footer.gstPercent}
                      netPaise={data.footer.netBreakdown.net4}
                    />
                    <RateRow
                      label="1-class (drop-in)"
                      rateCardPaise={data.footer.rateCard.rate1}
                      numClasses={1}
                      gstPercent={data.footer.gstPercent}
                      netPaise={data.footer.netBreakdown.net1}
                    />
                  </TableBody>
                </Table>
              </ResponsiveTable>

              {/* Summary lines */}
              <div className="rounded-lg border border-border bg-cream/30 px-4 py-2 divide-y divide-border">
                <Metric label="Average net rate" value={r(data.footer.averageNetPaise)} />

                {/* Blended rate editable row */}
                <div className="flex flex-wrap items-center gap-3 py-2">
                  <span className="font-body text-sm text-charcoal/60 shrink-0">
                    Weighted / blended rate
                  </span>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Input
                      type="number"
                      step="0.01"
                      value={blendedInput}
                      onChange={(e) => setBlendedInput(e.target.value)}
                      placeholder={r(data.footer.autoBlendedRatePaise)}
                      disabled={isPaid || saving || !canRecord}
                      className="w-36 border-border font-body text-sm h-8"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isPaid || saving || !canRecord}
                      onClick={() => void saveBlendedRate()}
                      className="h-8 border-sage/30 text-sage hover:bg-sage/5 font-body text-xs"
                    >
                      Save rate
                    </Button>
                    {blendedInput.trim() !== "" && (
                      <button
                        type="button"
                        className="font-body text-xs text-charcoal/40 hover:text-terracotta underline"
                        disabled={isPaid || saving || !canRecord}
                        onClick={() => { setBlendedInput(""); void saveBlendedRate(""); }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <Metric
                  label="Payable units (count)"
                  value={String(data.footer.payableUnits)}
                />
                <div className="flex items-center justify-between py-2">
                  <span className="font-body font-semibold text-lg text-charcoal">Total</span>
                  <span className="font-body font-semibold text-2xl text-charcoal tabular-nums">
                    {r(data.footer.totalPaise)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Per-instructor rate overrides */}
          <div className="rounded-xl border border-border bg-white-warm overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center justify-between px-5 py-3 border-b border-border hover:bg-cream/40 transition-colors"
              onClick={() => setRatesOpen((o) => !o)}
            >
              <h3 className="font-body font-semibold text-base text-charcoal">
                Per-instructor rate overrides
                <span className="ml-2 font-body text-xs text-charcoal/45 font-normal">— blank = studio default</span>
              </h3>
              {ratesOpen ? (
                <ChevronUp className="h-4 w-4 text-charcoal/40" />
              ) : (
                <ChevronDown className="h-4 w-4 text-charcoal/40" />
              )}
            </button>

            {ratesOpen && (
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {(
                    [
                      { key: "r12" as const, label: "12-class (₹)" },
                      { key: "r8" as const, label: "8-class (₹)" },
                      { key: "r4" as const, label: "4-class (₹)" },
                      { key: "r1" as const, label: "1-class / drop-in (₹)" },
                    ] as const
                  ).map(({ key, label }) => (
                    <div key={key} className="space-y-1.5">
                      <Label className="font-body text-xs text-charcoal/60">{label}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Studio default"
                        value={rates[key]}
                        onChange={(e) => setRates((prev) => ({ ...prev, [key]: e.target.value }))}
                        disabled={saving}
                        className="border-border font-body text-sm h-9"
                      />
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void saveRates()}
                  disabled={saving}
                  className="border-sage/30 text-sage hover:bg-sage/5 font-body"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
                  Save overrides
                </Button>
              </div>
            )}
          </div>

          {/* Mark paid / unpaid */}
          {canRecord && (
            <div className="flex justify-end">
              <Button
                type="button"
                variant={isPaid ? "outline" : "sage"}
                disabled={saving}
                onClick={() => void markPaid()}
                className={isPaid ? "border-sage/30 text-charcoal/70 font-body" : "font-body"}
              >
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isPaid ? "Mark unpaid" : "Mark paid"}
              </Button>
            </div>
          )}
        </>
      )}

      {!loading && !data && (
        <div className="py-16 text-center font-body text-sm text-charcoal/40">
          Could not load payout detail.
        </div>
      )}
    </div>
  );
}

export default InstructorPayoutLedger;
