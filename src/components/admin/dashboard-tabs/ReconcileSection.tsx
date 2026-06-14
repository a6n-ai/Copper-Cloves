import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeftRight, BookOpen, Check, Download, Globe, Import, Landmark, Loader2, Package, RefreshCw, ScanSearch, Search, User } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
} from "@/components/responsive/ResponsiveDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MetricCard } from "@/components/admin/MetricCard";
import { Pagination, usePagination } from "@/components/Pagination";
import { Pill, type PillProps } from "@/components/ui/pill";
import { FilterDateRange } from "@/components/filters";
import type { DateRange } from "react-day-picker";
import type { ImportPaymentBody } from "@/pages/api/admin/finance/import-payment";
import type { RazorpayPaymentDetail } from "@/pages/api/admin/finance/razorpay-payment-detail";
import type { LookupResult, LookupPayment } from "@/pages/api/admin/finance/razorpay-lookup";
import type { FulfillPaymentBody } from "@/pages/api/admin/finance/fulfill-payment";
import type { ReconcileLogRow } from "@/pages/api/admin/finance/reconcile-log";

type SavedStatus = "done" | "in_progress" | "dropped" | "needs_refund";

const SAVED_STATUS_META: Record<SavedStatus, { label: string; tone: PillProps["tone"] }> = {
  done: { label: "Done", tone: "success" },
  in_progress: { label: "In progress", tone: "info" },
  dropped: { label: "Dropped", tone: "neutral" },
  needs_refund: { label: "Needs refund", tone: "warning" },
};

function fmtLogDate(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

type ReconMatch =
  | "matched"
  | "amount_mismatch"
  | "status_mismatch"
  | "missing_from_website"
  | "website_only"
  | "external";

type ReconRow = {
  paymentId: string;
  orderId: string | null;
  createdAtISO: string;
  amountPaise: number;
  amountRefundedPaise: number;
  method: string | null;
  razorpayStatus: string | null;
  websiteStatus: string | null;
  source: "website" | "external" | "unknown";
  match: ReconMatch;
  email: string | null;
  contact: string | null;
  description: string | null;
  notes: string;
};

type ReconResponse = {
  month: string;
  partial: boolean;
  rows: ReconRow[];
  summary: {
    total: number;
    counts: Record<ReconMatch, number>;
    razorpayCapturedPaise: number;
    websiteRecordedPaise: number;
    gapPaise: number;
  };
};

type LookupState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; result: LookupResult };

const MATCH_META: Record<ReconMatch, { label: string; tone: PillProps["tone"]; bad?: boolean }> = {
  matched: { label: "Matched", tone: "success" },
  external: { label: "External · Page", tone: "neutral" },
  amount_mismatch: { label: "Amount mismatch", tone: "warning", bad: true },
  status_mismatch: { label: "Status mismatch", tone: "warning", bad: true },
  missing_from_website: { label: "Missing from site", tone: "danger", bad: true },
  website_only: { label: "Not in Razorpay", tone: "danger", bad: true },
};

