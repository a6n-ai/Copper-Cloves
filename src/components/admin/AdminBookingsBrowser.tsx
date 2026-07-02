import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, ScanSearch } from "lucide-react";
import { toast } from "sonner";
import type { DateRange } from "react-day-picker";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Pill } from "@/components/ui/pill";
import { FilterBar, FilterSearch, FilterSelect, FilterDateRange } from "@/components/filters";
import { Pagination } from "@/components/Pagination";
import { bookingStatusPill } from "@/lib/pillMaps";
import type { AdminBookingRow, AdminBookingsResponse, AdminBookingPaymentStatus } from "@/pages/api/admin/bookings";
import type { RazorpayPaymentDetail } from "@/pages/api/admin/finance/razorpay-payment-detail";

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "confirmed", label: "Confirmed" },
  { value: "payment_pending", label: "Unpaid" },
  { value: "expired", label: "Expired" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No-show" },
];

const PAGE_SIZE = 25;

function inr(paise: number | null): string {
  if (paise == null) return "—";
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const PAYMENT_PILL_META: Record<AdminBookingPaymentStatus, { label: string; tone: "success" | "warning" | "info" | "neutral" | "danger" }> = {
  paid: { label: "Paid", tone: "success" },
  pending: { label: "Awaiting payment", tone: "warning" },
  refunded: { label: "Refunded", tone: "info" },
  none: { label: "—", tone: "neutral" },
};

/** YYYY-MM-DD (local) for the API's from/to params. */
function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function RefundCheckDialog({ row, onClose }: { row: AdminBookingRow; onClose: () => void }) {
  const [detail, setDetail] = useState<RazorpayPaymentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!row.razorpayPaymentId) {
      setError("No Razorpay payment linked to this booking.");
      setLoading(false);
      return;
    }
    fetch(`/api/admin/finance/razorpay-payment-detail?paymentId=${encodeURIComponent(row.razorpayPaymentId)}`)
      .then((r) => r.json())
      .then((d: RazorpayPaymentDetail & { error?: string }) => {
        if (d.error) { setError(d.error); return; }
        setDetail(d);
      })
      .catch(() => setError("Could not reach Razorpay."))
      .finally(() => setLoading(false));
  }, [row.razorpayPaymentId]);

  const fullyRefunded = !!detail && detail.amount_refunded > 0 && detail.amount_refunded >= detail.amount;
  const partiallyRefunded = !!detail && detail.amount_refunded > 0 && !fullyRefunded;

  return (
    <ResponsiveDialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <ResponsiveDialogContent className="max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="font-body font-semibold text-xl text-charcoal">Refund status</ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="font-body text-charcoal/60">
            {row.memberName || row.memberEmail || "Member"} · {row.className ?? "Class"}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="px-6 pb-6 space-y-3">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-8 text-charcoal/40">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="font-body text-sm">Checking with Razorpay…</span>
            </div>
          )}

          {error && !loading && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
              <p className="font-body text-sm text-destructive">{error}</p>
            </div>
          )}

          {!loading && detail && (
            <div className="rounded-xl border border-sage/15 bg-sand/40 p-4 space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="font-body text-xs text-charcoal/50 uppercase tracking-wide">Status</span>
                <span className="font-body text-sm text-charcoal/80 capitalize">{detail.status}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-body text-xs text-charcoal/50 uppercase tracking-wide">Amount</span>
                <span className="font-body text-sm text-charcoal/80">{inr(detail.amount)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-body text-xs text-charcoal/50 uppercase tracking-wide">Refunded</span>
                <span className={`font-body text-sm ${detail.amount_refunded > 0 ? "text-destructive" : "text-charcoal/80"}`}>
                  {inr(detail.amount_refunded)}
                </span>
              </div>
              {detail.refund_status && (
                <div className="flex justify-between items-center">
                  <span className="font-body text-xs text-charcoal/50 uppercase tracking-wide">Refund state</span>
                  <span className="font-body text-sm text-charcoal/80 capitalize">{detail.refund_status}</span>
                </div>
              )}
              {fullyRefunded && (
                <p className="font-body text-xs text-charcoal/60 pt-2 border-t border-sage/10">This payment has been fully refunded.</p>
              )}
              {partiallyRefunded && (
                <p className="font-body text-xs text-terracotta pt-2 border-t border-sage/10">This payment has been partially refunded.</p>
              )}
            </div>
          )}
        </div>

        <ResponsiveDialogFooter className="px-6 pb-6">
          <Button type="button" variant="ghost" className="text-charcoal/50 ml-auto" onClick={onClose}>Close</Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full rounded-lg" />
      ))}
    </div>
  );
}

