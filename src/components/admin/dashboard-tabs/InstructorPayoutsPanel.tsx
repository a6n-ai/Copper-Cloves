import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { format } from "date-fns";
import { CalendarDays, CheckCircle2, Clock, DollarSign, Download, FileSpreadsheet, Loader2, Pencil, TrendingUp, User, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import {
  fetchPayoutDetails,
  downloadInstructorPayoutExcel,
} from "@/lib/instructorPayoutExport";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortableHeader, useTableSort } from "@/components/admin/sortable-table";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Pill } from "@/components/ui/pill";
import { ListAvatar } from "@/components/admin/ListAvatar";
import { MetricCard } from "@/components/admin/MetricCard";
import { Pagination, usePagination } from "@/components/Pagination";
import { FilterReset, FilterSearch, FilterSelect } from "@/components/filters";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/responsive/ResponsiveDialog";
import type { DateRange } from "react-day-picker";
import { windowFromRange } from "@/lib/payoutCalc";
import {
  PayoutPeriodPicker,
  payoutPeriodQuery,
  DEFAULT_PAYOUT_RANGE,
} from "@/components/admin/PayoutPeriodPicker";

type PayoutRow = {
  instructorId: string;
  name: string;
  imageUrl: string | null;
  specialties: string;
  classes: number;
  extraClasses: number;
  checkIns: number;
  payableUnits: number;
  extraPayableUnits: number;
  blendedRatePaise: number;
  netPerUnit: number;
  percentage: number;
  studioCutPercent: number;
  total: number;
  overrideTotal: number | null;
  paidAt: string | null;
  paidMethod: string | null;
  notes: string | null;
  status: "pending" | "paid";
};

type PayoutSummary = {
  totalPayouts: number;
  pendingPayments: number;
  completedPayments: number;
  totalCheckIns: number;
  pendingCount: number;
  instructorsCount: number;
  periodKey: string;
};

const EMPTY_SUMMARY: PayoutSummary = {
  totalPayouts: 0,
  pendingPayments: 0,
  completedPayments: 0,
  totalCheckIns: 0,
  pendingCount: 0,
  instructorsCount: 0,
  periodKey: "",
};

