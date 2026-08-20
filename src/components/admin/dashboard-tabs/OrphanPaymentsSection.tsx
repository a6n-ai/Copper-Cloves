import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Copy, Link2, Loader2, RefreshCw, ScanSearch, ShieldQuestion } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MetricCard } from "@/components/admin/MetricCard";
import { Pill, type PillProps } from "@/components/ui/pill";
import { paymentMethodPill } from "@/lib/pillMaps";
import type { OrphanPaymentRow, OrphanPaymentType, OrphanPaymentsResponse } from "@/pages/api/admin/finance/orphan-payments";
import type { RazorpayPaymentDetail } from "@/pages/api/admin/finance/razorpay-payment-detail";

const TYPE_META: Record<OrphanPaymentType, { label: string; tone: PillProps["tone"]; description: string }> = {
  matchable: { label: "Matchable", tone: "info", description: "Likely belongs to a stuck unpaid booking" },
  duplicate: { label: "Duplicate", tone: "danger", description: "Member already paid this amount elsewhere" },
  fulfilled_unlinked: { label: "Fulfilled, unlinked", tone: "neutral", description: "Member already got value — just tidy the ledger" },
  stranded: { label: "Stranded", tone: "warning", description: "No obvious match — needs a look" },
};

function inr(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function copyToClipboard(value: string) {
  navigator.clipboard?.writeText(value).then(
    () => toast.success("Copied"),
    () => toast.error("Could not copy"),
  );
}

// ─── Verify-in-Razorpay dialog ──────────────────────────────────────────────

function VerifyDialog({ row, onClose }: { row: OrphanPaymentRow; onClose: () => void }) {
  const [detail, setDetail] = useState<RazorpayPaymentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!row.razorpayPaymentId) {
      setError("No Razorpay payment ID on this record.");
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

  return (
    <ResponsiveDialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <ResponsiveDialogContent className="max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="font-body font-semibold text-xl text-charcoal">Verify in Razorpay</ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="font-body text-charcoal/60">
            <span className="font-mono text-xs">{row.razorpayPaymentId ?? "—"}</span>
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <div className="px-6 pb-6 space-y-3">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-8 text-charcoal/40">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="font-body text-sm">Fetching from Razorpay…</span>
            </div>
          )}
          {error && !loading && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
              <p className="font-body text-sm text-destructive">{error}</p>
            </div>
          )}
          {!loading && !error && detail && (
            <div className="rounded-xl border border-sage/15 bg-sand/40 p-4 space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="font-body text-xs text-charcoal/50 uppercase tracking-wide">Status</span>
                <span className="font-body text-sm text-charcoal/80 capitalize">{detail.status}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-body text-xs text-charcoal/50 uppercase tracking-wide">Amount</span>
                <span className="font-body text-sm font-semibold text-charcoal">{inr(detail.amount)}</span>
              </div>
              {detail.amount_refunded > 0 && (
                <div className="flex justify-between items-center">
                  <span className="font-body text-xs text-charcoal/50 uppercase tracking-wide">Refunded</span>
                  <span className="font-body text-sm text-destructive">−{inr(detail.amount_refunded)}</span>
                </div>
              )}
              {detail.captured != null && (
                <div className="flex justify-between items-center">
                  <span className="font-body text-xs text-charcoal/50 uppercase tracking-wide">Captured</span>
                  <span className="font-body text-sm text-charcoal/80">{detail.captured ? "Yes" : "No"}</span>
                </div>
              )}
            </div>
          )}
        </div>
        <ResponsiveDialogFooter className="px-6 pb-6">
          <Button type="button" variant="ghost" className="text-charcoal/50 ml-auto" onClick={onClose}>
            Close
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

// ─── Mark-refunded dialog ────────────────────────────────────────────────────

