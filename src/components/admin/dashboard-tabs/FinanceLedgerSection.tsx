import { memo, useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ExternalLink, Loader2, Scale } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Pill } from "@/components/ui/pill";
import { paymentMethodPill } from "@/lib/pillMaps";
import type { FinanceLedgerResult, LedgerEntry } from "@/lib/financeLedger";

function inr(paise: number): string {
  return `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type DirFilter = "all" | "credit" | "debit";

function FinanceLedgerSectionImpl() {
  const [data, setData] = useState<FinanceLedgerResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [dir, setDir] = useState<DirFilter>("all");
  const [manualOnly, setManualOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/admin/finance/ledger");
        const d = (await r.json()) as FinanceLedgerResult & { _partial?: boolean };
        if (cancelled) return;
        if (d._partial) toast.error("Some ledger data could not be loaded.");
        setData(d);
      } catch {
        if (!cancelled) toast.error("Could not load the ledger.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(() => {
    const all = data?.entries ?? [];
    const q = query.trim().toLowerCase();
    return all.filter((e) => {
      if (dir !== "all" && e.direction !== dir) return false;
      if (manualOnly && !e.isManualExpense) return false;
      if (!q) return true;
      const hay = `${e.party} ${e.category} ${e.method ?? ""} ${e.reference ?? ""} ${e.id}`.toLowerCase();
      return hay.includes(q);
    });
  }, [data, query, dir, manualOnly]);

  const totals = data?.totals ?? { creditPaise: 0, debitPaise: 0, netPaise: 0 };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-charcoal/50">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading ledger…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-sage/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-body text-charcoal/60 flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4 text-sage" /> Money In
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-sage">{inr(totals.creditPaise)}</CardContent>
        </Card>
        <Card className="border-terracotta/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-body text-charcoal/60 flex items-center gap-2">
              <ArrowDownLeft className="h-4 w-4 text-terracotta" /> Money Out
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-terracotta">{inr(totals.debitPaise)}</CardContent>
        </Card>
        <Card className="border-charcoal/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-body text-charcoal/60 flex items-center gap-2">
              <Scale className="h-4 w-4 text-charcoal/70" /> Net
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-charcoal">{inr(totals.netPaise)}</CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex-1">
          <Label className="text-xs text-charcoal/60">Search</Label>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Party, category, method, reference…"
            className="border-sage/20"
          />
        </div>
        <div>
          <Label className="text-xs text-charcoal/60">Direction</Label>
          <Select value={dir} onValueChange={(v) => setDir(v as DirFilter)}>
            <SelectTrigger className="w-40 border-sage/20"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="credit">Credit (in)</SelectItem>
              <SelectItem value="debit">Debit (out)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 text-sm text-charcoal/70 pb-2">
          <input type="checkbox" checked={manualOnly} onChange={(e) => setManualOnly(e.target.checked)} />
          Manual expenses only
        </label>
      </div>

      {data?.truncated && (
        <p className="text-xs text-charcoal/50">Showing the most recent {data?.entries.length ?? 0} of a larger set.</p>
      )}

      <ResponsiveTable>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Party</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Direction</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Proof</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-charcoal/50 py-10">
                  No transactions match.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((e: LedgerEntry) => {
                const mp = e.method ? paymentMethodPill(e.method) : null;
                return (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap">{fmtDate(e.occurredAtISO)}</TableCell>
                    <TableCell>{e.party}</TableCell>
                    <TableCell><Pill tone="neutral">{e.category}</Pill></TableCell>
                    <TableCell>
                      {mp ? <Pill tone={mp.tone} brand={mp.brand}>{mp.label}</Pill> : <span className="text-charcoal/40">—</span>}
                    </TableCell>
                    <TableCell>
                      <Pill tone={e.direction === "credit" ? "success" : "danger"}>
                        {e.direction === "credit" ? "Credit" : "Debit"}
                      </Pill>
                    </TableCell>
                    <TableCell className="text-right font-medium">{inr(e.amountPaise)}</TableCell>
                    <TableCell>
                      {e.proofUrl ? (
                        <a href={e.proofUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sage hover:underline">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : (
                        <span className="text-charcoal/40">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </ResponsiveTable>
    </div>
  );
}

export const FinanceLedgerSection = memo(FinanceLedgerSectionImpl);
