import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Receipt, Trash2, Banknote } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortableHeader, useTableSort } from "@/components/admin/sortable-table";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker, FilterBar, FilterSearch, FilterSelect, FilterDateRange } from "@/components/filters";
import type { DateRange } from "react-day-picker";
import { Filter } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Pill } from "@/components/ui/pill";
import { paymentMethodPill } from "@/lib/pillMaps";
import { Pagination, usePagination } from "@/components/Pagination";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/responsive/ResponsiveDialog";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  expenseCategoryStyle,
  type ExpenseCategoryValue,
} from "@/lib/expenseConstants";

type ExpenseDTO = {
  id: string;
  category: ExpenseCategoryValue;
  amountPaise: number;
  incurredAtISO: string;
  description: string | null;
  payee: string | null;
  method: string | null;
  proofUrl: string | null;
  notes: string | null;
  instructorId: string | null;
  isPayout: boolean;
  recordedBy: string | null;
};

const METHOD_OPTIONS: { value: string; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "direct_upi", label: "UPI" },
  { value: "pine_lab_card", label: "Card (Pine Lab)" },
  { value: "pine_lab_upi", label: "UPI (Pine Lab)" },
  { value: "razorpay_online", label: "Razorpay" },
];

function rupeesFromPaise(p: number): string {
  return `₹${Math.round(p / 100).toLocaleString("en-IN")}`;
}
function todayISODate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const EMPTY_FORM = {
  category: "other" as ExpenseCategoryValue,
  amount: "",
  incurredAt: todayISODate(),
  payee: "",
  method: "none",
  description: "",
  notes: "",
};