function rupees(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function csvEsc(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function InstructorPayoutsPanelImpl() {
  const router = useRouter();
  const [rows, setRows] = useState<PayoutRow[]>([]);
  const [summary, setSummary] = useState<PayoutSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<DateRange | undefined>(DEFAULT_PAYOUT_RANGE);
  // Writes: only a monthly period may be written to — see isAdjustableWindow / the 400 from
  // /api/admin/instructor-payout-adjustment.
  const canRecord = windowFromRange(range) === "month";
  // Reads: every preset window (week/month/quarter/all) resolves to a real periodKey and
  // is backend-merged with any adjustment row; only "custom" has periodKey=null, where the
  // server genuinely skipped the merge. Hiding real paid state for non-custom windows is wrong.
  const canShowAdjustment = windowFromRange(range) !== "custom";
  const [search, setSearch] = useState("");
  const [instructorFilter, setInstructorFilter] = useState("all");

  // mark-paid / move-to-expense confirmation
  const [confirm, setConfirm] = useState<{ row: PayoutRow; paid: boolean } | null>(null);
  const [confirmRecord, setConfirmRecord] = useState(true);
  const [confirmSaving, setConfirmSaving] = useState(false);

  // override / adjustment editing
  const [editRow, setEditRow] = useState<PayoutRow | null>(null);
  const [editForm, setEditForm] = useState({ extra_payable_units: "0", extra_classes: "0", override_payout: "", notes: "", paid_method: "" });
  const [editSaving, setEditSaving] = useState(false);

  // Excel export. The period here is a PRESET, deliberately decoupled from the table's
  // `range`: a custom range has no period_key, so it carries no paid state to report.
  const [exportOpen, setExportOpen] = useState(false);
  const [exportWindow, setExportWindow] = useState<"week" | "month" | "quarter" | "all">("month");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exportProgress, setExportProgress] = useState<{ done: number; total: number } | null>(null);

  const fetchData = useCallback(async (r: DateRange | undefined) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/instructor-payouts?${payoutPeriodQuery(r)}`);
      if (!res.ok) {
        setRows([]);
        setSummary(EMPTY_SUMMARY);
        return;
      }
      const d = await res.json();
      setRows(Array.isArray(d.instructors) ? d.instructors : []);
      setSummary({ ...EMPTY_SUMMARY, ...(d.summary ?? {}) });
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // A half-picked range (start chosen, end pending) would refetch as "month" and flicker.
    if (range?.from && !range.to) return;
    void fetchData(range);
  }, [fetchData, range]);

  const instructorOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.name))).sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (instructorFilter !== "all" && r.name !== instructorFilter) return false;
      if (q && !`${r.name} ${r.specialties}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, instructorFilter]);

  type SortKey = "name" | "classes" | "checkIns" | "payableUnits" | "percentage" | "total" | "status";
  const getValue = useCallback((r: PayoutRow, key: SortKey): number | string => {
    switch (key) {
      case "name": return r.name.toLowerCase();
      case "classes": return r.classes;
      case "checkIns": return r.checkIns;
      case "payableUnits": return r.payableUnits;
      case "percentage": return r.percentage;
      case "total": return r.total;
      case "status": return r.status;
    }
  }, []);
  const { sorted, sortKey, sortDir, toggle } = useTableSort(filtered, {
    initialKey: "total",
    initialDir: "desc",
    getValue,
    defaultDirFor: (k) => (k === "name" || k === "status" ? "asc" : "desc"),
  });
  const rangeKey = payoutPeriodQuery(range);
  const pg = usePagination(sorted, 10, `${search}|${instructorFilter}|${rangeKey}|${sortKey}|${sortDir}`);

  const togglePaid = useCallback(
    async (row: PayoutRow, paid: boolean, recordExpense: boolean) => {
      const res = await fetch("/api/admin/instructor-payout-adjustment", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instructorId: row.instructorId,
          window: "month",
          paid,
          recordExpense,
          payout_paise: Math.round(row.total * 100),
          blended_rate_paise: row.blendedRatePaise,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error ?? "Save failed");
        return;
      }
      let savedMsg: string;
      if (!paid) {
        savedMsg = "Marked unpaid";
      } else if (recordExpense) {
        savedMsg = "Marked paid · added to money out";
      } else {
        savedMsg = "Marked paid";
      }
      toast.success(savedMsg);
      await fetchData(range);
    },
    [range, fetchData],
  );

  const openEdit = useCallback((row: PayoutRow) => {
    setEditRow(row);
    setEditForm({
      extra_payable_units: String(row.extraPayableUnits ?? 0),
      extra_classes: String(row.extraClasses ?? 0),
      override_payout: row.overrideTotal != null ? String(row.overrideTotal) : "",
      notes: row.notes ?? "",
      paid_method: row.paidMethod ?? "",
    });
  }, []);

  const allVisibleSelected =
    sorted.length > 0 && sorted.every((r) => selectedIds.has(r.instructorId));

  // Selection survives a filter change, so `selectedIds` can name instructors the table no longer
  // shows. Only the visible ones are exported — so every count and every disabled guard must read
  // this, not selectedIds.size, or the button promises 5 sheets and the workbook holds 2.
  const exportableIds = useMemo(
    () => sorted.filter((r) => selectedIds.has(r.instructorId)).map((r) => r.instructorId),
    [sorted, selectedIds],
  );

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (sorted.every((r) => prev.has(r.instructorId))) return new Set();
      return new Set(sorted.map((r) => r.instructorId));
    });
  }, [sorted]);

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const runExport = useCallback(async () => {
    const ids = exportableIds;
    if (ids.length === 0) return;
    setExportProgress({ done: 0, total: ids.length });
    try {
      const details = await fetchPayoutDetails(ids, exportWindow, (done, total) =>
        setExportProgress({ done, total }),
      );
      if (details.length === 0) {
        toast.error("Could not load payout data for the selected instructors");
        return;
      }
      if (details.length < ids.length) {
        toast.warning(`${ids.length - details.length} instructor(s) could not be loaded`);
      }
      const stem = ids.length === 1 ? `payout-${details[0].instructor.name}` : "instructor-payouts";
      await downloadInstructorPayoutExcel(details, `${stem}-${exportWindow}`);
      setExportOpen(false);
    } catch {
      toast.error("Export failed");
    } finally {
      setExportProgress(null);
    }
  }, [exportableIds, exportWindow]);

  const saveEdit = useCallback(async () => {
    if (!editRow) return;
    setEditSaving(true);
    try {
      const body: Record<string, unknown> = {
        instructorId: editRow.instructorId,
        window: "month",
        extra_payable_units: Number(editForm.extra_payable_units) || 0,
        extra_classes: Number(editForm.extra_classes) || 0,
        notes: editForm.notes,
        paid_method: editForm.paid_method || null,
      };
      if (editForm.override_payout.trim() === "") {
        body.override_payout_paise = null;
      } else {
        const r = Number(editForm.override_payout);
        if (!Number.isFinite(r)) {
          toast.error("Override payout must be a number");
          setEditSaving(false);
          return;
        }
        body.override_payout_paise = Math.round(r * 100);
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
      toast.success("Adjustment saved");
      setEditRow(null);
      await fetchData(range);
    } finally {
      setEditSaving(false);
    }
  }, [editRow, editForm, range, fetchData]);

  const downloadCsv = useCallback(() => {
    const header = ["Instructor", "Specialties", "Classes", "Check-ins", "Payable Units", "Net per Unit", "Studio %", "Instructor %", "Total Payout INR", "Override", "Paid At", "Paid Method", "Notes"];
    const lines = [header.join(",")];
    for (const r of sorted) {
      lines.push([r.name, r.specialties, r.classes, r.checkIns, r.payableUnits, r.netPerUnit, r.studioCutPercent, r.percentage, r.total.toFixed(2), r.overrideTotal != null ? "yes" : "no", r.paidAt ?? "", r.paidMethod ?? "", r.notes ?? ""].map(csvEsc).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    // A custom range has no periodKey (server skips the merge for it) — fall back to a
    // clean date-based label instead of the raw querystring (`window=custom&from=...`).
    const fileLabel =
      summary.periodKey ||
      (range?.from && range?.to
        ? `${format(range.from, "yyyy-MM-dd")}_${format(range.to, "yyyy-MM-dd")}`
        : rangeKey);
    a.download = `instructor-payouts-${fileLabel}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [sorted, summary.periodKey, rangeKey, range]);

  let confirmActionLabel: string;
  if (confirmSaving) {
    confirmActionLabel = "Saving…";
  } else if (!confirm?.paid) {
    confirmActionLabel = "Mark unpaid";
  } else if (confirmRecord) {
    confirmActionLabel = "Mark paid & add to money out";
  } else {
    confirmActionLabel = "Mark paid";
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard label="Total Payouts" value={Math.round(summary.totalPayouts)} prefix="₹" icon={DollarSign} tone="sage" loading={loading} hint={`${summary.instructorsCount || rows.length} instructors`} />
        <MetricCard label="Pending" value={canShowAdjustment ? Math.round(summary.pendingPayments) : 0} prefix={canShowAdjustment ? "₹" : ""} icon={Clock} tone="clay" loading={loading} hint={canShowAdjustment ? `${summary.pendingCount} pending` : "Not tracked for custom ranges"} />
        <MetricCard label="Completed" value={canShowAdjustment ? Math.round(summary.completedPayments) : 0} prefix={canShowAdjustment ? "₹" : ""} icon={CheckCircle2} tone="sage" loading={loading} hint={canShowAdjustment ? undefined : "Not tracked for custom ranges"} />
        <MetricCard label="Total Check-ins" value={summary.totalCheckIns} icon={TrendingUp} tone="charcoal" loading={loading} />
      </div>

      <Card className="border-sage/20 bg-white-warm">
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="font-body font-semibold text-2xl text-charcoal">
                Instructor Payouts <span className="font-body text-base text-charcoal/40">({filtered.length})</span>
              </CardTitle>
              <CardDescription className="font-body text-charcoal/60">
                Payable per instructor from check-ins. Marking paid adds the payout to money out.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <FilterSearch value={search} onChange={setSearch} placeholder="Search instructor…" aria-label="Search instructor" className="flex-1 sm:w-48 sm:flex-none" />
              <FilterSelect
                value={instructorFilter}
                onChange={setInstructorFilter}
                icon={User}
                className="sm:w-40 shrink-0"
                options={[
                  { value: "all", label: "All instructors" },
                  ...instructorOptions.map((n) => ({ value: n, label: n })),
                ]}
              />
              <PayoutPeriodPicker value={range} onChange={setRange} className="sm:w-52 shrink-0" />
              {(search || instructorFilter !== "all") && (
                <FilterReset onReset={() => { setSearch(""); setInstructorFilter("all"); }} label="Clear" />
              )}
              <Button type="button" variant="outline" size="sm" className="h-9 border-sage/20 text-sage hover:bg-sage/5 hover:text-sage!" onClick={downloadCsv} disabled={sorted.length === 0}>
                <Download className="h-4 w-4 mr-1.5" />CSV
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 border-sage/20 text-sage hover:bg-sage/5 hover:text-sage!"
                onClick={() => setExportOpen(true)}
                disabled={exportableIds.length === 0}
              >
                <FileSpreadsheet className="h-4 w-4 mr-1.5" />
                Export Excel{exportableIds.length > 0 ? ` (${exportableIds.length})` : ""}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="py-12 text-center font-body text-sm text-charcoal/40">Loading payouts…</div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="py-12 text-center font-body text-sm text-charcoal/40">
              {rows.length === 0 ? "No payout data for this period." : "No instructors match your filters."}
            </div>
          )}
          {!loading && filtered.length > 0 && (
            <>
              <div className="rounded-xl border border-sage/15 bg-white-warm overflow-hidden">
                <ResponsiveTable stack>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[44px]">
                          <Checkbox
                            checked={allVisibleSelected}
                            onCheckedChange={toggleAll}
                            aria-label="Select all instructors"
                          />
                        </TableHead>
                        <SortableHeader sortKey="name" active={sortKey} dir={sortDir} onToggle={toggle}>Instructor</SortableHeader>
                        <SortableHeader sortKey="classes" active={sortKey} dir={sortDir} onToggle={toggle} className="w-[90px]">Classes</SortableHeader>
                        <SortableHeader sortKey="checkIns" active={sortKey} dir={sortDir} onToggle={toggle} className="w-[100px]">Check-ins</SortableHeader>
                        <SortableHeader sortKey="payableUnits" active={sortKey} dir={sortDir} onToggle={toggle} className="w-[100px]">Payable</SortableHeader>
                        <SortableHeader sortKey="percentage" active={sortKey} dir={sortDir} onToggle={toggle} className="w-[90px]">Share</SortableHeader>
                        <SortableHeader sortKey="total" active={sortKey} dir={sortDir} onToggle={toggle} className="w-[130px] text-right" align="right">Payout</SortableHeader>
                        <SortableHeader sortKey="status" active={sortKey} dir={sortDir} onToggle={toggle} className="w-[110px]">Status</SortableHeader>
                        <TableHead className="w-[230px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pg.pageItems.map((r) => (
                        <TableRow
                          key={r.instructorId}
                          className="cursor-pointer hover:bg-sage/5"
                          onClick={() => void router.push(`/admin/instructors/${r.instructorId}?tab=payout`)}
                        >
                          <TableCell className="w-[44px]" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedIds.has(r.instructorId)}
                              onCheckedChange={() => toggleOne(r.instructorId)}
                              aria-label={`Select ${r.name}`}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3 min-w-0">
                              <ListAvatar src={r.imageUrl} name={r.name} size="md" />
                              <div className="min-w-0">
                                <div className="font-body font-medium text-charcoal truncate">{r.name}</div>
                                <div className="font-body text-xs text-charcoal/45 truncate">{r.specialties}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-body text-sm text-charcoal/80 tabular-nums">{r.classes}</span>
                            {r.extraClasses ? <span className="ml-1 font-body text-xs text-terracotta">({r.extraClasses > 0 ? "+" : ""}{r.extraClasses})</span> : null}
                          </TableCell>
                          <TableCell className="font-body text-sm text-charcoal/70 tabular-nums">{r.checkIns}</TableCell>
                          <TableCell>
                            <span className="font-body text-sm text-charcoal/80 tabular-nums">{r.payableUnits}</span>
                            {r.extraPayableUnits ? <span className="ml-1 font-body text-xs text-terracotta">({r.extraPayableUnits > 0 ? "+" : ""}{r.extraPayableUnits})</span> : null}
                          </TableCell>
                          <TableCell className="font-body text-sm text-charcoal/60 tabular-nums">{r.percentage}%</TableCell>
                          <TableCell className="text-right">
                            <span className="font-body font-semibold text-base tabular-nums text-charcoal">{rupees(r.total)}</span>
                            {r.overrideTotal != null ? <span className="ml-1 font-body text-[10px] uppercase tracking-wide text-terracotta">ovr</span> : null}
                          </TableCell>
                          <TableCell>
                            {!canShowAdjustment ? (
                              <span className="font-body text-xs text-charcoal/35">—</span>
                            ) : r.status === "paid" ? (
                              <Pill tone="success" dot>Paid</Pill>
                            ) : (
                              <Pill tone="warning" dot>Pending</Pill>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-2">
                              {!canRecord ? (
                                <span className="font-body text-xs text-charcoal/40">
                                  Switch to This Month to record payment
                                </span>
                              ) : (
                                <>
                                  {r.status === "paid" ? (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="border-sage/25 text-charcoal/60 hover:bg-sage/5 font-body hover:text-charcoal!"
                                      onClick={(e) => { e.stopPropagation(); setConfirmRecord(true); setConfirm({ row: r, paid: false }); }}
                                    >
                                      Mark unpaid
                                    </Button>
                                  ) : (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-8 w-8 p-0 border-terracotta/30 text-terracotta hover:bg-terracotta/10 hover:text-terracotta!"
                                      onClick={(e) => { e.stopPropagation(); setConfirmRecord(true); setConfirm({ row: r, paid: true }); }}
                                      title="Add to money out"
                                      aria-label="Add to money out"
                                    >
                                      <Wallet className="h-4 w-4" />
                                    </Button>
                                  )}
                                  <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-charcoal/40 hover:text-sage hover:bg-sage/10" onClick={(e) => { e.stopPropagation(); openEdit(r); }} aria-label="Edit adjustment">
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ResponsiveTable>
              </div>
              <Pagination page={pg.page} total={pg.total} onChange={pg.setPage} />
            </>
          )}
        </CardContent>
      </Card>

      {/* Mark-paid / move-to-expense confirmation */}
      <ResponsiveDialog open={confirm != null} onOpenChange={(o) => { if (!o) setConfirm(null); }}>
        <ResponsiveDialogContent className="bg-white-warm border-sage/20 sm:max-w-md">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="font-body font-semibold text-charcoal">
              {confirm?.paid ? "Mark payout paid?" : "Mark payout unpaid?"}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="font-body text-charcoal/70">
              {confirm?.paid ? (
                <>{confirm?.row.name}&apos;s payout of <span className="font-semibold text-charcoal">{rupees(confirm?.row.total ?? 0)}</span> will be marked paid for this period.</>
              ) : (
                <>{confirm?.row.name}&apos;s payout will be set back to pending. Any expense recorded for this period will be removed.</>
              )}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          {confirm?.paid ? (
            <label className="flex items-center gap-3 rounded-xl border border-sage/20 bg-cream/40 p-3 cursor-pointer select-none">
              <Switch checked={confirmRecord} onCheckedChange={setConfirmRecord} />
              <span className="font-body text-sm text-charcoal">
                Add {rupees(confirm?.row.total ?? 0)} to money out
                <span className="block text-xs text-charcoal/55">Records this payout in the finance expense ledger</span>
              </span>
            </label>
          ) : null}
          <ResponsiveDialogFooter>
            <Button type="button" variant="outline" className="border-sage/20" disabled={confirmSaving} onClick={() => setConfirm(null)}>Cancel</Button>
            <Button
              type="button"
              variant="sage"
              disabled={confirmSaving}
              onClick={async () => {
                if (!confirm) return;
                setConfirmSaving(true);
                try {
                  await togglePaid(confirm.row, confirm.paid, confirm.paid ? confirmRecord : false);
                  setConfirm(null);
                } finally {
                  setConfirmSaving(false);
                }
              }}
            >
              {confirmActionLabel}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {/* Override / adjustment editor */}
      <ResponsiveDialog open={editRow != null} onOpenChange={(o) => { if (!o) setEditRow(null); }}>
        <ResponsiveDialogContent className="bg-white-warm border-sage/20 sm:max-w-md">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="font-body font-semibold text-charcoal">Adjust payout — {editRow?.name}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="font-body text-charcoal/60">
              Add extra units/classes, or set a manual override that replaces the computed payout.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-body text-xs text-charcoal/60">Extra payable units</Label>
                <Input type="number" value={editForm.extra_payable_units} onChange={(e) => setEditForm((f) => ({ ...f, extra_payable_units: e.target.value }))} className="border-sage/20 bg-white-warm" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-body text-xs text-charcoal/60">Extra classes</Label>
                <Input type="number" value={editForm.extra_classes} onChange={(e) => setEditForm((f) => ({ ...f, extra_classes: e.target.value }))} className="border-sage/20 bg-white-warm" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="font-body text-xs text-charcoal/60">Override payout (₹) — leave blank to use computed</Label>
              <Input type="number" placeholder={editRow ? String(Math.round(editRow.total)) : ""} value={editForm.override_payout} onChange={(e) => setEditForm((f) => ({ ...f, override_payout: e.target.value }))} className="border-sage/20 bg-white-warm" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-body text-xs text-charcoal/60">Notes</Label>
              <Input value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} className="border-sage/20 bg-white-warm" />
            </div>
          </div>
          <ResponsiveDialogFooter>
            <Button type="button" variant="outline" className="border-sage/20" disabled={editSaving} onClick={() => setEditRow(null)}>Cancel</Button>
            <Button type="button" variant="sage" disabled={editSaving} onClick={saveEdit}>
              {editSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wallet className="h-4 w-4 mr-2" />}
              Save adjustment
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {/* Excel export */}
      <ResponsiveDialog
        open={exportOpen}
        onOpenChange={(o) => { if (!exportProgress) setExportOpen(o); }}
      >
        <ResponsiveDialogContent className="bg-white-warm border-sage/20 sm:max-w-md">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="font-body font-semibold text-charcoal">
              Export payout workbook
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="font-body text-charcoal/60">
              One sheet per instructor, per calendar month.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          {exportProgress ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-6 w-6 animate-spin text-sage" />
              <p className="font-body text-sm text-charcoal">
                Building sheet {exportProgress.done} of {exportProgress.total}…
              </p>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="font-body text-xs text-charcoal/60">Period</Label>
                <FilterSelect
                  value={exportWindow}
                  onChange={(v) => setExportWindow(v as typeof exportWindow)}
                  icon={CalendarDays}
                  className="w-full"
                  options={[
                    { value: "week", label: "This Week" },
                    { value: "month", label: "This Month" },
                    { value: "quarter", label: "This Quarter" },
                    { value: "all", label: "All Time" },
                  ]}
                />
              </div>
              <p className="font-body text-xs text-charcoal/55">
                {exportableIds.length} instructor{exportableIds.length === 1 ? "" : "s"} selected. A period
                spanning several months produces one sheet per month.
              </p>
            </div>
          )}

          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-sage/20"
              disabled={!!exportProgress}
              onClick={() => setExportOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="sage"
              disabled={!!exportProgress || exportableIds.length === 0}
              onClick={() => void runExport()}
            >
              {exportProgress ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
              Download
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
}

export const InstructorPayoutsPanel = memo(InstructorPayoutsPanelImpl);
export default InstructorPayoutsPanel;
