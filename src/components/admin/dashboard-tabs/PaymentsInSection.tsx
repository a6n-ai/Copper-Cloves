import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, Banknote, Filter, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortableHeader, useTableSort } from "@/components/admin/sortable-table";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import { FilterBar, FilterSearch, FilterSelect, FilterDateRange } from "@/components/filters";
import type { DateRange } from "react-day-picker";
import { Pill } from "@/components/ui/pill";
import { paymentMethodPill } from "@/lib/pillMaps";
import { Pagination, usePagination } from "@/components/Pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/responsive/ResponsiveDialog";
import type { ManualPaymentInRow } from "@/lib/payments";

const EDIT_METHOD_OPTIONS: { value: string; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "direct_upi", label: "UPI" },
  { value: "pine_lab_card", label: "Card (Pine Lab)" },
  { value: "pine_lab_upi", label: "UPI (Pine Lab)" },
];

const METHOD_FILTER_OPTIONS = [
  { value: "all", label: "All methods" },
  { value: "cash", label: "Cash" },
  { value: "direct_upi", label: "UPI" },
  { value: "pine_lab_card", label: "Card (Pine Lab)" },
  { value: "pine_lab_upi", label: "UPI (Pine Lab)" },
];

function rupeesFromPaise(p: number): string {
  return `₹${Math.round(p / 100).toLocaleString("en-IN")}`;
}

