import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ExternalLink,
  Filter,
  Loader2,
  Scale,
  Search,
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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { MetricCard } from "@/components/admin/MetricCard";
import { FilterCombobox } from "@/components/admin/FilterCombobox";
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

// Same date-range semantics as the Transactions tab (today / this week / month).
function passesDateRange(iso: string, range: string): boolean {
  if (range === "all") return true;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return true;
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endToday = new Date(startToday);
  endToday.setDate(endToday.getDate() + 1);
  if (range === "today") return day >= startToday && day < endToday;
  if (range === "week") {
    const cutoff = new Date(startToday);
    cutoff.setDate(cutoff.getDate() - 7);
    return day >= cutoff && day < endToday;
  }
  if (range === "month") {
    return day.getFullYear() === now.getFullYear() && day.getMonth() === now.getMonth();
  }
  return true;
}

type DirFilter = "all" | "credit" | "debit";
type SourceFilter = "all" | "manual";
type LedgerSortKey = "date" | "party" | "category" | "method" | "direction" | "amount";

function FinanceLedgerSectionImpl() {
  const [data, setData] = useState<FinanceLedgerResult | null>(null);
  const [loading, setLoading] = useState(true);

  const [dir, setDir] = useState<DirFilter>("all");
  const [dateRange, setDateRange] = useState("all");
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
    setDateRange("all");
    setCategory("all");
    setParty("all");
    setMethod("all");
    setSource("all");
    setSearch("");
  }, []);

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
    `${dir}|${dateRange}|${category}|${party}|${method}|${source}|${search}|${sortKey}|${sortDir}`,
  );

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
          <div className="mb-4">
            <CardTitle className="font-display text-2xl text-charcoal">Ledger</CardTitle>
            <CardDescription className="font-body text-charcoal/60">
              Every transaction — payments, expenses, payouts, refunds — in one place
            </CardDescription>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4 rounded-xl bg-cream/30 border border-sage/20">
            <div className="space-y-2">
              <Label className="font-body text-xs text-charcoal/60">Direction</Label>
              <Select value={dir} onValueChange={(v) => setDir(v as DirFilter)}>
                <SelectTrigger className="border-sage/20 bg-white-warm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="credit">💰 Credit (in)</SelectItem>
                  <SelectItem value="debit">💸 Debit (out)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="font-body text-xs text-charcoal/60">Date Range</Label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="border-sage/20 bg-white-warm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="font-body text-xs text-charcoal/60">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="border-sage/20 bg-white-warm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categoryOptions.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              />
            </div>
            <div className="space-y-2">
              <Label className="font-body text-xs text-charcoal/60">Source</Label>
              <Select value={source} onValueChange={(v) => setSource(v as SourceFilter)}>
                <SelectTrigger className="border-sage/20 bg-white-warm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="manual">Manual expenses only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2 lg:col-span-3">
              <Label className="font-body text-xs text-charcoal/60">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-charcoal/40" />
                <Input
                  placeholder="Party, category, method, reference…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="border-sage/20 bg-white-warm pl-9"
                />
              </div>
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
                className="mt-4 border-sage/20 text-sage hover:bg-sage/5"
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