function ExpensesSectionImpl() {
  const [expenses, setExpenses] = useState<ExpenseDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const filtersDirty = search !== "" || categoryFilter !== "all" || dateRange !== undefined;
  const resetFilters = () => {
    setSearch("");
    setCategoryFilter("all");
    setDateRange(undefined);
  };

  const fetchExpenses = useCallback(async () => {
    const r = await fetch("/api/admin/expenses");
    if (!r.ok) return;
    const d = await r.json();
    if (Array.isArray(d.expenses)) setExpenses(d.expenses);
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await fetchExpenses();
      setLoading(false);
    })();
  }, [fetchExpenses]);

  type ExpSortKey = "category" | "details" | "date" | "amount";
  const getExpSortValue = useCallback((e: ExpenseDTO, key: ExpSortKey): number | string => {
    switch (key) {
      case "category": return EXPENSE_CATEGORY_LABELS[e.category] ?? e.category;
      case "details": return (e.payee ?? e.description ?? "").toLowerCase();
      case "date": return e.incurredAtISO;
      case "amount": return e.amountPaise;
    }
  }, []);
  const filteredExpenses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses.filter((e) => {
      if (categoryFilter !== "all" && e.category !== categoryFilter) return false;
      if (dateRange?.from) {
        const day = e.incurredAtISO.slice(0, 10);
        const from = `${dateRange.from.getFullYear()}-${String(dateRange.from.getMonth() + 1).padStart(2, "0")}-${String(dateRange.from.getDate()).padStart(2, "0")}`;
        const toSrc = dateRange.to ?? dateRange.from;
        const to = `${toSrc.getFullYear()}-${String(toSrc.getMonth() + 1).padStart(2, "0")}-${String(toSrc.getDate()).padStart(2, "0")}`;
        if (day < from || day > to) return false;
      }
      if (q) {
        const hay = `${e.payee ?? ""} ${e.description ?? ""} ${e.notes ?? ""} ${EXPENSE_CATEGORY_LABELS[e.category] ?? e.category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [expenses, search, categoryFilter, dateRange]);

  const { sorted: sortedExpenses, sortKey: expSortKey, sortDir: expSortDir, toggle: toggleExp } = useTableSort(
    filteredExpenses,
    {
      initialKey: "date",
      initialDir: "desc",
      getValue: getExpSortValue,
      defaultDirFor: (k) => (k === "category" || k === "details" ? "asc" : "desc"),
    },
  );
  const expensePg = usePagination(sortedExpenses, 12, `${search}|${categoryFilter}|${dateRange?.from?.toDateString() ?? ""}-${dateRange?.to?.toDateString() ?? ""}|${expSortKey}|${expSortDir}`);

  const submitExpense = useCallback(async () => {
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch("/api/admin/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: form.category,
          amount,
          incurredAt: form.incurredAt || undefined,
          payee: form.payee || undefined,
          method: form.method !== "none" ? form.method : undefined,
          description: form.description || undefined,
          notes: form.notes || undefined,
        }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        toast.error(e.error ?? "Could not save expense.");
        return;
      }
      toast.success("Expense recorded.");
      setAddOpen(false);
      setForm(EMPTY_FORM);
      await fetchExpenses();
    } finally {
      setSaving(false);
    }
  }, [form, fetchExpenses]);

  const removeExpense = useCallback(
    async (id: string) => {
      setDeletingId(id);
      try {
        const r = await fetch(`/api/admin/expenses?id=${encodeURIComponent(id)}`, { method: "DELETE" });
        if (!r.ok) {
          toast.error("Could not delete expense.");
          return;
        }
        await fetchExpenses();
      } finally {
        setDeletingId(null);
      }
    },
    [fetchExpenses],
  );

  return (
    <div className="space-y-6">
      <Card className="border-sage/20 bg-white-warm">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="font-display text-2xl text-charcoal">Money Out</CardTitle>
              <CardDescription className="font-body text-charcoal/60">Payouts, café meals, rent, and other costs</CardDescription>
            </div>
            <Button type="button" variant="sage" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Expense
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="py-12 text-center font-body text-sm text-charcoal/40">Loading expenses…</div>
          )}
          {!loading && expenses.length === 0 && (
            <div className="text-center py-12">
              <Receipt className="h-12 w-12 text-charcoal/20 mx-auto mb-3" />
              <div className="font-body text-charcoal/60">No expenses recorded yet</div>
              <Button variant="outline" size="sm" className="mt-4 border-sage/20 text-sage hover:bg-sage/5 hover:text-sage!" onClick={() => setAddOpen(true)}>
                Add your first expense
              </Button>
            </div>
          )}
          {!loading && expenses.length > 0 && (
            <>
              <FilterBar reset={filtersDirty ? resetFilters : undefined} className="mb-4">
                <FilterSearch
                  value={search}
                  onChange={setSearch}
                  placeholder="Search payee, note, category…"
                  aria-label="Search expenses"
                />
                <FilterSelect
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  icon={Filter}
                  className="w-full sm:w-48"
                  options={[
                    { value: "all", label: "All categories" },
                    ...Object.entries(EXPENSE_CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
                  ]}
                />
                <FilterDateRange value={dateRange} onChange={setDateRange} className="w-full sm:w-56" />
              </FilterBar>
              {sortedExpenses.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-sage/20 rounded-xl bg-cream/20">
                  <p className="font-body text-sm text-charcoal/50">No expenses match your filters.</p>
                </div>
              ) : (
              <div className="rounded-xl border border-sage/15 bg-white-warm overflow-hidden">
                <ResponsiveTable>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableHeader sortKey="category" active={expSortKey} dir={expSortDir} onToggle={toggleExp} className="w-[132px]">Type</SortableHeader>
                        <SortableHeader sortKey="details" active={expSortKey} dir={expSortDir} onToggle={toggleExp}>Details</SortableHeader>
                        <SortableHeader sortKey="date" active={expSortKey} dir={expSortDir} onToggle={toggleExp} className="w-[120px]">Date</SortableHeader>
                        <TableHead className="w-[120px]">Method</TableHead>
                        <SortableHeader sortKey="amount" active={expSortKey} dir={expSortDir} onToggle={toggleExp} className="w-[120px] text-right" align="right">Amount</SortableHeader>
                        <TableHead className="w-[56px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expensePg.pageItems.map((e) => {
                        const ks = expenseCategoryStyle(e.category);
                        return (
                          <TableRow key={e.id}>
                            <TableCell>
                              <span
                                className="inline-flex w-full max-w-[112px] items-center justify-center rounded-md border px-2.5 py-0.5 font-body text-[11px] font-medium whitespace-nowrap"
                                style={{ backgroundColor: ks.bg, color: ks.fg, borderColor: ks.border }}
                              >
                                {EXPENSE_CATEGORY_LABELS[e.category]}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="font-body text-sm text-charcoal line-clamp-2 [overflow-wrap:anywhere]">
                                {e.payee || e.description || EXPENSE_CATEGORY_LABELS[e.category]}
                              </div>
                              {e.description && e.payee ? (
                                <div className="font-body text-xs text-charcoal/45 line-clamp-1">{e.description}</div>
                              ) : null}
                            </TableCell>
                            <TableCell className="font-body text-sm text-charcoal/60 whitespace-nowrap">
                              {new Date(e.incurredAtISO).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
                            </TableCell>
                            <TableCell>
                              {e.method ? (() => {
                                const pm = paymentMethodPill(e.method);
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
                              <span className="font-display text-base tabular-nums text-[#a05e38]">−{rupeesFromPaise(e.amountPaise)}</span>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-charcoal/40 hover:text-[#a05e38] hover:bg-[#a05e38]/10"
                                disabled={deletingId === e.id}
                                onClick={() => removeExpense(e.id)}
                                aria-label="Delete expense"
                              >
                                {deletingId === e.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ResponsiveTable>
              </div>
              )}
              <Pagination page={expensePg.page} total={expensePg.total} pageSize={expensePg.pageSize} onChange={expensePg.setPage} />
            </>
          )}
        </CardContent>
      </Card>

      {/* Add expense dialog */}
      <ResponsiveDialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) setForm(EMPTY_FORM); }}>
        <ResponsiveDialogContent className="border-sage/20 bg-white-warm sm:max-w-md">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="font-display text-charcoal">Add expense</ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="font-body text-charcoal/60">
              Record a cost paid offline (café meal, rent, supplies, a manual payout, etc.)
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-body text-xs text-charcoal/60">Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v as ExpenseCategoryValue }))}>
                  <SelectTrigger className="border-sage/20 bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{EXPENSE_CATEGORY_LABELS[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="font-body text-xs text-charcoal/60">Amount (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  inputMode="decimal"
                  placeholder="0"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  className="border-sage/20 bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-body text-xs text-charcoal/60">Date</Label>
                <DatePicker
                  value={form.incurredAt}
                  onChange={(v) => setForm((f) => ({ ...f, incurredAt: v }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-body text-xs text-charcoal/60">Method</Label>
                <Select value={form.method} onValueChange={(v) => setForm((f) => ({ ...f, method: v }))}>
                  <SelectTrigger className="border-sage/20 bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {METHOD_OPTIONS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="font-body text-xs text-charcoal/60">Payee / vendor</Label>
              <Input
                placeholder="e.g. Landlord, café guest name, supplier"
                value={form.payee}
                onChange={(e) => setForm((f) => ({ ...f, payee: e.target.value }))}
                className="border-sage/20 bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="font-body text-xs text-charcoal/60">Description</Label>
              <Input
                placeholder="What was this for?"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="border-sage/20 bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="font-body text-xs text-charcoal/60">Notes (optional)</Label>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="border-sage/20 bg-white resize-none"
              />
            </div>
          </div>

          <ResponsiveDialogFooter>
            <Button type="button" variant="outline" className="border-sage/20" onClick={() => setAddOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" variant="sage" onClick={submitExpense} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Save expense
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
}

export const ExpensesSection = memo(ExpensesSectionImpl);
export default ExpensesSection;