function PaymentsInSectionImpl() {
  const [rows, setRows] = useState<ManualPaymentInRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<ManualPaymentInRow | null>(null);
  const [editForm, setEditForm] = useState({ amount: "", method: "cash", reference: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const filtersDirty = search !== "" || methodFilter !== "all" || dateRange !== undefined;
  const resetFilters = () => {
    setSearch("");
    setMethodFilter("all");
    setDateRange(undefined);
  };

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/payments?manual=1");
    if (!r.ok) return;
    const d = await r.json();
    if (Array.isArray(d.payments)) setRows(d.payments);
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        await load();
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const openEdit = useCallback((p: ManualPaymentInRow) => {
    setEditRow(p);
    setEditForm({
      amount: String(Math.round(p.amountPaise / 100)),
      method: p.method ?? "cash",
      reference: p.reference ?? "",
      notes: p.notes ?? "",
    });
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editRow) return;
    const amount = Number(editForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch("/api/admin/payments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editRow.id,
          amount_paise: Math.round(amount * 100),
          method: editForm.method,
          reference: editForm.reference || null,
          notes: editForm.notes || null,
        }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        toast.error(e.error ?? "Could not update payment.");
        return;
      }
      toast.success("Payment updated.");
      setEditRow(null);
      await load();
    } finally {
      setSaving(false);
    }
  }, [editRow, editForm, load]);

  const removePayment = useCallback(
    async (id: string) => {
      setDeletingId(id);
      try {
        const r = await fetch(`/api/admin/payments?id=${encodeURIComponent(id)}`, { method: "DELETE" });
        if (!r.ok) {
          toast.error("Could not delete payment.");
          return;
        }
        toast.success("Payment deleted.");
        await load();
      } finally {
        setDeletingId(null);
      }
    },
    [load],
  );

  type SortKey = "member" | "details" | "date" | "amount";
  const getSortValue = useCallback((p: ManualPaymentInRow, key: SortKey): number | string => {
    switch (key) {
      case "member": return p.member.toLowerCase();
      case "details": return (p.reference ?? p.notes ?? "").toLowerCase();
      case "date": return p.createdAtISO;
      case "amount": return p.amountPaise;
    }
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((p) => {
      if (methodFilter !== "all" && p.method !== methodFilter) return false;
      if (dateRange?.from) {
        const day = p.createdAtISO.slice(0, 10);
        const fmt = (d: Date) =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const from = fmt(dateRange.from);
        const to = fmt(dateRange.to ?? dateRange.from);
        if (day < from || day > to) return false;
      }
      if (q) {
        const hay = `${p.member} ${p.memberEmail ?? ""} ${p.reference ?? ""} ${p.notes ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, methodFilter, dateRange]);

  const { sorted, sortKey, sortDir, toggle } = useTableSort(filtered, {
    initialKey: "date",
    initialDir: "desc",
    getValue: getSortValue,
    defaultDirFor: (k) => (k === "member" || k === "details" ? "asc" : "desc"),
  });
  const pg = usePagination(
    sorted,
    12,
    `${search}|${methodFilter}|${dateRange?.from?.toDateString() ?? ""}-${dateRange?.to?.toDateString() ?? ""}|${sortKey}|${sortDir}`,
  );

  return (
    <div className="space-y-6">
      <Card className="border-sage/20 bg-white-warm">
        <CardHeader>
          <div>
            <CardTitle className="font-body font-semibold text-2xl text-charcoal">Money In</CardTitle>
            <CardDescription className="font-body text-charcoal/60">
              Offline / non-Razorpay member payments (cash, Pine Lab, direct UPI). Gateway payments live under Finances → Transactions.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="py-12 text-center font-body text-sm text-charcoal/40">Loading payments…</div>
          )}
          {!loading && rows.length === 0 && (
            <div className="text-center py-12">
              <ArrowDownLeft className="h-12 w-12 text-charcoal/20 mx-auto mb-3" />
              <div className="font-body text-charcoal/60">No manual payments recorded yet</div>
              <div className="font-body text-xs text-charcoal/40 mt-1">
                Record offline member payments from a member’s Manage dialog.
              </div>
            </div>
          )}
          {!loading && rows.length > 0 && (
            <>
              <FilterBar reset={filtersDirty ? resetFilters : undefined} className="mb-4">
                <FilterSearch
                  value={search}
                  onChange={setSearch}
                  placeholder="Search member, reference, note…"
                  aria-label="Search payments"
                />
                <FilterSelect
                  value={methodFilter}
                  onChange={setMethodFilter}
                  icon={Filter}
                  className="w-full sm:w-48"
                  options={METHOD_FILTER_OPTIONS}
                />
                <FilterDateRange value={dateRange} onChange={setDateRange} className="w-full sm:w-56" />
              </FilterBar>
              {sorted.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-sage/20 rounded-xl bg-cream/20">
                  <p className="font-body text-sm text-charcoal/50">No payments match your filters.</p>
                </div>
              ) : (
                <div className="rounded-xl border border-sage/15 bg-white-warm overflow-hidden">
                  <ResponsiveTable>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <SortableHeader sortKey="member" active={sortKey} dir={sortDir} onToggle={toggle}>Member</SortableHeader>
                          <SortableHeader sortKey="details" active={sortKey} dir={sortDir} onToggle={toggle}>Details</SortableHeader>
                          <SortableHeader sortKey="date" active={sortKey} dir={sortDir} onToggle={toggle} className="w-[120px]">Date</SortableHeader>
                          <TableHead className="w-[140px]">Method</TableHead>
                          <SortableHeader sortKey="amount" active={sortKey} dir={sortDir} onToggle={toggle} className="w-[120px] text-right" align="right">Amount</SortableHeader>
                          <TableHead className="w-[88px]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pg.pageItems.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell>
                              <div className="font-body text-sm text-charcoal line-clamp-1 [overflow-wrap:anywhere]">{p.member}</div>
                              {p.memberEmail ? (
                                <div className="font-body text-xs text-charcoal/45 line-clamp-1">{p.memberEmail}</div>
                              ) : null}
                            </TableCell>
                            <TableCell>
                              <div className="font-body text-sm text-charcoal/70 line-clamp-2 [overflow-wrap:anywhere]">
                                {p.reference || p.notes || "—"}
                              </div>
                            </TableCell>
                            <TableCell className="font-body text-sm text-charcoal/60 whitespace-nowrap">
                              {new Date(p.createdAtISO).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
                            </TableCell>
                            <TableCell>
                              {p.method ? (() => {
                                const pm = paymentMethodPill(p.method);
                                return (
                                  <Pill
                                    tone={pm.tone}
                                    brand={pm.brand}
                                    icon={pm.label === "Cash" ? <Banknote className="h-3 w-3" /> : undefined}
                                    className="font-body whitespace-nowrap"
                                  >
                                    {pm.label}
                                  </Pill>
                                );
                              })() : (
                                <span className="font-body text-xs text-charcoal/30">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="font-body font-semibold text-base tabular-nums text-sage">+{rupeesFromPaise(p.amountPaise)}</span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-charcoal/40 hover:text-sage hover:bg-sage/10"
                                  onClick={() => openEdit(p)}
                                  aria-label="Edit payment"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-charcoal/40 hover:text-destructive hover:bg-destructive/10"
                                  disabled={deletingId === p.id}
                                  onClick={() => removePayment(p.id)}
                                  aria-label="Delete payment"
                                >
                                  {deletingId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ResponsiveTable>
                </div>
              )}
              <Pagination page={pg.page} total={pg.total} pageSize={pg.pageSize} onChange={pg.setPage} />
            </>
          )}
        </CardContent>
      </Card>

      <ResponsiveDialog open={editRow !== null} onOpenChange={(o) => { if (!o) setEditRow(null); }}>
        <ResponsiveDialogContent className="border-sage/20 bg-white-warm sm:max-w-md">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="font-body font-semibold text-charcoal">Edit payment</ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="font-body text-charcoal/60">
              {editRow ? `Manual money-in from ${editRow.member}` : ""}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-body text-xs text-charcoal/60">Amount (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  inputMode="decimal"
                  placeholder="0"
                  value={editForm.amount}
                  onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))}
                  className="border-sage/20 bg-white-warm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-body text-xs text-charcoal/60">Method</Label>
                <Select value={editForm.method} onValueChange={(v) => setEditForm((f) => ({ ...f, method: v }))}>
                  <SelectTrigger className="border-sage/20 bg-white-warm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EDIT_METHOD_OPTIONS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="font-body text-xs text-charcoal/60">Reference</Label>
              <Input
                placeholder="Txn id, slip number, etc."
                value={editForm.reference}
                onChange={(e) => setEditForm((f) => ({ ...f, reference: e.target.value }))}
                className="border-sage/20 bg-white-warm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="font-body text-xs text-charcoal/60">Notes (optional)</Label>
              <Textarea
                rows={2}
                value={editForm.notes}
                onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                className="border-sage/20 bg-white-warm resize-none"
              />
            </div>
          </div>

          <ResponsiveDialogFooter>
            <Button type="button" variant="outline" className="border-sage/20" onClick={() => setEditRow(null)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" variant="sage" onClick={saveEdit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save changes
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
}

export const PaymentsInSection = memo(PaymentsInSectionImpl);
export default PaymentsInSection;
