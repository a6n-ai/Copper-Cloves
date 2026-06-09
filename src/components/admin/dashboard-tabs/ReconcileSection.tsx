import { memo, useCallback, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeftRight, Check, Download, Globe, Landmark, Loader2, RefreshCw, ScanSearch } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MetricCard } from "@/components/admin/MetricCard";
import { Pagination, usePagination } from "@/components/Pagination";
import { Pill, type PillProps } from "@/components/ui/pill";

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

function ReconcileSectionImpl() {
  const [month, setMonth] = useState(currentMonth());
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReconResponse | null>(null);
  const [matchFilter, setMatchFilter] = useState<ReconMatch | "all" | "issues">("all");

  const runCorrelation = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/finance/razorpay-reconcile?month=${encodeURIComponent(month)}`);
      const d = await r.json();
      if (!r.ok) {
        toast.error(d.error ?? "Correlation failed.");
        return;
      }
      setData(d as ReconResponse);
      if (d.partial) toast.warning("Hit the page cap — results may be incomplete for this month.");
    } catch {
      toast.error("Could not reach the reconciliation endpoint.");
    } finally {
      setLoading(false);
    }
  }, [month]);

  const filteredRows = useMemo(() => {
    if (!data) return [];
    if (matchFilter === "all") return data.rows;
    if (matchFilter === "issues") return data.rows.filter((r) => MATCH_META[r.match].bad);
    return data.rows.filter((r) => r.match === matchFilter);
  }, [data, matchFilter]);

  const pg = usePagination(filteredRows, 12, `${month}|${matchFilter}|${data?.summary.total ?? 0}`);
  const issuesCount = data
    ? data.summary.counts.amount_mismatch +
      data.summary.counts.status_mismatch +
      data.summary.counts.missing_from_website +
      data.summary.counts.website_only
    : 0;

  return (
    <div className="space-y-6">
      {/* Control bar */}
      <Card className="border-sage/20 bg-white-warm">
        <CardHeader>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <CardTitle className="font-display text-2xl text-charcoal">Razorpay reconciliation</CardTitle>
              <CardDescription className="font-body text-charcoal/60">
                Pull every Razorpay payment for a month and match it against what the website recorded
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label className="font-body text-xs text-charcoal/60">Month</Label>
                <Input
                  type="month"
                  value={month}
                  max={currentMonth()}
                  onChange={(e) => setMonth(e.target.value)}
                  className="h-10 w-44 border-sage/20 bg-white font-body"
                />
              </div>
              <Button type="button" variant="sage" className="h-10" onClick={runCorrelation} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ScanSearch className="h-4 w-4 mr-2" />}
                {loading ? "Correlating…" : "Correlate"}
              </Button>
              {data && (
                <Button type="button" variant="outline" className="h-10 border-sage/20 text-sage hover:bg-sage/5 hover:text-sage!" onClick={() => downloadCsv(data.rows, month)}>
                  <Download className="h-4 w-4 mr-2" />
                  CSV
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {!data && !loading && (
        <Card className="border-sage/20 bg-white-warm">
          <CardContent className="py-16 text-center">
            <RefreshCw className="h-12 w-12 text-charcoal/15 mx-auto mb-3" />
            <p className="font-body text-charcoal/60">Pick a month and hit Correlate to pull Razorpay and match it to the website.</p>
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <MetricCard label="Razorpay captured" value={Math.round(data.summary.razorpayCapturedPaise / 100)} prefix="₹" icon={Landmark} tone="sage" />
            <MetricCard label="Website recorded" value={Math.round(data.summary.websiteRecordedPaise / 100)} prefix="₹" icon={Globe} tone="sage" />
            <MetricCard
              label="Gap"
              value={Math.round(Math.abs(data.summary.gapPaise) / 100)}
              prefix={data.summary.gapPaise === 0 ? "₹" : data.summary.gapPaise > 0 ? "+₹" : "−₹"}
              icon={ArrowLeftRight}
              tone={data.summary.gapPaise === 0 ? "sage" : "terracotta"}
              hint={data.summary.gapPaise === 0 ? "fully reconciled" : "captured minus recorded"}
            />
            <MetricCard label="Issues" value={issuesCount} icon={AlertTriangle} tone={issuesCount === 0 ? "sage" : "amber"} hint={`${data.summary.total} payments`} />
          </div>

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
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pg.pageItems.map((r) => {
                        const meta = MATCH_META[r.match];
                        return (
                          <TableRow key={r.paymentId} className={meta.bad ? "bg-[#b3402c]/[0.03]" : undefined}>
                            <TableCell>
                              <Pill
                                tone={meta.tone}
                                size="sm"
                                icon={meta.bad ? <AlertTriangle className="h-3 w-3" /> : r.match === "matched" ? <Check className="h-3 w-3" /> : undefined}
                                className="w-full max-w-[128px] justify-center"
                              >
                                {meta.label}
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
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ResponsiveTable>
              </div>
              <Pagination page={pg.page} total={pg.total} onChange={pg.setPage} />
              {filteredRows.length === 0 && (
                <div className="py-10 text-center font-body text-sm text-charcoal/40">No payments in this filter.</div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export const ReconcileSection = memo(ReconcileSectionImpl);
export default ReconcileSection;
