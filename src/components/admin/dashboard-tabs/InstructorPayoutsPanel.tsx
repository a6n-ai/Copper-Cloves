import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { CalendarDays, CheckCircle2, Clock, DollarSign, Download, Loader2, Pencil, Settings, TrendingUp, User, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortableHeader, useTableSort } from "@/components/admin/sortable-table";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { PayoutRateSettingsDialog } from "@/components/admin/PayoutRateSettingsDialog";

type PayoutWindow = "week" | "month" | "quarter" | "all";

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

const WINDOWS: { value: PayoutWindow; label: string }[] = [
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "quarter", label: "This Quarter" },
  { value: "all", label: "All Time" },
];

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
  const [payoutWindow, setPayoutWindow] = useState<PayoutWindow>("month");
  const [search, setSearch] = useState("");
  const [instructorFilter, setInstructorFilter] = useState("all");

  const [rateSettingsOpen, setRateSettingsOpen] = useState(false);

  // mark-paid / move-to-expense confirmation
  const [confirm, setConfirm] = useState<{ row: PayoutRow; paid: boolean } | null>(null);
  const [confirmRecord, setConfirmRecord] = useState(true);
  const [confirmSaving, setConfirmSaving] = useState(false);

  // override / adjustment editing
  const [editRow, setEditRow] = useState<PayoutRow | null>(null);
  const [editForm, setEditForm] = useState({ extra_payable_units: "0", extra_classes: "0", override_payout: "", notes: "", paid_method: "" });
  const [editSaving, setEditSaving] = useState(false);

  const fetchData = useCallback(async (w: PayoutWindow) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/instructor-payouts?window=${encodeURIComponent(w)}`);
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
    void fetchData(payoutWindow);
  }, [fetchData, payoutWindow]);

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
  const pg = usePagination(sorted, 10, `${search}|${instructorFilter}|${payoutWindow}|${sortKey}|${sortDir}`);

  const togglePaid = useCallback(
    async (row: PayoutRow, paid: boolean, recordExpense: boolean) => {
      const res = await fetch("/api/admin/instructor-payout-adjustment", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instructorId: row.instructorId,
          window: payoutWindow,
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
        savedMsg = "Marked paid · recorded as expense";
      } else {
        savedMsg = "Marked paid";
      }
      toast.success(savedMsg);
      await fetchData(payoutWindow);
    },
    [payoutWindow, fetchData],
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

  const saveEdit = useCallback(async () => {
    if (!editRow) return;
    setEditSaving(true);
    try {
      const body: Record<string, unknown> = {
        instructorId: editRow.instructorId,
        window: payoutWindow,
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
      await fetchData(payoutWindow);
    } finally {
      setEditSaving(false);
    }
  }, [editRow, editForm, payoutWindow, fetchData]);

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
    a.download = `instructor-payouts-${summary.periodKey || payoutWindow}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [sorted, summary.periodKey, payoutWindow]);

  let confirmActionLabel: string;
  if (confirmSaving) {
    confirmActionLabel = "Saving…";
  } else if (!confirm?.paid) {
    confirmActionLabel = "Mark unpaid";
  } else if (confirmRecord) {
    confirmActionLabel = "Mark paid & move to expense";
  } else {
    confirmActionLabel = "Mark paid";
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard label="Total Payouts" value={Math.round(summary.totalPayouts)} prefix="₹" icon={DollarSign} tone="sage" loading={loading} hint={`${summary.instructorsCount || rows.length} instructors`} />
        <MetricCard label="Pending" value={Math.round(summary.pendingPayments)} prefix="₹" icon={Clock} tone="amber" loading={loading} hint={`${summary.pendingCount} pending`} />
        <MetricCard label="Completed" value={Math.round(summary.completedPayments)} prefix="₹" icon={CheckCircle2} tone="sage" loading={loading} />
        <MetricCard label="Total Check-ins" value={summary.totalCheckIns} icon={TrendingUp} tone="charcoal" loading={loading} />
      </div>

      <Card className="border-sage/20 bg-white-warm">
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="font-display text-2xl text-charcoal">
                Instructor Payouts <span className="font-body text-base text-charcoal/40">({filtered.length})</span>
              </CardTitle>
              <CardDescription className="font-body text-charcoal/60">
                Payable per instructor from check-ins. Marking paid records the payout as an expense.
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
              <FilterSelect
                value={payoutWindow}
                onChange={(v) => setPayoutWindow(v as PayoutWindow)}
                icon={CalendarDays}
                className="sm:w-36 shrink-0"
                options={WINDOWS.map((w) => ({ value: w.value, label: w.label }))}
              />
              {(search || instructorFilter !== "all") && (
                <FilterReset onReset={() => { setSearch(""); setInstructorFilter("all"); }} label="Clear" />
              )}
              <Button type="button" variant="outline" size="sm" className="h-9 border-sage/20 text-sage hover:bg-sage/5 hover:text-sage!" onClick={downloadCsv} disabled={sorted.length === 0}>
                <Download className="h-4 w-4 mr-1.5" />CSV
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setRateSettingsOpen(true)}>
                <Settings className="h-4 w-4 mr-2" /> Rate Settings
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
                <ResponsiveTable>
                  <Table>
                    <TableHeader>
                      <TableRow>
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
                            {r.extraClasses ? <span className="ml-1 font-body text-xs text-[#a05e38]">({r.extraClasses > 0 ? "+" : ""}{r.extraClasses})</span> : null}
                          </TableCell>
                          <TableCell className="font-body text-sm text-charcoal/70 tabular-nums">{r.checkIns}</TableCell>
                          <TableCell>
                            <span className="font-body text-sm text-charcoal/80 tabular-nums">{r.payableUnits}</span>
                            {r.extraPayableUnits ? <span className="ml-1 font-body text-xs text-[#a05e38]">({r.extraPayableUnits > 0 ? "+" : ""}{r.extraPayableUnits})</span> : null}
                          </TableCell>
                          <TableCell className="font-body text-sm text-charcoal/60 tabular-nums">{r.percentage}%</TableCell>
                          <TableCell className="text-right">
                            <span className="font-display text-base tabular-nums text-charcoal">{rupees(r.total)}</span>
                            {r.overrideTotal != null ? <span className="ml-1 font-body text-[10px] uppercase tracking-wide text-[#a05e38]">ovr</span> : null}
                          </TableCell>
                          <TableCell>
                            {r.status === "paid" ? <Pill tone="success" dot>Paid</Pill> : <Pill tone="warning" dot>Pending</Pill>}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-2">
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
                                  className="h-8 w-8 p-0 border-terracotta/30 text-[#a05e38] hover:bg-terracotta/10 hover:text-[#a05e38]!"
                                  onClick={(e) => { e.stopPropagation(); setConfirmRecord(true); setConfirm({ row: r, paid: true }); }}
                                  title="Move to expense"
                                  aria-label="Move to expense"
                                >
                                  <Wallet className="h-4 w-4" />
                                </Button>
                              )}
                              <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-charcoal/40 hover:text-sage hover:bg-sage/10" onClick={(e) => { e.stopPropagation(); openEdit(r); }} aria-label="Edit adjustment">
                                <Pencil className="h-4 w-4" />
                              </Button>
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
            <ResponsiveDialogTitle className="font-display text-charcoal">
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
                Move {rupees(confirm?.row.total ?? 0)} to expenses
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

      <PayoutRateSettingsDialog
        open={rateSettingsOpen}
        onOpenChange={setRateSettingsOpen}
        onSaved={() => fetchData(payoutWindow)}
      />

      {/* Override / adjustment editor */}
      <ResponsiveDialog open={editRow != null} onOpenChange={(o) => { if (!o) setEditRow(null); }}>
        <ResponsiveDialogContent className="bg-white-warm border-sage/20 sm:max-w-md">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="font-display text-charcoal">Adjust payout — {editRow?.name}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="font-body text-charcoal/60">
              Add extra units/classes, or set a manual override that replaces the computed payout.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-body text-xs text-charcoal/60">Extra payable units</Label>
                <Input type="number" value={editForm.extra_payable_units} onChange={(e) => setEditForm((f) => ({ ...f, extra_payable_units: e.target.value }))} className="border-sage/20 bg-white" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-body text-xs text-charcoal/60">Extra classes</Label>
                <Input type="number" value={editForm.extra_classes} onChange={(e) => setEditForm((f) => ({ ...f, extra_classes: e.target.value }))} className="border-sage/20 bg-white" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="font-body text-xs text-charcoal/60">Override payout (₹) — leave blank to use computed</Label>
              <Input type="number" placeholder={editRow ? String(Math.round(editRow.total)) : ""} value={editForm.override_payout} onChange={(e) => setEditForm((f) => ({ ...f, override_payout: e.target.value }))} className="border-sage/20 bg-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-body text-xs text-charcoal/60">Notes</Label>
              <Input value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} className="border-sage/20 bg-white" />
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
    </div>
  );
}

export const InstructorPayoutsPanel = memo(InstructorPayoutsPanelImpl);
export default InstructorPayoutsPanel;
