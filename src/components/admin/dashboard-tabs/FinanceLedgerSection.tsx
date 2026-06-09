import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpDown,
  ArrowUpRight,
  CreditCard,
  Database,
  Download,
  ExternalLink,
  Filter,
  Loader2,
  Scale,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { MetricCard } from "@/components/admin/MetricCard";
import { FilterCombobox } from "@/components/admin/FilterCombobox";
import { FilterDateRange, FilterReset, FilterSelect, FilterSearch } from "@/components/filters";
import type { DateRange } from "react-day-picker";
import { SortableHeader, useTableSort } from "@/components/admin/sortable-table";
import { Pagination, usePagination } from "@/components/Pagination";
import { paymentMethodPill } from "@/lib/pillMaps";
import type { FinanceLedgerResult, LedgerEntry } from "@/lib/financeLedger";

function inr(paise: number): string {
  return `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function methodLabel(method: string | null): string {
  return method ? paymentMethodPill(method).label : "—";
}

// Wrap a field for CSV: quote and escape embedded quotes; "—" placeholders blanked.
function csvCell(v: string | number): string {
  const s = String(v);
  if (s === "—") return "";
  return `"${s.replace(/"/g, '""')}"`;
}

function ledgerToCsv(rows: LedgerEntry[]): string {
  const header = ["Date", "Party", "Category", "Method", "Direction", "Amount (INR)", "Status", "Reference", "ID"];
  const lines = rows.map((e) => {
    const rupees = Math.round(Math.abs(e.amountPaise)) / 100;
    const signed = e.direction === "debit" ? -rupees : rupees;
    return [
      fmtDate(e.occurredAtISO),
      e.party,
      e.category,
      methodLabel(e.method),
      e.direction,
      signed,
      e.status,
      e.reference ?? "",
      e.id,
    ].map(csvCell).join(",");
  });
  return [header.map(csvCell).join(","), ...lines].join("\r\n");
}