function MarkRefundedDialog({
  row,
  onClose,
  onDone,
}: {
  row: OrphanPaymentRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/finance/orphan-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_refunded", paymentId: row.paymentId, note: note.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Could not mark as refunded."); return; }
      toast.success("Marked as refunded.");
      onDone();
      onClose();
    } catch {
      toast.error("Could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ResponsiveDialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <ResponsiveDialogContent className="max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="font-body font-semibold text-xl text-charcoal">Mark as refunded</ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="font-body text-charcoal/60">
            This only records the refund here — issue the actual refund from the Razorpay dashboard.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <div className="px-6 pb-2 space-y-1.5">
          <Label className="font-body text-xs text-charcoal/60">Note (optional)</Label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. duplicate charge, refunded via dashboard 2 Jul"
            rows={2}
            className="border-sage/20 bg-white-warm font-body text-sm resize-none"
          />
        </div>
        <ResponsiveDialogFooter className="px-6 pb-6 gap-2">
          <Button type="button" variant="ghost" className="text-charcoal/50 mr-auto" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" variant="sage" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {submitting ? "Saving…" : "Mark refunded"}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

// ─── Main section ────────────────────────────────────────────────────────────

export function OrphanPaymentsSection() {
  const [rows, setRows] = useState<OrphanPaymentRow[]>([]);
  const [counts, setCounts] = useState<Record<OrphanPaymentType, number>>({
    matchable: 0,
    duplicate: 0,
    fulfilled_unlinked: 0,
    stranded: 0,
  });
  const [loading, setLoading] = useState(true);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [verifyRow, setVerifyRow] = useState<OrphanPaymentRow | null>(null);
  const [refundRow, setRefundRow] = useState<OrphanPaymentRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/finance/orphan-payments");
      const data: OrphanPaymentsResponse = await res.json();
      setRows(data.rows ?? []);
      setCounts(data.counts ?? { matchable: 0, duplicate: 0, fulfilled_unlinked: 0, stranded: 0 });
    } catch {
      toast.error("Could not load orphan payments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleLink(row: OrphanPaymentRow) {
    if (!row.suggestedBookingId) return;
    setLinkingId(row.paymentId);
    try {
      const res = await fetch("/api/admin/finance/orphan-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "link", paymentId: row.paymentId, bookingId: row.suggestedBookingId }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Could not link."); return; }
      toast.success("Linked and confirmed the booking.");
      load();
    } catch {
      toast.error("Could not reach the server.");
    } finally {
      setLinkingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Matchable" value={counts.matchable} icon={Link2} tone="sage" loading={loading} description="Orphan payments that can likely be auto-matched to a booking or package" />
        <MetricCard label="Duplicate" value={counts.duplicate} icon={Copy} tone="terracotta" loading={loading} description="Orphan payments that look like duplicates of an already-recorded payment" />
        <MetricCard label="Fulfilled, unlinked" value={counts.fulfilled_unlinked} icon={ScanSearch} tone="charcoal" loading={loading} description="Payments that fulfilled a booking or package but were never linked back to it" />
        <MetricCard label="Stranded" value={counts.stranded} icon={ShieldQuestion} tone="terracotta" loading={loading} description="Orphan payments with no clear booking or package match, needing manual review" />
      </div>

      <Card className="border-sage/20 bg-white-warm">
        <CardHeader>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <CardTitle className="font-body font-semibold text-2xl text-charcoal">Orphan &amp; duplicate payments</CardTitle>
              <CardDescription className="font-body text-charcoal/60">
                Money in, not linked to a booking or package — review and fix each row
              </CardDescription>
            </div>
            <Button type="button" variant="outline" className="border-sage/25 text-charcoal/70 hover:bg-sage/5" onClick={load} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!loading && rows.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <AlertTriangle className="h-6 w-6 text-sage/40" />
              <p className="font-body text-sm text-charcoal/50">No orphan payments found. The ledger is clean.</p>
            </div>
          )}

          {(loading || rows.length > 0) && (
            <div className="rounded-xl border border-sage/15 bg-white-warm overflow-hidden">
              <ResponsiveTable stack>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading && rows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10">
                          <Loader2 className="h-4 w-4 animate-spin mx-auto text-charcoal/40" />
                        </TableCell>
                      </TableRow>
                    )}
                    {rows.map((row) => {
                      const typeMeta = TYPE_META[row.type];
                      const methodMeta = row.method ? paymentMethodPill(row.method) : null;
                      return (
                        <TableRow key={row.paymentId}>
                          <TableCell>
                            <div className="font-body text-sm text-charcoal">{row.memberName || "—"}</div>
                            <div className="font-body text-xs text-charcoal/50">{row.memberEmail || "—"}</div>
                          </TableCell>
                          <TableCell className="text-right font-body text-sm font-semibold tabular-nums text-charcoal">
                            {inr(row.amountPaise)}
                          </TableCell>
                          <TableCell className="font-body text-xs text-charcoal/60 whitespace-nowrap">
                            {fmtDate(row.createdAt)}
                          </TableCell>
                          <TableCell>
                            {methodMeta ? (
                              <Pill tone={methodMeta.tone} brand={methodMeta.brand} size="sm">{methodMeta.label}</Pill>
                            ) : (
                              <span className="font-body text-xs text-charcoal/40">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Pill tone={typeMeta.tone} size="sm" title={typeMeta.description}>{typeMeta.label}</Pill>
                            {row.type === "matchable" && row.suggestedBookingLabel && (
                              <div className="font-body text-xs text-charcoal/50 mt-1">{row.suggestedBookingLabel}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap justify-end gap-1.5">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 text-charcoal/60 hover:bg-sage/5"
                                onClick={() => setVerifyRow(row)}
                              >
                                Verify
                              </Button>
                              {row.type === "matchable" && (
                                <Button
                                  type="button"
                                  variant="sage"
                                  size="sm"
                                  className="h-8"
                                  onClick={() => handleLink(row)}
                                  disabled={linkingId === row.paymentId}
                                >
                                  {linkingId === row.paymentId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Link"}
                                </Button>
                              )}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 border-sage/25 text-charcoal/70 hover:bg-sage/5"
                                onClick={() => setRefundRow(row)}
                              >
                                Mark refunded
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-charcoal/40 hover:bg-sage/5"
                                onClick={() => copyToClipboard(row.razorpayPaymentId ?? row.paymentId)}
                                title="Copy payment ID"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ResponsiveTable>
            </div>
          )}
        </CardContent>
      </Card>

      {verifyRow && <VerifyDialog row={verifyRow} onClose={() => setVerifyRow(null)} />}
      {refundRow && <MarkRefundedDialog row={refundRow} onClose={() => setRefundRow(null)} onDone={load} />}
    </div>
  );
}
