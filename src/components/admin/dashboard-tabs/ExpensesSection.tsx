import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeIndianRupee,
  Loader2,
  Plus,
  Receipt,
  Trash2,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortableHeader, useTableSort } from "@/components/admin/sortable-table";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { StatusPill } from "@/components/ui/status-pill";
import { MetricCard } from "@/components/admin/MetricCard";
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

type PayoutDTO = {
  instructorId: string;
  name: string;
  classes: number;
  checkIns: number;
  total: number; // rupees
  status: "paid" | "pending";
  paidAt: string | null;
};

const METHOD_OPTIONS: { value: string; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "direct_upi", label: "UPI" },
  { value: "pine_lab_card", label: "Card (Pine Lab)" },
  { value: "pine_lab_upi", label: "UPI (Pine Lab)" },
  { value: "razorpay_online", label: "Razorpay" },
];
const METHOD_LABEL: Record<string, string> = Object.fromEntries(METHOD_OPTIONS.map((m) => [m.value, m.label]));

function rupeesFromPaise(p: number): string {
  return `₹${Math.round(p / 100).toLocaleString("en-IN")}`;
}
function rupees(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
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
  const [payouts, setPayouts] = useState<PayoutDTO[]>([]);
  const [payoutsLoading, setPayoutsLoading] = useState(true);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchExpenses = useCallback(async () => {
    const r = await fetch("/api/admin/expenses");
    if (!r.ok) return;
    const d = await r.json();
    if (Array.isArray(d.expenses)) setExpenses(d.expenses);
  }, []);

  const fetchPayouts = useCallback(async () => {
    const r = await fetch("/api/admin/instructor-payouts?window=month");
    if (!r.ok) return;
    const d = await r.json();
    if (Array.isArray(d.instructors)) setPayouts(d.instructors);
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await fetchExpenses();
      setLoading(false);
    })();
    void (async () => {
      setPayoutsLoading(true);
      await fetchPayouts();
      setPayoutsLoading(false);
    })();
  }, [fetchExpenses, fetchPayouts]);

  const totalPaise = useMemo(() => expenses.reduce((s, e) => s + e.amountPaise, 0), [expenses]);
  const pendingPayouts = useMemo(() => payouts.filter((p) => p.status !== "paid" && p.total > 0), [payouts]);
  const pendingPayoutTotal = useMemo(() => pendingPayouts.reduce((s, p) => s + p.total, 0), [pendingPayouts]);

  type ExpSortKey = "category" | "details" | "date" | "amount";
  const getExpSortValue = useCallback((e: ExpenseDTO, key: ExpSortKey): number | string => {
    switch (key) {
      case "category": return EXPENSE_CATEGORY_LABELS[e.category] ?? e.category;
      case "details": return (e.payee ?? e.description ?? "").toLowerCase();
      case "date": return e.incurredAtISO;
      case "amount": return e.amountPaise;
    }
  }, []);
  const { sorted: sortedExpenses, sortKey: expSortKey, sortDir: expSortDir, toggle: toggleExp } = useTableSort(
    expenses,
    {
      initialKey: "date",
      initialDir: "desc",
      getValue: getExpSortValue,
      defaultDirFor: (k) => (k === "category" || k === "details" ? "asc" : "desc"),
    },
  );
  const expensePg = usePagination(sortedExpenses, 10, `${expenses.length}|${expSortKey}|${expSortDir}`);

  const positivePayouts = useMemo(() => payouts.filter((p) => p.total > 0), [payouts]);
  type PaySortKey = "name" | "classes" | "checkIns" | "total" | "status";
  const getPaySortValue = useCallback((p: PayoutDTO, key: PaySortKey): number | string => {
    switch (key) {
      case "name": return p.name.toLowerCase();
      case "classes": return p.classes;
      case "checkIns": return p.checkIns;
      case "total": return p.total;
      case "status": return p.status;
    }
  }, []);
  const { sorted: sortedPayouts, sortKey: paySortKey, sortDir: paySortDir, toggle: togglePay } = useTableSort(
    positivePayouts,
    {
      initialKey: "total",
      initialDir: "desc",
      getValue: getPaySortValue,
      defaultDirFor: (k) => (k === "name" || k === "status" ? "asc" : "desc"),
    },
  );
  const payoutsPg = usePagination(sortedPayouts, 10, `${positivePayouts.length}|${paySortKey}|${paySortDir}`);

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
        await fetchPayouts();
      } finally {
        setDeletingId(null);
      }
    },
    [fetchExpenses, fetchPayouts],
  );

  const recordPayout = useCallback(
    async (p: PayoutDTO) => {
      setRecordingId(p.instructorId);
      try {
        const r = await fetch("/api/admin/instructor-payout-adjustment", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instructorId: p.instructorId,
            window: "month",
            paid: true,
            recordExpense: true,
            payout_paise: Math.round(p.total * 100),
          }),
        });
        if (!r.ok) {
          toast.error("Could not record payout.");
          return;
        }
        toast.success(`${p.name}'s payout recorded as an expense and marked paid.`);
        await fetchExpenses();
        await fetchPayouts();
      } finally {
        setRecordingId(null);
      }
    },
    [fetchExpenses, fetchPayouts],
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        <MetricCard label="Total Expenses" value={Math.round(totalPaise / 100)} prefix="₹" icon={TrendingDown} tone="terracotta" loading={loading} hint={`${expenses.length} recorded`} />
        <MetricCard label="Payouts Pending" value={Math.round(pendingPayoutTotal)} prefix="₹" icon={Wallet} tone="amber" loading={payoutsLoading} hint={`${pendingPayouts.length} this month`} />
        <MetricCard label="Recorded Payouts" value={expenses.filter((e) => e.isPayout).length} icon={BadgeIndianRupee} tone="sage" loading={loading} hint="moved to expenses" />
      </div>

      {/* Expense ledger */}
      <Card className="border-sage/20 bg-white-warm">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="font-display text-2xl text-charcoal">Expenses</CardTitle>
              <CardDescription className="font-body text-charcoal/60">Payouts, café meals, rent, and other costs</CardDescription>
            </div>
            <Button type="button" variant="sage" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Expense
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center font-body text-sm text-charcoal/40">Loading expenses…</div>
          ) : expenses.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="h-12 w-12 text-charcoal/20 mx-auto mb-3" />
              <div className="font-body text-charcoal/60">No expenses recorded yet</div>
              <Button variant="outline" size="sm" className="mt-4 border-sage/20 text-sage hover:bg-sage/5" onClick={() => setAddOpen(true)}>
                Add your first expense
              </Button>
            </div>
          ) : (
            <>
          <div className="rounded-xl border border-sage/15 bg-white-warm overflow-hidden">
            <ResponsiveTable>
              <Table>
                <TableHeader>
                  <TableRow className="bg-sage/5 hover:bg-sage/5 border-sage/10">
                    <SortableHeader sortKey="category" active={expSortKey} dir={expSortDir} onToggle={toggleExp} className="w-[132px]">Type</SortableHeader>
                    <SortableHeader sortKey="details" active={expSortKey} dir={expSortDir} onToggle={toggleExp}>Details</SortableHeader>
                    <SortableHeader sortKey="date" active={expSortKey} dir={expSortDir} onToggle={toggleExp} className="w-[120px]">Date</SortableHeader>
                    <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3 w-[120px]">Method</TableHead>
                    <SortableHeader sortKey="amount" active={expSortKey} dir={expSortDir} onToggle={toggleExp} className="w-[120px] text-right" align="right">Amount</SortableHeader>
                    <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3 w-[56px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expensePg.pageItems.map((e) => {
                    const ks = expenseCategoryStyle(e.category);
                    return (
                      <TableRow key={e.id} className="border-sage/10">
                        <TableCell className="px-5 py-4">
                          <span
                            className="inline-flex w-full max-w-[112px] items-center justify-center rounded-full border px-2.5 py-0.5 font-body text-[11px] font-medium whitespace-nowrap"
                            style={{ backgroundColor: ks.bg, color: ks.fg, borderColor: ks.border }}
                          >
                            {EXPENSE_CATEGORY_LABELS[e.category]}
                          </span>
                        </TableCell>
                        <TableCell className="px-5 py-4">
                          <div className="font-body text-sm text-charcoal line-clamp-2 [overflow-wrap:anywhere]">
                            {e.payee || e.description || EXPENSE_CATEGORY_LABELS[e.category]}
                          </div>
                          {e.description && e.payee ? (
                            <div className="font-body text-xs text-charcoal/45 line-clamp-1">{e.description}</div>
                          ) : null}
                        </TableCell>
                        <TableCell className="px-5 py-4 font-body text-sm text-charcoal/60 whitespace-nowrap">
                          {new Date(e.incurredAtISO).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
                        </TableCell>
                        <TableCell className="px-5 py-4">
                          {e.method ? (
                            <Badge variant="outline" className="border-charcoal/15 text-charcoal/60 font-body whitespace-nowrap">
                              {METHOD_LABEL[e.method] ?? e.method}
                            </Badge>
                          ) : (
                            <span className="font-body text-xs text-charcoal/30">—</span>
                          )}
                        </TableCell>
                        <TableCell className="px-5 py-4 text-right">
                          <span className="font-display text-base tabular-nums text-[#a05e38]">−{rupeesFromPaise(e.amountPaise)}</span>
                        </TableCell>
                        <TableCell className="px-5 py-4 text-right">
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
          <Pagination page={expensePg.page} total={expensePg.total} onChange={expensePg.setPage} />
            </>
          )}
        </CardContent>
      </Card>

      {/* This month's instructor payouts → record as expense */}
      <Card className="border-sage/20 bg-white-warm">
        <CardHeader>
          <CardTitle className="font-display text-xl text-charcoal">Instructor payouts · this month</CardTitle>
          <CardDescription className="font-body text-charcoal/60">
            Recording a payout marks it paid and moves it into expenses (one step, idempotent)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {payoutsLoading ? (
            <div className="py-8 text-center font-body text-sm text-charcoal/40">Loading payouts…</div>
          ) : positivePayouts.length === 0 ? (
            <div className="py-8 text-center font-body text-sm text-charcoal/40">No payouts this month.</div>
          ) : (
            <>
              <div className="rounded-xl border border-sage/15 bg-white-warm overflow-hidden">
                <ResponsiveTable>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-sage/5 hover:bg-sage/5 border-sage/10">
                        <SortableHeader sortKey="name" active={paySortKey} dir={paySortDir} onToggle={togglePay}>Instructor</SortableHeader>
                        <SortableHeader sortKey="classes" active={paySortKey} dir={paySortDir} onToggle={togglePay} className="w-[90px]">Classes</SortableHeader>
                        <SortableHeader sortKey="checkIns" active={paySortKey} dir={paySortDir} onToggle={togglePay} className="w-[100px]">Check-ins</SortableHeader>
                        <SortableHeader sortKey="total" active={paySortKey} dir={paySortDir} onToggle={togglePay} className="w-[120px] text-right" align="right">Payout</SortableHeader>
                        <SortableHeader sortKey="status" active={paySortKey} dir={paySortDir} onToggle={togglePay} className="w-[110px]">Status</SortableHeader>
                        <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3 w-[170px] text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payoutsPg.pageItems.map((p) => (
                        <TableRow key={p.instructorId} className="border-sage/10 hover:bg-sage/5">
                          <TableCell className="px-5 py-4">
                            <div className="font-body font-medium text-charcoal truncate max-w-[240px]">{p.name}</div>
                          </TableCell>
                          <TableCell className="px-5 py-4 font-body text-sm text-charcoal/70 tabular-nums">{p.classes}</TableCell>
                          <TableCell className="px-5 py-4 font-body text-sm text-charcoal/70 tabular-nums">{p.checkIns}</TableCell>
                          <TableCell className="px-5 py-4 text-right">
                            <span className="font-display text-base tabular-nums text-charcoal">{rupees(p.total)}</span>
                          </TableCell>
                          <TableCell className="px-5 py-4">
                            {p.status === "paid" ? (
                              <StatusPill tone="sage" dot>Paid</StatusPill>
                            ) : (
                              <StatusPill tone="amber" dot>Pending</StatusPill>
                            )}
                          </TableCell>
                          <TableCell className="px-5 py-4 text-right">
                            {p.status === "paid" ? (
                              <span className="font-body text-xs text-sage whitespace-nowrap">Recorded ✓</span>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="border-terracotta/30 text-[#a05e38] hover:bg-terracotta/10 font-body"
                                disabled={recordingId === p.instructorId}
                                onClick={() => recordPayout(p)}
                              >
                                {recordingId === p.instructorId ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Wallet className="h-4 w-4 mr-1.5" />}
                                Record as expense
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ResponsiveTable>
              </div>
              <Pagination page={payoutsPg.page} total={payoutsPg.total} onChange={payoutsPg.setPage} />
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
                <Input
                  type="date"
                  value={form.incurredAt}
                  onChange={(e) => setForm((f) => ({ ...f, incurredAt: e.target.value }))}
                  className="border-sage/20 bg-white"
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