function downloadCsv(filename: string, csv: string): void {
  // Prepend BOM so Excel reads UTF-8 (₹, names) correctly.
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Inclusive [from, to] day-range check driven by the shared FilterDateRange.
function passesDateRange(iso: string, range?: DateRange): boolean {
  if (!range?.from) return true;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return true;
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const from = new Date(range.from.getFullYear(), range.from.getMonth(), range.from.getDate());
  const toSrc = range.to ?? range.from;
  const to = new Date(toSrc.getFullYear(), toSrc.getMonth(), toSrc.getDate());
  return day >= from && day <= to; // `to` is inclusive (the whole selected end day)
}

type DirFilter = "all" | "credit" | "debit";
type SourceFilter = "all" | "manual";
type LedgerSortKey = "date" | "party" | "category" | "method" | "direction" | "amount";

function FinanceLedgerSectionImpl() {
  const [data, setData] = useState<FinanceLedgerResult | null>(null);
  const [loading, setLoading] = useState(true);

  const [dir, setDir] = useState<DirFilter>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [category, setCategory] = useState("all");
  const [party, setParty] = useState("all");
  const [method, setMethod] = useState("all");
  const [source, setSource] = useState<SourceFilter>("all");
  const [search, setSearch] = useState("");

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

  const entries = useMemo(() => data?.entries ?? [], [data]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) if (e.category?.trim()) set.add(e.category.trim());
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [entries]);

  const partyOptions = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) if (e.party?.trim()) set.add(e.party.trim());
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [entries]);

  const methodOptions = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) {
      const m = methodLabel(e.method);
      if (m !== "—") set.add(m);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [entries]);

  const resetFilters = useCallback(() => {
    setDir("all");
    setDateRange(undefined);
    setCategory("all");
    setParty("all");
    setMethod("all");
    setSource("all");
    setSearch("");
  }, []);

  const ledgerFiltersDirty =
    dir !== "all" ||
    dateRange !== undefined ||
    category !== "all" ||
    party !== "all" ||
    method !== "all" ||
    source !== "all" ||
    search !== "";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (dir !== "all" && e.direction !== dir) return false;
      if (source === "manual" && !e.isManualExpense) return false;
      if (!passesDateRange(e.occurredAtISO, dateRange)) return false;
      if (category !== "all" && e.category !== category) return false;
      if (party !== "all" && e.party !== party) return false;
      if (method !== "all" && methodLabel(e.method) !== method) return false;
      if (q) {
        const hay = `${e.party} ${e.category} ${methodLabel(e.method)} ${e.reference ?? ""} ${e.id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [entries, dir, source, dateRange, category, party, method, search]);

  const getSortValue = useCallback((row: LedgerEntry, key: LedgerSortKey): number | string => {
    switch (key) {
      case "date": return row.occurredAtISO;
      case "party": return row.party;
      case "category": return row.category;
      case "method": return methodLabel(row.method);
      case "direction": return row.direction;
      case "amount": return row.direction === "debit" ? -Math.abs(row.amountPaise) : Math.abs(row.amountPaise);
    }
  }, []);

  const { sorted, sortKey, sortDir, toggle } = useTableSort<LedgerEntry, LedgerSortKey>(filtered, {
    initialKey: "date",
    initialDir: "desc",
    getValue: getSortValue,
    defaultDirFor: (k) => (k === "party" || k === "category" || k === "method" || k === "direction" ? "asc" : "desc"),
  });

  const pg = usePagination(
    sorted,
    10,
    `${dir}|${dateRange?.from?.toDateString() ?? ""}-${dateRange?.to?.toDateString() ?? ""}|${category}|${party}|${method}|${source}|${search}|${sortKey}|${sortDir}`,
  );

  const exportCsv = useCallback(() => {
    if (sorted.length === 0) {
      toast.error("No rows to export.");
      return;
    }
    const today = fmtDate(new Date().toISOString());
    downloadCsv(`ledger-${today}.csv`, ledgerToCsv(sorted));
  }, [sorted]);

  // Summary reflects the current filter selection.
  const totals = useMemo(() => {
    let creditPaise = 0;
    let debitPaise = 0;
    for (const e of filtered) {
      if (e.direction === "credit") creditPaise += e.amountPaise;
      else debitPaise += e.amountPaise;
    }
    return { creditPaise, debitPaise, netPaise: creditPaise - debitPaise };
  }, [filtered]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-charcoal/50">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading ledger…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        <MetricCard label="Money In" value={Math.round(totals.creditPaise / 100)} prefix="₹" icon={ArrowUpRight} tone="sage" />
        <MetricCard label="Money Out" value={Math.round(totals.debitPaise / 100)} prefix="₹" icon={ArrowDownLeft} tone="terracotta" />
        <MetricCard label="Net" value={Math.round(totals.netPaise / 100)} prefix="₹" icon={Scale} tone="charcoal" />
      </div>

      <Card className="border-sage/20 bg-white-warm">
        <CardHeader>
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <CardTitle className="font-display text-2xl text-charcoal">Ledger</CardTitle>
              <CardDescription className="font-body text-charcoal/60">
                Every transaction — payments, expenses, payouts, refunds — in one place
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {ledgerFiltersDirty && <FilterReset onReset={resetFilters} label="Clear filters" />}
              <Button
                type="button"
                variant="sage-outline"
                className="font-body"
                onClick={exportCsv}
                disabled={sorted.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4 rounded-xl bg-cream/30 border border-sage/20">
            <div className="space-y-2">
              <Label className="font-body text-xs text-charcoal/60">Direction</Label>
              <FilterSelect
                value={dir}
                onChange={(v) => setDir(v as DirFilter)}
                icon={ArrowUpDown}
                options={[
                  { value: "all", label: "All" },
                  { value: "credit", label: "💰 Credit (in)" },
                  { value: "debit", label: "💸 Debit (out)" },
                ]}
              />
            </div>
            <div className="space-y-2">
              <Label className="font-body text-xs text-charcoal/60">Date Range</Label>
              <FilterDateRange value={dateRange} onChange={setDateRange} placeholder="All time" />
            </div>
            <div className="space-y-2">
              <Label className="font-body text-xs text-charcoal/60">Category</Label>
              <FilterSelect
                value={category}
                onChange={setCategory}
                icon={Filter}
                options={[
                  { value: "all", label: "All Categories" },
                  ...categoryOptions.map((c) => ({ value: c, label: c })),
                ]}
              />
            </div>
            <div className="space-y-2">
              <Label className="font-body text-xs text-charcoal/60">Party</Label>
              <FilterCombobox
                value={party}
                onValueChange={setParty}
                options={partyOptions}
                allLabel="All Parties"
                searchPlaceholder="Search parties…"
                emptyText="No parties found."
                icon={Users}
              />
            </div>
            <div className="space-y-2">
              <Label className="font-body text-xs text-charcoal/60">Method</Label>
              <FilterCombobox
                value={method}
                onValueChange={setMethod}
                options={methodOptions}
                allLabel="All Methods"
                searchPlaceholder="Search methods…"
                emptyText="No methods found."
                icon={CreditCard}
              />
            </div>
            <div className="space-y-2">
              <Label className="font-body text-xs text-charcoal/60">Source</Label>
              <FilterSelect
                value={source}
                onChange={(v) => setSource(v as SourceFilter)}
                icon={Database}
                options={[
                  { value: "all", label: "All Sources" },
                  { value: "manual", label: "Manual expenses only" },
                ]}
              />
            </div>
            <div className="space-y-2 sm:col-span-2 lg:col-span-3">
              <Label className="font-body text-xs text-charcoal/60">Search</Label>
              <FilterSearch
                value={search}
                onChange={setSearch}
                placeholder="Party, category, method, reference…"
                aria-label="Search ledger"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {data?.truncated && (
            <p className="mb-3 font-body text-xs text-charcoal/50">
              Showing the most recent {entries.length} transactions.
            </p>
          )}

          <div className="rounded-xl border border-sage/15 bg-white-warm overflow-hidden">
            <ResponsiveTable>
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHeader sortKey="date" active={sortKey} dir={sortDir} onToggle={toggle} className="w-[140px]">Date</SortableHeader>
                    <SortableHeader sortKey="party" active={sortKey} dir={sortDir} onToggle={toggle} className="w-[180px]">Party</SortableHeader>
                    <SortableHeader sortKey="category" active={sortKey} dir={sortDir} onToggle={toggle}>Category</SortableHeader>
                    <SortableHeader sortKey="method" active={sortKey} dir={sortDir} onToggle={toggle} className="w-[150px]">Method</SortableHeader>
                    <SortableHeader sortKey="direction" active={sortKey} dir={sortDir} onToggle={toggle} className="w-[120px]">Direction</SortableHeader>
                    <SortableHeader sortKey="amount" active={sortKey} dir={sortDir} onToggle={toggle} className="w-[130px] text-right" align="right">Amount</SortableHeader>
                    <TableHead className="w-[64px]">Proof</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pg.pageItems.map((e: LedgerEntry) => {
                    const mp = e.method ? paymentMethodPill(e.method) : null;
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="whitespace-nowrap font-body">{fmtDate(e.occurredAtISO)}</TableCell>
                        <TableCell className="font-body">{e.party}</TableCell>
                        <TableCell><Pill tone="neutral">{e.category}</Pill></TableCell>
                        <TableCell>
                          {mp ? <Pill tone={mp.tone} brand={mp.brand}>{mp.label}</Pill> : <span className="text-charcoal/40">—</span>}
                        </TableCell>
                        <TableCell>
                          <Pill tone={e.direction === "credit" ? "success" : "danger"}>
                            {e.direction === "credit" ? "Credit" : "Debit"}
                          </Pill>
                        </TableCell>
                        <TableCell className={`text-right font-medium ${e.direction === "credit" ? "text-sage" : "text-terracotta"}`}>
                          {e.direction === "credit" ? "+" : "−"}{inr(e.amountPaise)}
                        </TableCell>
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
                  })}
                </TableBody>
              </Table>
            </ResponsiveTable>
          </div>

          <Pagination page={pg.page} total={pg.total} onChange={pg.setPage} />

          {filtered.length === 0 && (
            <div className="text-center py-12">
              <Filter className="h-12 w-12 text-charcoal/20 mx-auto mb-3" />
              <div className="font-body text-charcoal/60">No transactions match your filters</div>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 border-sage/20 text-sage hover:bg-sage/5 hover:text-sage!"
                onClick={resetFilters}
              >
                Clear Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export const FinanceLedgerSection = memo(FinanceLedgerSectionImpl);