function inr(paise: number): string {
  return `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Local YYYY-MM-DD (no UTC shift) for the reconcile date-range query params. */
function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Default the picker to the current calendar month so the first pull is bounded. */
function currentMonthRange(): DateRange {
  const now = new Date();
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1),
    to: new Date(now.getFullYear(), now.getMonth() + 1, 0),
  };
}

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(rows: ReconRow[], month: string) {
  const header = [
    "Payment ID", "Order ID", "Date", "Amount (INR)", "Refunded (INR)", "Method",
    "Razorpay status", "Website status", "Source", "Match", "Email", "Contact", "Description", "Notes",
  ];
  const lines = rows.map((r) =>
    [
      r.paymentId, r.orderId ?? "", new Date(r.createdAtISO).toLocaleString("en-IN"),
      (r.amountPaise / 100).toFixed(2), (r.amountRefundedPaise / 100).toFixed(2), r.method ?? "",
      r.razorpayStatus ?? "", r.websiteStatus ?? "", r.source, MATCH_META[r.match].label,
      r.email ?? "", r.contact ?? "", r.description ?? "", r.notes,
    ].map(csvCell).join(","),
  );
  const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `razorpay-reconcile-${month}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Import dialog ────────────────────────────────────────────────────────────

type MemberResult = { id: string; full_name: string | null; email: string };
type PackageTypeResult = { id: string; name: string; type: string; class_count: number | null; duration_months: number | null; price: string; is_unlimited: boolean };
type ScheduleResult = { id: string; start_time: string; class_model: { name: string } | null; available_spots: number; status: string };

type ImportStep = 1 | 2 | 3;

/** Read-only Razorpay payment-detail panel — shared by ImportDialog (step 1) and DetailDialog. */
function PaymentDetailPanel({
  detail: rzpDetail,
  row,
  loading: detailLoading,
  error: detailError,
}: {
  detail: RazorpayPaymentDetail | null;
  row: ReconRow;
  loading: boolean;
  error: string | null;
}) {
  return (
    <div className="space-y-3">
      {detailLoading && (
        <div className="flex items-center justify-center gap-2 py-10 text-charcoal/40">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="font-body text-sm">Fetching from Razorpay…</span>
        </div>
      )}

      {detailError && !detailLoading && (
        <div className="rounded-xl border border-[#cf5b48]/30 bg-[#cf5b48]/5 px-4 py-3">
          <p className="font-body text-sm text-[#cf5b48]">{detailError}</p>
          <p className="font-body text-xs text-charcoal/50 mt-1">Showing cached data from last reconcile run.</p>
        </div>
      )}

      {!detailLoading && (
        <div className="rounded-xl border border-sage/15 bg-sand/40 p-4 space-y-2.5">
          <div className="flex justify-between items-center">
            <span className="font-body text-xs text-charcoal/50 uppercase tracking-wide">Amount</span>
            <span className="font-display text-xl tabular-nums text-charcoal">
              {inr(rzpDetail?.amount ?? row.amountPaise)}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="font-body text-xs text-charcoal/50 uppercase tracking-wide">Status</span>
            <span className="font-body text-sm text-charcoal/80 capitalize">
              {rzpDetail?.status ?? row.razorpayStatus ?? "—"}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="font-body text-xs text-charcoal/50 uppercase tracking-wide">Date</span>
            <span className="font-body text-sm text-charcoal/80">
              {rzpDetail
                ? new Date(rzpDetail.created_at * 1000).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })
                : new Date(row.createdAtISO).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}
            </span>
          </div>

          {(rzpDetail?.method ?? row.method) && (
            <div className="flex justify-between items-center">
              <span className="font-body text-xs text-charcoal/50 uppercase tracking-wide">Method</span>
              <span className="font-body text-sm text-charcoal/80 capitalize">{rzpDetail?.method ?? row.method}</span>
            </div>
          )}

          {(rzpDetail?.email ?? row.email) && (
            <div className="flex justify-between items-center">
              <span className="font-body text-xs text-charcoal/50 uppercase tracking-wide">Email</span>
              <span className="font-body text-sm text-charcoal/80">{rzpDetail?.email ?? row.email}</span>
            </div>
          )}

          {(rzpDetail?.contact ?? row.contact) && (
            <div className="flex justify-between items-center">
              <span className="font-body text-xs text-charcoal/50 uppercase tracking-wide">Phone</span>
              <span className="font-body text-sm text-charcoal/80">{rzpDetail?.contact ?? row.contact}</span>
            </div>
          )}

          {(rzpDetail?.amount_refunded ?? 0) > 0 && (
            <div className="flex justify-between items-center">
              <span className="font-body text-xs text-charcoal/50 uppercase tracking-wide">Refunded</span>
              <span className="font-body text-sm text-[#a05e38]">−{inr(rzpDetail?.amount_refunded)}</span>
            </div>
          )}

          {/* Gateway detail rows — only render the ones Razorpay returned. */}
          {([
            ["Bank", rzpDetail?.bank],
            ["Wallet", rzpDetail?.wallet],
            ["UPI VPA", rzpDetail?.vpa],
            ["Card", rzpDetail?.card_last4 ? `${rzpDetail?.card_network ?? "card"} ••${rzpDetail.card_last4}${rzpDetail.card_type ? ` (${rzpDetail.card_type})` : ""}` : null],
            ["RRN", rzpDetail?.rrn],
            ["Gateway fee", rzpDetail?.fee != null ? inr(rzpDetail.fee) : null],
            ["Tax", rzpDetail?.tax != null ? inr(rzpDetail.tax) : null],
            ["Refund status", rzpDetail?.refund_status],
            ["Error", rzpDetail?.error_description],
          ] as const)
            .filter(([, v]) => v != null && v !== "")
            .map(([label, v]) => (
              <div key={label} className="flex justify-between items-start gap-4">
                <span className="font-body text-xs text-charcoal/50 uppercase tracking-wide shrink-0">{label}</span>
                <span className="font-body text-sm text-charcoal/70 text-right break-all capitalize">{v}</span>
              </div>
            ))}

          {(rzpDetail?.description ?? row.description) && (
            <div className="flex justify-between items-start gap-4">
              <span className="font-body text-xs text-charcoal/50 uppercase tracking-wide shrink-0">Desc</span>
              <span className="font-body text-sm text-charcoal/70 text-right line-clamp-2">
                {rzpDetail?.description ?? row.description}
              </span>
            </div>
          )}

          {rzpDetail?.order_id && (
            <div className="pt-2 border-t border-sage/10 space-y-1.5">
              <span className="font-body text-xs text-charcoal/40 uppercase tracking-wide">Order</span>
              {rzpDetail.order_receipt && (
                <div className="flex justify-between items-center">
                  <span className="font-body text-xs text-charcoal/50 uppercase tracking-wide">Receipt</span>
                  <span className="font-body text-sm text-charcoal/80">{rzpDetail.order_receipt}</span>
                </div>
              )}
              {rzpDetail.order_status && (
                <div className="flex justify-between items-center">
                  <span className="font-body text-xs text-charcoal/50 uppercase tracking-wide">Order status</span>
                  <span className="font-body text-sm text-charcoal/80 capitalize">{rzpDetail.order_status}</span>
                </div>
              )}
            </div>
          )}

          {rzpDetail?.notes && Object.keys(rzpDetail.notes).length > 0 && (
            <div className="pt-2 border-t border-sage/10 space-y-1">
              <span className="font-body text-xs text-charcoal/40 uppercase tracking-wide">Notes</span>
              {Object.entries(rzpDetail.notes).map(([k, v]) => (
                <div key={k} className="flex justify-between items-start gap-4">
                  <span className="font-mono text-xs text-charcoal/40 shrink-0">{k}</span>
                  <span className="font-body text-xs text-charcoal/60 text-right break-all">{v}</span>
                </div>
              ))}
            </div>
          )}

          {rzpDetail?.order_notes && Object.keys(rzpDetail.order_notes).length > 0 && (
            <div className="pt-2 border-t border-sage/10 space-y-1">
              <span className="font-body text-xs text-charcoal/40 uppercase tracking-wide">Order notes</span>
              {Object.entries(rzpDetail.order_notes).map(([k, v]) => (
                <div key={k} className="flex justify-between items-start gap-4">
                  <span className="font-mono text-xs text-charcoal/40 shrink-0">{k}</span>
                  <span className="font-body text-xs text-charcoal/60 text-right break-all">{v}</span>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2 border-t border-sage/10 flex flex-wrap gap-x-4 gap-y-1">
            <span className="font-mono text-xs text-charcoal/35">{row.paymentId}</span>
            {rzpDetail?.order_id && (
              <span className="font-mono text-xs text-charcoal/25">{rzpDetail.order_id}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ImportDialog({ row, onClose, onImported }: { row: ReconRow; onClose: () => void; onImported: (paymentId: string) => void }) {
  const [step, setStep] = useState<ImportStep>(1);
  const [memberQuery, setMemberQuery] = useState(row.email ?? "");
  const [memberResults, setMemberResults] = useState<MemberResult[]>([]);
  const [selectedMember, setSelectedMember] = useState<MemberResult | null>(null);
  const [intent, setIntent] = useState<"none" | "booking" | "package">("none");
  const [schedules, setSchedules] = useState<ScheduleResult[]>([]);
  const [schedulesLoaded, setSchedulesLoaded] = useState(false);
  const [scheduleQuery, setScheduleQuery] = useState("");
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleResult | null>(null);
  const [packages, setPackages] = useState<PackageTypeResult[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<PackageTypeResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [rzpDetail, setRzpDetail] = useState<RazorpayPaymentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState<string | null>(null);
  const memberDebounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    fetch(`/api/admin/finance/razorpay-payment-detail?paymentId=${encodeURIComponent(row.paymentId)}`)
      .then((r) => r.json())
      .then((d: RazorpayPaymentDetail & { error?: string }) => {
        if (d.error) { setDetailError(d.error); return; }
        setRzpDetail(d);
        if (d.email && d.email !== memberQuery) setMemberQuery(d.email);
      })
      .catch(() => setDetailError("Could not reach Razorpay."))
      .finally(() => setDetailLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Member typeahead
  useEffect(() => {
    clearTimeout(memberDebounce.current);
    if (!memberQuery.trim()) { setMemberResults([]); return; }
    memberDebounce.current = setTimeout(async () => {
      const r = await fetch(`/api/admin/members-search?q=${encodeURIComponent(memberQuery)}`);
      if (r.ok) setMemberResults(await r.json());
    }, 250);
    return () => clearTimeout(memberDebounce.current);
  }, [memberQuery]);

  // Load schedules + packages when reaching step 3
  useEffect(() => {
    if (step !== 3) return;
    const now = Date.now();
    const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;
    const thirtyDaysAhead = now + 30 * 24 * 60 * 60 * 1000;
    fetch(`/api/class-schedules?fromMs=${ninetyDaysAgo}&toMs=${thirtyDaysAhead}`)
      .then((r) => r.ok ? r.json() : [])
      .then((rows) => { setSchedules(rows); setSchedulesLoaded(true); })
      .catch(() => setSchedulesLoaded(true));
    fetch("/api/packages")
      .then((r) => r.ok ? r.json() : [])
      .then(setPackages)
      .catch(() => {});
  }, [step]);

  const filteredSchedules = useMemo(() => {
    const q = scheduleQuery.toLowerCase();
    return schedules.filter(
      (s) => !q || s.class_model?.name.toLowerCase().includes(q) || new Date(s.start_time).toLocaleDateString("en-IN").includes(q),
    );
  }, [schedules, scheduleQuery]);

  async function handleConfirm() {
    if (!selectedMember) return;
    setSubmitting(true);
    try {
      const body: ImportPaymentBody = {
        paymentId: row.paymentId,
        amountPaise: rzpDetail?.amount ?? row.amountPaise,
        razorpayMethod: rzpDetail?.method ?? row.method,
        createdAtISO: rzpDetail
          ? new Date(rzpDetail.created_at * 1000).toISOString()
          : row.createdAtISO,
        userId: selectedMember.id,
        intent,
        classScheduleId: intent === "booking" ? selectedSchedule?.id : undefined,
        packageTypeId: intent === "package" ? selectedPackage?.id : undefined,
      };
      const res = await fetch("/api/admin/finance/import-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Import failed.");
        return;
      }
      toast.success(data.alreadyDone ? "Already reconciled — added to log." : "Payment imported successfully.");
      onImported(row.paymentId);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  const canAdvanceStep2 = !!selectedMember;
  const canConfirm =
    selectedMember &&
    (intent === "none" || (intent === "booking" && selectedSchedule) || (intent === "package" && selectedPackage));

  return (
    <ResponsiveDialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <ResponsiveDialogContent className="max-w-lg">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="font-display text-xl text-charcoal">
            Import payment
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="font-body text-charcoal/60">
            Step {step} of 3 — {step === 1 ? "Confirm details" : step === 2 ? "Find member" : "What for?"}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-2 px-6 pb-2">
          {([1, 2, 3] as ImportStep[]).map((s) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${step >= s ? "bg-sage" : "bg-sage/15"}`} />
          ))}
        </div>

        <div className="px-6 pb-2 space-y-4">
          {/* ── Step 1: Payment info ── */}
          {step === 1 && (
            <div className="space-y-3">
              <PaymentDetailPanel detail={rzpDetail} row={row} loading={detailLoading} error={detailError} />
              <p className="font-body text-xs text-charcoal/50">
                This payment was captured by Razorpay but never saved on our side. Importing records it in the payment ledger and can optionally book a class or assign a package.
              </p>
            </div>
          )}

          {/* ── Step 2: Member search ── */}
          {step === 2 && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="font-body text-xs text-charcoal/60">Search member by name or email</Label>
                <Input
                  autoFocus
                  value={memberQuery}
                  onChange={(e) => { setMemberQuery(e.target.value); setSelectedMember(null); }}
                  placeholder="e.g. Priya or priya@example.com"
                  className="border-sage/20 bg-white font-body"
                />
              </div>
              {memberResults.length > 0 && !selectedMember && (
                <div className="rounded-xl border border-sage/15 bg-white-warm divide-y divide-sage/10 max-h-48 overflow-y-auto">
                  {memberResults.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => { setSelectedMember(m); setMemberResults([]); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-sage/5 transition-colors"
                    >
                      <User className="h-4 w-4 text-charcoal/30 shrink-0" />
                      <div>
                        <div className="font-body text-sm text-charcoal">{m.full_name || "—"}</div>
                        <div className="font-body text-xs text-charcoal/50">{m.email}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {selectedMember && (
                <div className="flex items-center justify-between rounded-xl border border-sage/30 bg-sage/5 px-4 py-3">
                  <div>
                    <div className="font-body text-sm font-medium text-charcoal">{selectedMember.full_name || "—"}</div>
                    <div className="font-body text-xs text-charcoal/50">{selectedMember.email}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelectedMember(null); setMemberQuery(""); }}
                    className="font-body text-xs text-charcoal/40 hover:text-charcoal/70 transition-colors"
                  >
                    Change
                  </button>
                </div>
              )}
              {memberQuery.trim() && memberResults.length === 0 && !selectedMember && (
                <p className="font-body text-xs text-charcoal/45">No members found. Check spelling or ask the member to sign up first.</p>
              )}
            </div>
          )}

          {/* ── Step 3: Intent ── */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="font-body text-xs text-charcoal/60">What is this payment for?</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(["none", "booking", "package"] as const).map((opt) => {
                    const icons = { none: <Check className="h-4 w-4" />, booking: <BookOpen className="h-4 w-4" />, package: <Package className="h-4 w-4" /> };
                    const labels = { none: "Just record", booking: "Book a class", package: "Assign package" };
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => { setIntent(opt); setSelectedSchedule(null); setSelectedPackage(null); }}
                        className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-center transition-colors ${
                          intent === opt
                            ? "border-sage bg-sage/10 text-sage"
                            : "border-sage/20 bg-white-warm text-charcoal/60 hover:bg-sage/5"
                        }`}
                      >
                        {icons[opt]}
                        <span className="font-body text-xs font-medium leading-tight">{labels[opt]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {intent === "booking" && (
                <div className="space-y-2">
                  <Label className="font-body text-xs text-charcoal/60">Search class (past 90 days or upcoming)</Label>
                  <Input
                    value={scheduleQuery}
                    onChange={(e) => { setScheduleQuery(e.target.value); setSelectedSchedule(null); }}
                    placeholder="Filter by class name or date…"
                    className="border-sage/20 bg-white font-body"
                  />
                  {!schedulesLoaded && schedules.length === 0 && (
                    <p className="font-body text-xs text-charcoal/40">Loading schedules…</p>
                  )}
                  {schedulesLoaded && schedules.length === 0 && (
                    <p className="font-body text-xs text-charcoal/40">No upcoming classes in the next 30 days.</p>
                  )}
                  {filteredSchedules.length > 0 && !selectedSchedule && (
                    <div className="rounded-xl border border-sage/15 bg-white-warm divide-y divide-sage/10 max-h-44 overflow-y-auto">
                      {filteredSchedules.slice(0, 20).map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSelectedSchedule(s)}
                          className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-sage/5 transition-colors"
                        >
                          <div>
                            <div className="font-body text-sm text-charcoal">{s.class_model?.name ?? "—"}</div>
                            <div className="font-body text-xs text-charcoal/50">
                              {new Date(s.start_time).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                            </div>
                          </div>
                          <span className="font-body text-xs text-charcoal/40 shrink-0">{s.available_spots} spots</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedSchedule && (
                    <div className="flex items-center justify-between rounded-xl border border-sage/30 bg-sage/5 px-4 py-3">
                      <div>
                        <div className="font-body text-sm font-medium text-charcoal">{selectedSchedule.class_model?.name ?? "—"}</div>
                        <div className="font-body text-xs text-charcoal/50">
                          {new Date(selectedSchedule.start_time).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}
                        </div>
                      </div>
                      <button type="button" onClick={() => setSelectedSchedule(null)} className="font-body text-xs text-charcoal/40 hover:text-charcoal/70 transition-colors">Change</button>
                    </div>
                  )}
                </div>
              )}

              {intent === "package" && (
                <div className="space-y-2">
                  <Label className="font-body text-xs text-charcoal/60">Select package</Label>
                  {packages.length === 0 && <p className="font-body text-xs text-charcoal/40">Loading packages…</p>}
                  <div className="rounded-xl border border-sage/15 bg-white-warm divide-y divide-sage/10 max-h-44 overflow-y-auto">
                    {packages.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedPackage(p)}
                        className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors ${
                          selectedPackage?.id === p.id ? "bg-sage/10" : "hover:bg-sage/5"
                        }`}
                      >
                        <div>
                          <div className="font-body text-sm text-charcoal">{p.name}</div>
                          <div className="font-body text-xs text-charcoal/50">
                            {p.is_unlimited ? "Unlimited" : `${p.class_count ?? "?"} classes`}
                            {p.duration_months ? ` · ${p.duration_months}mo` : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-body text-sm text-charcoal/70">₹{Number(p.price).toLocaleString("en-IN")}</span>
                          {selectedPackage?.id === p.id && <Check className="h-4 w-4 text-sage" />}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <ResponsiveDialogFooter className="px-6 pb-6 gap-2">
          {step > 1 && (
            <Button type="button" variant="outline" className="border-sage/20 text-charcoal/60" onClick={() => setStep((s) => (s - 1) as ImportStep)} disabled={submitting}>
              Back
            </Button>
          )}
          <Button type="button" variant="ghost" className="text-charcoal/50 mr-auto" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          {step < 3 ? (
            <Button
              type="button"
              variant="sage"
              onClick={() => setStep((s) => (s + 1) as ImportStep)}
              disabled={(step === 1 && detailLoading) || (step === 2 && !canAdvanceStep2)}
            >
              Next
            </Button>
          ) : (
            <Button type="button" variant="sage" onClick={handleConfirm} disabled={!canConfirm || submitting}>
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Import className="h-4 w-4 mr-2" />}
              {submitting ? "Importing…" : "Import"}
            </Button>
          )}
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

// ─── Detail dialog (read-only) ─────────────────────────────────────────────────

function DetailDialog({
  row,
  onClose,
  onImport,
  onChanged,
  isHandled = false,
  savedStatus,
  savedNote,
}: {
  row: ReconRow;
  onClose: () => void;
  onImport: (row: ReconRow) => void;
  onChanged?: () => void;
  isHandled?: boolean;
  savedStatus?: SavedStatus;
  savedNote?: string | null;
}) {
  const [detail, setDetail] = useState<RazorpayPaymentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [pendingStatus, setPendingStatus] = useState<SavedStatus | "move_back" | null>(null);

  async function setStatus(status: SavedStatus) {
    setPendingStatus(status);
    try {
      const res = await fetch("/api/admin/finance/reconcile-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: row.paymentId,
          orderId: row.orderId ?? undefined,
          status,
          amountPaise: row.amountPaise,
          note: note.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Could not save status."); return; }
      toast.success(`Marked as ${SAVED_STATUS_META[status].label.toLowerCase()}`);
      onChanged?.();
      onClose();
    } catch {
      toast.error("Could not reach the server.");
    } finally {
      setPendingStatus(null);
    }
  }

  async function moveBack() {
    setPendingStatus("move_back");
    try {
      const res = await fetch("/api/admin/finance/reconcile-status", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: row.paymentId }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Could not move back."); return; }
      toast.success("Moved back to reconcile.");
      onChanged?.();
      onClose();
    } catch {
      toast.error("Could not reach the server.");
    } finally {
      setPendingStatus(null);
    }
  }

  const busy = pendingStatus !== null;

  useEffect(() => {
    fetch(`/api/admin/finance/razorpay-payment-detail?paymentId=${encodeURIComponent(row.paymentId)}`)
      .then((r) => r.json())
      .then((d: RazorpayPaymentDetail & { error?: string }) => {
        if (d.error) { setError(d.error); return; }
        setDetail(d);
      })
      .catch(() => setError("Could not reach Razorpay."))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const meta = MATCH_META[row.match];

  return (
    <ResponsiveDialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <ResponsiveDialogContent className="max-w-lg">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="font-display text-xl text-charcoal">Payment detail</ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="font-body text-charcoal/60">
            <span className="font-mono text-xs">{row.paymentId}</span>
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="px-6 pb-2 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {isHandled && savedStatus ? (
              <Pill tone={SAVED_STATUS_META[savedStatus].tone} size="sm">{SAVED_STATUS_META[savedStatus].label}</Pill>
            ) : (
              <Pill tone={meta.tone} size="sm">{meta.label}</Pill>
            )}
            {!isHandled && row.websiteStatus && (
              <span className="font-body text-xs text-charcoal/50">Site: {row.websiteStatus}</span>
            )}
          </div>
          <PaymentDetailPanel detail={detail} row={row} loading={loading} error={error} />

          {!isHandled && (
            <div className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <Label className="font-body text-xs text-charcoal/60">Note (optional — saved with the status)</Label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Reason, e.g. refunded outside the app, duplicate charge…"
                  rows={2}
                  className="border-sage/20 bg-white font-body text-sm resize-none"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-body text-xs text-charcoal/60">Mark this payment as</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(["in_progress", "dropped", "needs_refund"] as const).map((s) => (
                    <Button
                      key={s}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 border-sage/25 text-charcoal/70 hover:bg-sage/5"
                      onClick={() => setStatus(s)}
                      disabled={busy}
                    >
                      {pendingStatus === s ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : SAVED_STATUS_META[s].label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {isHandled && savedNote && (
            <div className="rounded-xl border border-sage/15 bg-sand/40 px-4 py-2.5">
              <span className="font-body text-xs text-charcoal/45 uppercase tracking-wide">Note</span>
              <p className="font-body text-sm text-charcoal/70 mt-0.5">{savedNote}</p>
            </div>
          )}
        </div>

        <ResponsiveDialogFooter className="px-6 pb-6 gap-2">
          <Button type="button" variant="ghost" className="text-charcoal/50 mr-auto" onClick={onClose} disabled={busy}>
            Close
          </Button>
          {isHandled && (
            <Button type="button" variant="outline" className="border-sage/25 text-charcoal/70 hover:bg-sage/5" onClick={moveBack} disabled={busy}>
              {pendingStatus === "move_back" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowLeftRight className="h-4 w-4 mr-2" />}
              Move back to reconcile
            </Button>
          )}
          {!isHandled && row.match === "missing_from_website" && (
            <Button type="button" variant="sage" onClick={() => onImport(row)} disabled={busy}>
              <Import className="h-4 w-4 mr-2" />
              Import / fulfill
            </Button>
          )}
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

// ─── Fulfill dialog ───────────────────────────────────────────────────────────

function FulfillDialog({
  result,
  primaryPayment,
  onClose,
  onFulfilled,
}: {
  result: LookupResult;
  primaryPayment: LookupPayment;
  onClose: () => void;
  onFulfilled: () => void;
}) {
  const [step, setStep] = useState<2 | 3>(2);
  const [memberQuery, setMemberQuery] = useState(primaryPayment.email ?? "");
  const [memberResults, setMemberResults] = useState<MemberResult[]>([]);
  const [selectedMember, setSelectedMember] = useState<MemberResult | null>(null);
  const [intent, setIntent] = useState<"booking" | "package">("booking");
  const [schedules, setSchedules] = useState<ScheduleResult[]>([]);
  const [schedulesLoaded, setSchedulesLoaded] = useState(false);
  const [scheduleQuery, setScheduleQuery] = useState("");
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleResult | null>(null);
  const [packages, setPackages] = useState<PackageTypeResult[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<PackageTypeResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const memberDebounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(memberDebounce.current);
    if (!memberQuery.trim()) { setMemberResults([]); return; }
    memberDebounce.current = setTimeout(async () => {
      const r = await fetch(`/api/admin/members-search?q=${encodeURIComponent(memberQuery)}`);
      if (r.ok) setMemberResults(await r.json());
    }, 250);
    return () => clearTimeout(memberDebounce.current);
  }, [memberQuery]);

  useEffect(() => {
    if (step !== 3) return;
    const now = Date.now();
    fetch(`/api/class-schedules?fromMs=${now - 90 * 24 * 60 * 60 * 1000}&toMs=${now + 30 * 24 * 60 * 60 * 1000}`)
      .then((r) => r.ok ? r.json() : [])
      .then((rows) => { setSchedules(rows); setSchedulesLoaded(true); })
      .catch(() => setSchedulesLoaded(true));
    fetch("/api/packages")
      .then((r) => r.ok ? r.json() : [])
      .then(setPackages)
      .catch(() => {});
  }, [step]);

  const filteredSchedules = useMemo(() => {
    const q = scheduleQuery.toLowerCase();
    return schedules.filter(
      (s) => !q || s.class_model?.name.toLowerCase().includes(q) || new Date(s.start_time).toLocaleDateString("en-IN").includes(q),
    );
  }, [schedules, scheduleQuery]);

  async function handleFulfill() {
    if (!selectedMember || !result.internalPaymentId) return;
    setSubmitting(true);
    try {
      const body: FulfillPaymentBody = {
        internalPaymentId: result.internalPaymentId,
        userId: selectedMember.id,
        intent,
        classScheduleId: intent === "booking" ? selectedSchedule?.id : undefined,
        packageTypeId: intent === "package" ? selectedPackage?.id : undefined,
      };
      const res = await fetch("/api/admin/finance/fulfill-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Fulfill failed."); return; }
      toast.success("Payment fulfilled — booking/package linked.");
      onFulfilled();
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  const canConfirm =
    selectedMember &&
    ((intent === "booking" && selectedSchedule) || (intent === "package" && selectedPackage));

  return (
    <ResponsiveDialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <ResponsiveDialogContent className="max-w-lg">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="font-display text-xl text-charcoal">Fulfill payment</ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="font-body text-charcoal/60">
            Step {step === 2 ? 1 : 2} of 2 — {step === 2 ? "Find member" : "What for?"}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="flex items-center gap-2 px-6 pb-2">
          {([2, 3] as const).map((s) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${step >= s ? "bg-sage" : "bg-sage/15"}`} />
          ))}
        </div>

        <div className="px-6 pb-2 space-y-4">
          {step === 2 && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="font-body text-xs text-charcoal/60">Search member by name or email</Label>
                <Input
                  autoFocus
                  value={memberQuery}
                  onChange={(e) => { setMemberQuery(e.target.value); setSelectedMember(null); }}
                  placeholder="e.g. Michael or michael@example.com"
                  className="border-sage/20 bg-white font-body"
                />
              </div>
              {memberResults.length > 0 && !selectedMember && (
                <div className="rounded-xl border border-sage/15 bg-white-warm divide-y divide-sage/10 max-h-48 overflow-y-auto">
                  {memberResults.map((m) => (
                    <button key={m.id} type="button" onClick={() => { setSelectedMember(m); setMemberResults([]); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-sage/5 transition-colors">
                      <User className="h-4 w-4 text-charcoal/30 shrink-0" />
                      <div>
                        <div className="font-body text-sm text-charcoal">{m.full_name || "—"}</div>
                        <div className="font-body text-xs text-charcoal/50">{m.email}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {selectedMember && (
                <div className="flex items-center justify-between rounded-xl border border-sage/30 bg-sage/5 px-4 py-3">
                  <div>
                    <div className="font-body text-sm font-medium text-charcoal">{selectedMember.full_name || "—"}</div>
                    <div className="font-body text-xs text-charcoal/50">{selectedMember.email}</div>
                  </div>
                  <button type="button" onClick={() => { setSelectedMember(null); setMemberQuery(""); }}
                    className="font-body text-xs text-charcoal/40 hover:text-charcoal/70 transition-colors">Change</button>
                </div>
              )}
              {memberQuery.trim() && memberResults.length === 0 && !selectedMember && (
                <p className="font-body text-xs text-charcoal/45">No members found.</p>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="font-body text-xs text-charcoal/60">What is this payment for?</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(["booking", "package"] as const).map((opt) => {
                    const icons = { booking: <BookOpen className="h-4 w-4" />, package: <Package className="h-4 w-4" /> };
                    const labels = { booking: "Book a class", package: "Assign package" };
                    return (
                      <button key={opt} type="button" onClick={() => { setIntent(opt); setSelectedSchedule(null); setSelectedPackage(null); }}
                        className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-center transition-colors ${
                          intent === opt ? "border-sage bg-sage/10 text-sage" : "border-sage/20 bg-white-warm text-charcoal/60 hover:bg-sage/5"
                        }`}>
                        {icons[opt]}
                        <span className="font-body text-xs font-medium leading-tight">{labels[opt]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {intent === "booking" && (
                <div className="space-y-2">
                  <Label className="font-body text-xs text-charcoal/60">Search class (past 90 days or upcoming)</Label>
                  <Input value={scheduleQuery} onChange={(e) => { setScheduleQuery(e.target.value); setSelectedSchedule(null); }}
                    placeholder="Filter by class name or date…" className="border-sage/20 bg-white font-body" />
                  {!schedulesLoaded && <p className="font-body text-xs text-charcoal/40">Loading schedules…</p>}
                  {schedulesLoaded && schedules.length === 0 && <p className="font-body text-xs text-charcoal/40">No classes found.</p>}
                  {filteredSchedules.length > 0 && !selectedSchedule && (
                    <div className="rounded-xl border border-sage/15 bg-white-warm divide-y divide-sage/10 max-h-44 overflow-y-auto">
                      {filteredSchedules.slice(0, 20).map((s) => (
                        <button key={s.id} type="button" onClick={() => setSelectedSchedule(s)}
                          className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-sage/5 transition-colors">
                          <div>
                            <div className="font-body text-sm text-charcoal">{s.class_model?.name ?? "—"}</div>
                            <div className="font-body text-xs text-charcoal/50">
                              {new Date(s.start_time).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                            </div>
                          </div>
                          <span className="font-body text-xs text-charcoal/40 shrink-0">{s.available_spots} spots</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedSchedule && (
                    <div className="flex items-center justify-between rounded-xl border border-sage/30 bg-sage/5 px-4 py-3">
                      <div>
                        <div className="font-body text-sm font-medium text-charcoal">{selectedSchedule.class_model?.name ?? "—"}</div>
                        <div className="font-body text-xs text-charcoal/50">
                          {new Date(selectedSchedule.start_time).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}
                        </div>
                      </div>
                      <button type="button" onClick={() => setSelectedSchedule(null)} className="font-body text-xs text-charcoal/40 hover:text-charcoal/70 transition-colors">Change</button>
                    </div>
                  )}
                </div>
              )}

              {intent === "package" && (
                <div className="space-y-2">
                  <Label className="font-body text-xs text-charcoal/60">Select package</Label>
                  {packages.length === 0 && <p className="font-body text-xs text-charcoal/40">Loading packages…</p>}
                  <div className="rounded-xl border border-sage/15 bg-white-warm divide-y divide-sage/10 max-h-44 overflow-y-auto">
                    {packages.map((p) => (
                      <button key={p.id} type="button" onClick={() => setSelectedPackage(p)}
                        className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors ${selectedPackage?.id === p.id ? "bg-sage/10" : "hover:bg-sage/5"}`}>
                        <div>
                          <div className="font-body text-sm text-charcoal">{p.name}</div>
                          <div className="font-body text-xs text-charcoal/50">
                            {p.is_unlimited ? "Unlimited" : `${p.class_count ?? "?"} classes`}{p.duration_months ? ` · ${p.duration_months}mo` : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-body text-sm text-charcoal/70">₹{Number(p.price).toLocaleString("en-IN")}</span>
                          {selectedPackage?.id === p.id && <Check className="h-4 w-4 text-sage" />}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <ResponsiveDialogFooter className="px-6 pb-6 gap-2">
          {step === 3 && (
            <Button type="button" variant="outline" className="border-sage/20 text-charcoal/60" onClick={() => setStep(2)} disabled={submitting}>
              Back
            </Button>
          )}
          <Button type="button" variant="ghost" className="text-charcoal/50 mr-auto" onClick={onClose} disabled={submitting}>Cancel</Button>
          {step === 2 ? (
            <Button type="button" variant="sage" onClick={() => setStep(3)} disabled={!selectedMember}>Next</Button>
          ) : (
            <Button type="button" variant="sage" onClick={handleFulfill} disabled={!canConfirm || submitting}>
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              {submitting ? "Fulfilling…" : "Fulfill"}
            </Button>
          )}
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

// ─── Lookup card ──────────────────────────────────────────────────────────────

function LookupCard() {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<LookupState>({ status: "idle" });
  const [fulfillTarget, setFulfillTarget] = useState<{ result: LookupResult; payment: LookupPayment } | null>(null);
  const [importTarget, setImportTarget] = useState<ReconRow | null>(null);
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());
  const [fulfilledIds, setFulfilledIds] = useState<Set<string>>(new Set());

  async function handleSearch() {
    const id = query.trim();
    if (!id.startsWith("pay_") && !id.startsWith("order_")) {
      toast.error("ID must start with pay_ or order_");
      return;
    }
    setState({ status: "loading" });
    try {
      const r = await fetch(`/api/admin/finance/razorpay-lookup?id=${encodeURIComponent(id)}`);
      const d = await r.json();
      if (!r.ok) { setState({ status: "error", message: d.error ?? "Lookup failed." }); return; }
      setState({ status: "done", result: d as LookupResult });
    } catch {
      setState({ status: "error", message: "Could not reach the lookup endpoint." });
    }
  }

  function resultToReconRow(payment: LookupPayment, result: LookupResult): ReconRow {
    return {
      paymentId: payment.id,
      orderId: result.orderId,
      createdAtISO: new Date(payment.createdAt * 1000).toISOString(),
      amountPaise: payment.amountPaise,
      amountRefundedPaise: payment.amountRefundedPaise,
      method: payment.method,
      razorpayStatus: payment.status,
      websiteStatus: null,
      source: "website",
      match: "missing_from_website",
      email: payment.email,
      contact: payment.contact,
      description: payment.description,
      notes: payment.notes ? Object.entries(payment.notes).map(([k, v]) => `${k}=${v}`).join("; ") : "",
    };
  }

  const primaryPayment =
    state.status === "done"
      ? (state.result.payments.find((p) => p.status === "captured" || p.status === "authorized") ?? state.result.payments[0])
      : null;

  return (
    <>
      <Card className="border-sage/20 bg-white-warm">
        <CardHeader>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <CardTitle className="font-display text-2xl text-charcoal">Lookup by ID</CardTitle>
              <CardDescription className="font-body text-charcoal/60">
                Find a specific payment or order — enter a <span className="font-mono text-xs">pay_*</span> or <span className="font-mono text-xs">order_*</span> ID
              </CardDescription>
            </div>
            <div className="flex gap-2 items-end">
              <div className="space-y-1.5">
                <Label className="font-body text-xs text-charcoal/60">Payment or Order ID</Label>
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                  placeholder="pay_… or order_…"
                  className="h-10 w-64 border-sage/20 bg-white font-mono text-sm"
                />
              </div>
              <Button type="button" variant="sage" className="h-10" onClick={handleSearch} disabled={state.status === "loading"}>
                {state.status === "loading" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                {state.status === "loading" ? "Searching…" : "Search"}
              </Button>
            </div>
          </div>
        </CardHeader>

        {state.status === "error" && (
          <CardContent>
            <div className="rounded-xl border border-[#cf5b48]/30 bg-[#cf5b48]/5 px-4 py-3">
              <p className="font-body text-sm text-[#cf5b48]">{state.message}</p>
            </div>
          </CardContent>
        )}

        {state.status === "done" && primaryPayment && (
          <CardContent>
            <div className="rounded-xl border border-sage/15 bg-white-warm overflow-hidden">
              <ResponsiveTable>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[150px]">Status</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead className="w-[140px]">Date</TableHead>
                      <TableHead className="w-[100px]">Method</TableHead>
                      <TableHead className="w-[120px] text-right">Amount</TableHead>
                      <TableHead className="w-[100px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {state.result.payments.map((p) => {
                      const alreadyImported = importedIds.has(p.id);
                      const alreadyFulfilled = fulfilledIds.has(p.id);
                      const dbState = p.id === primaryPayment.id ? state.result.dbState : "missing";
                      const tone: PillProps["tone"] =
                        alreadyImported || alreadyFulfilled ? "success"
                        : dbState === "matched" ? "success"
                        : dbState === "exists_unfulfilled" ? "warning"
                        : "danger";
                      const label =
                        alreadyImported ? "Imported"
                        : alreadyFulfilled ? "Fulfilled"
                        : dbState === "matched" ? "Matched"
                        : dbState === "exists_unfulfilled" ? "Needs fulfillment"
                        : "Missing from site";

                      return (
                        <TableRow key={p.id}>
                          <TableCell>
                            <Pill tone={tone} size="sm" className="w-full max-w-[140px] justify-center">{label}</Pill>
                          </TableCell>
                          <TableCell>
                            <div className="font-mono text-xs text-charcoal">{p.id}</div>
                            <div className="font-body text-xs text-charcoal/45 line-clamp-1">{p.email ?? p.description ?? "—"}</div>
                          </TableCell>
                          <TableCell className="font-body text-sm text-charcoal/60 whitespace-nowrap">
                            {new Date(p.createdAt * 1000).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                          </TableCell>
                          <TableCell className="font-body text-sm text-charcoal/70">{p.method ?? "—"}</TableCell>
                          <TableCell className="text-right font-display text-base tabular-nums text-charcoal">{inr(p.amountPaise)}</TableCell>
                          <TableCell>
                            {!alreadyImported && !alreadyFulfilled && dbState === "missing" && (
                              <Button type="button" size="sm" variant="outline"
                                className="h-7 px-2 text-xs border-sage/25 text-sage hover:bg-sage/5 hover:text-sage!"
                                onClick={() => setImportTarget(resultToReconRow(p, state.result))}>
                                <Import className="h-3 w-3 mr-1" />Import
                              </Button>
                            )}
                            {!alreadyFulfilled && dbState === "exists_unfulfilled" && (
                              <Button type="button" size="sm" variant="outline"
                                className="h-7 px-2 text-xs border-sage/25 text-sage hover:bg-sage/5 hover:text-sage!"
                                onClick={() => setFulfillTarget({ result: state.result, payment: p })}>
                                <Check className="h-3 w-3 mr-1" />Fulfill
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ResponsiveTable>
            </div>
            {state.result.orderReceipt && (
              <p className="mt-2 font-body text-xs text-charcoal/40">
                Order: <span className="font-mono">{state.result.orderId}</span> · Receipt: {state.result.orderReceipt} · Status: {state.result.orderStatus}
              </p>
            )}
          </CardContent>
        )}
      </Card>

      {importTarget && (
        <ImportDialog
          row={importTarget}
          onClose={() => setImportTarget(null)}
          onImported={(id) => setImportedIds((prev) => new Set([...prev, id]))}
        />
      )}

      {fulfillTarget && (
        <FulfillDialog
          result={fulfillTarget.result}
          primaryPayment={fulfillTarget.payment}
          onClose={() => setFulfillTarget(null)}
          onFulfilled={() => setFulfilledIds((prev) => new Set([...prev, fulfillTarget.payment.id]))}
        />
      )}
    </>
  );
}

// ─── Main section ─────────────────────────────────────────────────────────────

function ReconcileSectionImpl() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(currentMonthRange());
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReconResponse | null>(null);
  const [matchFilter, setMatchFilter] = useState<ReconMatch | "all" | "issues">("all");
  const [importTarget, setImportTarget] = useState<ReconRow | null>(null);
  const [detailRow, setDetailRow] = useState<ReconRow | null>(null);
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());

  // ── Live / Handled view ──
  const [view, setView] = useState<"live" | "handled">("live");
  const [logStatus, setLogStatus] = useState<SavedStatus | "all">("all");
  const [logRows, setLogRows] = useState<ReconcileLogRow[]>([]);
  const [logLoading, setLogLoading] = useState(false);
  const [handledDetail, setHandledDetail] = useState<ReconcileLogRow | null>(null);

  const loadLog = useCallback(async () => {
    setLogLoading(true);
    try {
      const q = logStatus === "all" ? "" : `?status=${logStatus}`;
      const r = await fetch(`/api/admin/finance/reconcile-log${q}`);
      const d = await r.json();
      if (!r.ok) { toast.error(d.error ?? "Could not load the log."); return; }
      setLogRows((d.rows ?? []) as ReconcileLogRow[]);
    } catch {
      toast.error("Could not reach the reconcile log endpoint.");
    } finally {
      setLogLoading(false);
    }
  }, [logStatus]);

  useEffect(() => {
    if (view === "handled") loadLog();
  }, [view, loadLog]);

  const runCorrelation = useCallback(async () => {
    // Date range powers the query; fall back to the current month if cleared.
    let query: string;
    if (dateRange?.from && dateRange?.to) {
      query = `from=${toYmd(dateRange.from)}&to=${toYmd(dateRange.to)}`;
    } else if (dateRange?.from) {
      query = `from=${toYmd(dateRange.from)}&to=${toYmd(dateRange.from)}`;
    } else {
      query = `month=${currentMonth()}`;
    }
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/finance/razorpay-reconcile?${query}`);
      const d = await r.json();
      if (!r.ok) {
        toast.error(d.error ?? "Correlation failed.");
        return;
      }
      setData(d as ReconResponse);
      if (d.partial) toast.warning("Hit the page cap — narrow the date range; results may be incomplete.");
    } catch {
      toast.error("Could not reach the reconciliation endpoint.");
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  const filteredRows = useMemo(() => {
    if (!data) return [];
    if (matchFilter === "all") return data.rows;
    if (matchFilter === "issues") return data.rows.filter((r) => MATCH_META[r.match].bad);
    return data.rows.filter((r) => r.match === matchFilter);
  }, [data, matchFilter]);

  const pg = usePagination(filteredRows, 12, `${data?.month ?? ""}|${matchFilter}|${data?.summary.total ?? 0}`);
  const logPg = usePagination(logRows, 12, `${logStatus}|${logRows.length}`);
  const issuesCount = data
    ? data.summary.counts.amount_mismatch +
      data.summary.counts.status_mismatch +
      data.summary.counts.missing_from_website +
      data.summary.counts.website_only
    : 0;

  // Summary metrics default to 0 so the cards are always on screen (even before
  // the first correlation), then fill in once data loads.
  const capturedInr = Math.round((data?.summary.razorpayCapturedPaise ?? 0) / 100);
  const recordedInr = Math.round((data?.summary.websiteRecordedPaise ?? 0) / 100);
  const gapPaise = data?.summary.gapPaise ?? 0;
  const totalCount = data?.summary.total ?? 0;

  // DetailDialog/PaymentDetailPanel read: paymentId, orderId, amountPaise, match,
  // createdAtISO, plus optional email/method/description/etc. (it re-fetches live
  // Razorpay detail by paymentId, so the cached fields are only a fallback). Build
  // a minimal ReconRow from a saved-log row.
  const logRowToReconRow = useCallback((r: ReconcileLogRow): ReconRow => ({
    paymentId: r.paymentId,
    orderId: r.orderId,
    createdAtISO: r.updatedAt,
    amountPaise: r.amountPaise ?? 0,
    amountRefundedPaise: 0,
    method: null,
    razorpayStatus: null,
    websiteStatus: null,
    source: "website",
    match: "matched",
    email: r.memberEmail,
    contact: null,
    description: null,
    notes: r.note ?? "",
  }), []);

  return (
    <div className="space-y-6">
      {/* Summary — always visible; values are 0 until a correlation runs. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard label="Razorpay captured" value={capturedInr} prefix="₹" icon={Landmark} tone="sage" />
        <MetricCard label="Website recorded" value={recordedInr} prefix="₹" icon={Globe} tone="sage" />
        <MetricCard
          label="Gap"
          value={Math.round(Math.abs(gapPaise) / 100)}
          prefix={gapPaise === 0 ? "₹" : gapPaise > 0 ? "+₹" : "−₹"}
          icon={ArrowLeftRight}
          tone={gapPaise === 0 ? "sage" : "terracotta"}
          hint={gapPaise === 0 ? "fully reconciled" : "captured minus recorded"}
        />
        <MetricCard label="Issues" value={issuesCount} icon={AlertTriangle} tone={issuesCount === 0 ? "sage" : "clay"} hint={`${totalCount} payments`} />
      </div>

      <LookupCard />

      {/* Control bar */}
      <Card className="border-sage/20 bg-white-warm">
        <CardHeader>
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <CardTitle className="font-display text-2xl text-charcoal">Razorpay reconciliation</CardTitle>
              <CardDescription className="font-body text-charcoal/60">
                Pull every Razorpay payment for a date range and match it against what the website recorded
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button type="button" variant="sage" className="h-10" onClick={runCorrelation} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ScanSearch className="h-4 w-4 mr-2" />}
                {loading ? "Correlating…" : "Correlate"}
              </Button>
              {data && (
                <Button type="button" variant="outline" className="h-10 border-sage/20 text-sage hover:bg-sage/5 hover:text-sage!" onClick={() => downloadCsv(data.rows, data.month)}>
                  <Download className="h-4 w-4 mr-2" />
                  CSV
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4 rounded-xl bg-cream/30 border border-sage/20">
            <div className="space-y-2">
              <Label className="font-body text-xs text-charcoal/60">Date range</Label>
              <FilterDateRange
                value={dateRange}
                onChange={setDateRange}
                placeholder="This month"
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* View toggle — Live issues vs saved Handled log */}
      <div className="flex flex-wrap items-center gap-2">
        {([
          ["live", "Live issues"],
          ["handled", "Handled"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            className={`rounded-full border px-4 py-1.5 font-body text-xs transition-colors ${
              view === key
                ? "border-sage bg-sage text-cream"
                : "border-sage/25 bg-white-warm text-charcoal/60 hover:bg-sage/5"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "live" && !data && !loading && (
        <Card className="border-sage/20 bg-white-warm">
          <CardContent className="py-16 text-center">
            <RefreshCw className="h-12 w-12 text-charcoal/15 mx-auto mb-3" />
            <p className="font-body text-charcoal/60">Pick a month and hit Correlate to pull Razorpay and match it to the website.</p>
          </CardContent>
        </Card>
      )}

      {view === "live" && data && (
        <>
          {/* Filter chips */}
          <div className="flex flex-wrap gap-2">
            {([
              ["all", `All (${data.summary.total})`],
              ["issues", `Issues (${issuesCount})`],
              ["matched", `Matched (${data.summary.counts.matched})`],
              ["external", `External (${data.summary.counts.external})`],
              ["missing_from_website", `Missing from site (${data.summary.counts.missing_from_website})`],
              ["website_only", `Not in Razorpay (${data.summary.counts.website_only})`],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setMatchFilter(key)}
                className={`rounded-full border px-3 py-1 font-body text-xs transition-colors ${
                  matchFilter === key
                    ? "border-sage bg-sage text-cream"
                    : "border-sage/25 bg-white-warm text-charcoal/60 hover:bg-sage/5"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Table */}
          <Card className="border-sage/20 bg-white-warm">
            <CardContent className="pt-6">
              <div className="rounded-xl border border-sage/15 bg-white-warm overflow-hidden">
                <ResponsiveTable>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[140px]">Match</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead className="w-[140px]">Date</TableHead>
                        <TableHead className="w-[120px]">Method</TableHead>
                        <TableHead className="w-[120px]">Status</TableHead>
                        <TableHead className="w-[120px] text-right">Amount</TableHead>
                        <TableHead className="w-[80px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pg.pageItems.map((r) => {
                        const meta = MATCH_META[r.match];
                        const alreadyImported = importedIds.has(r.paymentId);
                        return (
                          <TableRow
                            key={r.paymentId}
                            className={`cursor-pointer hover:bg-sage/5 ${meta.bad ? "bg-[#b3402c]/[0.03]" : ""}`}
                            onClick={() => setDetailRow(r)}
                          >
                            <TableCell>
                              <Pill
                                tone={alreadyImported ? "success" : meta.tone}
                                size="sm"
                                icon={alreadyImported ? <Check className="h-3 w-3" /> : meta.bad ? <AlertTriangle className="h-3 w-3" /> : r.match === "matched" ? <Check className="h-3 w-3" /> : undefined}
                                className="w-full max-w-[128px] justify-center"
                              >
                                {alreadyImported ? "Imported" : meta.label}
                              </Pill>
                            </TableCell>
                            <TableCell>
                              <div className="font-mono text-xs text-charcoal">{r.paymentId}</div>
                              <div className="font-body text-xs text-charcoal/45 line-clamp-1 [overflow-wrap:anywhere]">
                                {r.description || r.notes || r.email || (r.source === "external" ? "External payment page" : "—")}
                              </div>
                            </TableCell>
                            <TableCell className="font-body text-sm text-charcoal/60 whitespace-nowrap">
                              {r.razorpayStatus
                                ? new Date(r.createdAtISO).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
                                : "—"}
                            </TableCell>
                            <TableCell className="font-body text-sm text-charcoal/70 whitespace-nowrap">{r.method ?? "—"}</TableCell>
                            <TableCell>
                              <div className="font-body text-xs text-charcoal/70">RZP: {r.razorpayStatus ?? "—"}</div>
                              <div className="font-body text-xs text-charcoal/45">Site: {r.websiteStatus ?? "—"}</div>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="font-display text-base tabular-nums text-charcoal">{inr(r.amountPaise)}</span>
                              {r.amountRefundedPaise > 0 ? (
                                <div className="font-body text-xs text-[#a05e38]">−{inr(r.amountRefundedPaise)} refunded</div>
                              ) : null}
                            </TableCell>
                            <TableCell>
                              {r.match === "missing_from_website" && !alreadyImported && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs border-sage/25 text-sage hover:bg-sage/5 hover:text-sage!"
                                  onClick={(e) => { e.stopPropagation(); setImportTarget(r); }}
                                >
                                  <Import className="h-3 w-3 mr-1" />
                                  Import
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ResponsiveTable>
              </div>
              <Pagination page={pg.page} total={pg.total} pageSize={pg.pageSize} onChange={pg.setPage} />
              {filteredRows.length === 0 && (
                <div className="py-10 text-center font-body text-sm text-charcoal/40">No payments in this filter.</div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ── Handled (saved reconcile log) ── */}
      {view === "handled" && (
        <>
          {/* Status sub-filter */}
          <div className="flex flex-wrap gap-2">
            {([
              ["all", "All"],
              ["done", "Done"],
              ["in_progress", "In progress"],
              ["dropped", "Dropped"],
              ["needs_refund", "Needs refund"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setLogStatus(key)}
                className={`rounded-full border px-3 py-1 font-body text-xs transition-colors ${
                  logStatus === key
                    ? "border-sage bg-sage text-cream"
                    : "border-sage/25 bg-white-warm text-charcoal/60 hover:bg-sage/5"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <Card className="border-sage/20 bg-white-warm">
            <CardContent className="pt-6">
              {logLoading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-charcoal/40">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="font-body text-sm">Loading saved log…</span>
                </div>
              ) : (
                <>
                  <div className="rounded-xl border border-sage/15 bg-white-warm overflow-hidden">
                    <ResponsiveTable>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[130px]">Status</TableHead>
                            <TableHead>Payment</TableHead>
                            <TableHead className="w-[120px] text-right">Amount</TableHead>
                            <TableHead>Member</TableHead>
                            <TableHead>Note</TableHead>
                            <TableHead className="w-[150px]">Updated</TableHead>
                            <TableHead className="w-[120px]">Resolver</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {logPg.pageItems.map((r) => {
                            const sm = SAVED_STATUS_META[(r.status as SavedStatus) in SAVED_STATUS_META ? (r.status as SavedStatus) : "done"];
                            return (
                              <TableRow
                                key={r.paymentId}
                                className="cursor-pointer hover:bg-sage/5"
                                onClick={() => setHandledDetail(r)}
                              >
                                <TableCell>
                                  <Pill tone={sm.tone} size="sm" className="w-full max-w-[118px] justify-center">{sm.label}</Pill>
                                </TableCell>
                                <TableCell>
                                  <div className="font-mono text-xs text-charcoal">{r.paymentId}</div>
                                  {r.orderId && <div className="font-mono text-xs text-charcoal/35">{r.orderId}</div>}
                                </TableCell>
                                <TableCell className="text-right font-display text-base tabular-nums text-charcoal">
                                  {r.amountPaise != null ? inr(r.amountPaise) : "—"}
                                </TableCell>
                                <TableCell>
                                  <div className="font-body text-sm text-charcoal">{r.memberName ?? "—"}</div>
                                  {r.memberEmail && <div className="font-body text-xs text-charcoal/45 line-clamp-1">{r.memberEmail}</div>}
                                </TableCell>
                                <TableCell className="font-body text-xs text-charcoal/60 max-w-[220px]">
                                  <span className="line-clamp-2 [overflow-wrap:anywhere]">{r.note || "—"}</span>
                                </TableCell>
                                <TableCell className="font-body text-sm text-charcoal/60 whitespace-nowrap">{fmtLogDate(r.updatedAt)}</TableCell>
                                <TableCell className="font-body text-sm text-charcoal/60">{r.resolvedByName ?? "—"}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </ResponsiveTable>
                  </div>
                  <Pagination page={logPg.page} total={logPg.total} pageSize={logPg.pageSize} onChange={logPg.setPage} />
                  {logRows.length === 0 && (
                    <div className="py-10 text-center font-body text-sm text-charcoal/40">No handled payments yet.</div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {detailRow && (
        <DetailDialog
          row={detailRow}
          onClose={() => setDetailRow(null)}
          onImport={(r) => { setDetailRow(null); setImportTarget(r); }}
          onChanged={runCorrelation}
        />
      )}

      {handledDetail && (
        <DetailDialog
          row={logRowToReconRow(handledDetail)}
          isHandled
          savedStatus={(handledDetail.status as SavedStatus) in SAVED_STATUS_META ? (handledDetail.status as SavedStatus) : "done"}
          savedNote={handledDetail.note}
          onClose={() => setHandledDetail(null)}
          onImport={() => {}}
          onChanged={loadLog}
        />
      )}

      {importTarget && (
        <ImportDialog
          row={importTarget}
          onClose={() => setImportTarget(null)}
          onImported={(id) => setImportedIds((prev) => new Set([...prev, id]))}
        />
      )}
    </div>
  );
}

export const ReconcileSection = memo(ReconcileSectionImpl);
export default ReconcileSection;