export function AdminBookingsBrowser() {
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [page, setPage] = useState(1);

  const [data, setData] = useState<AdminBookingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reconcilingId, setReconcilingId] = useState<string | null>(null);
  const [refundCheckRow, setRefundCheckRow] = useState<AdminBookingRow | null>(null);
  const [refetchKey, setRefetchKey] = useState(0);

  // Reset to page 1 whenever a filter changes.
  useEffect(() => { setPage(1); }, [status, q, range]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("status", status);
    if (q.trim()) params.set("q", q.trim());
    if (range?.from) params.set("from", toYmd(range.from));
    if (range?.to) params.set("to", toYmd(range.to));
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));

    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/bookings?${params.toString()}`)
      .then((r) => r.json())
      .then((d: AdminBookingsResponse & { error?: string }) => {
        if (cancelled) return;
        if (d.error) { setError(d.error); return; }
        setData(d);
      })
      .catch(() => { if (!cancelled) setError("Could not load bookings."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [status, q, range, page, refetchKey]);

  const rows = useMemo(() => data?.rows ?? [], [data]);

  function refetch() {
    setRefetchKey((k) => k + 1);
  }

  async function handleReconcile(row: AdminBookingRow) {
    setReconcilingId(row.id);
    try {
      const res = await fetch("/api/admin/booking-payment-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: row.id, action: "reconcile" }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error ?? "Reconcile failed.");
        return;
      }
      if (d.alreadyConfirmed) {
        toast.success("Already confirmed.");
      } else if (d.reconciled) {
        toast.success("Booking confirmed — payment found.");
      } else {
        toast.info("No captured payment found yet on Razorpay.");
      }
      refetch();
    } catch {
      toast.error("Could not reach the server.");
    } finally {
      setReconcilingId(null);
    }
  }

  return (
    <>
      <Card className="border-sage/20 bg-white-warm">
        <CardHeader>
          <CardTitle className="font-body font-semibold text-2xl text-charcoal">All bookings</CardTitle>
          <CardDescription className="font-body text-charcoal/60">
            Browse every booking, filter by status/date, and check refund state per payment.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FilterBar reset={() => { setStatus("all"); setQ(""); setRange(undefined); }}>
            <FilterSearch value={q} onChange={setQ} placeholder="Search member or class…" />
            <FilterSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} placeholder="Status" />
            <FilterDateRange value={range} onChange={setRange} placeholder="Class date — all time" />
            <Button type="button" variant="outline" size="sm" className="border-sage/25 text-charcoal/70 hover:bg-sage/5" onClick={refetch}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Refresh
            </Button>
          </FilterBar>

          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
              <p className="font-body text-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="rounded-xl border border-sage/15 bg-white-warm overflow-hidden">
            {loading ? (
              <TableSkeleton />
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-14 text-charcoal/40">
                <ScanSearch className="h-8 w-8" />
                <p className="font-body text-sm">No bookings match these filters.</p>
              </div>
            ) : (
              <ResponsiveTable>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Date / time</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="w-[220px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => {
                      const statusMeta = bookingStatusPill(row.status);
                      const paymentMeta = PAYMENT_PILL_META[row.paymentStatus];
                      const canReconcile = row.status === "payment_pending" || row.status === "expired";
                      const isReconciling = reconcilingId === row.id;
                      return (
                        <TableRow key={row.id}>
                          <TableCell>
                            <div className="font-body text-sm text-charcoal">{row.memberName || "—"}</div>
                            <div className="font-body text-xs text-charcoal/50">{row.memberEmail || "—"}</div>
                          </TableCell>
                          <TableCell className="font-body text-sm text-charcoal">{row.className ?? "—"}</TableCell>
                          <TableCell className="font-body text-sm text-charcoal/70">{fmtDateTime(row.classStartTime)}</TableCell>
                          <TableCell>
                            <Pill tone={statusMeta.tone} size="sm">{statusMeta.label}</Pill>
                          </TableCell>
                          <TableCell>
                            <Pill tone={paymentMeta.tone} size="sm">{paymentMeta.label}</Pill>
                          </TableCell>
                          <TableCell className="text-right font-body text-sm tabular-nums text-charcoal">
                            {inr(row.amountPaise)}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              {row.razorpayPaymentId && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 border-sage/25 text-charcoal/70 hover:bg-sage/5"
                                  onClick={() => setRefundCheckRow(row)}
                                >
                                  Check refund
                                </Button>
                              )}
                              {canReconcile && (
                                <Button
                                  type="button"
                                  variant="sage-outline"
                                  size="sm"
                                  className="h-8"
                                  disabled={isReconciling}
                                  onClick={() => handleReconcile(row)}
                                >
                                  {isReconciling ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
                                  Reconcile
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ResponsiveTable>
            )}
          </div>

          {data && (
            <Pagination page={page} total={data.total} pageSize={PAGE_SIZE} onChange={setPage} />
          )}
        </CardContent>
      </Card>

      {refundCheckRow && <RefundCheckDialog row={refundCheckRow} onClose={() => setRefundCheckRow(null)} />}
    </>
  );
}
