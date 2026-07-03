import { memo, useCallback, useMemo, useState } from "react";
import { AlertTriangle, Building2, CircleDot, Clock, Users } from "lucide-react";
import { SortableHeader, useTableSort } from "@/components/admin/sortable-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import { Pill } from "@/components/ui/pill";
import { MetricCard } from "@/components/admin/MetricCard";
import { Pagination, usePagination } from "@/components/Pagination";
import { FilterBar, FilterSearch, FilterSelect } from "@/components/filters";

export interface RentalInquiry {
  id: string;
  name: string;
  email: string;
  phone: string;
  event_type: string | null;
  event_date: string | null;
  guest_count: string | null;
  duration: string | null;
  message: string | null;
  status: string;
  created_at: string;
}

interface Props {
  inquiries: RentalInquiry[];
  loading: boolean;
}

function RentalInquiriesTabImpl({ inquiries, loading }: Props) {
  const total = inquiries.length;
  const byStatus = (s: string) => inquiries.filter((r) => r.status === s).length;
  const totalGuests = inquiries.reduce((sum, r) => sum + (Number(r.guest_count) || 0), 0);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const filtersDirty = search !== "" || statusFilter !== "all";
  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inquiries.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (q) {
        const hay = `${r.name} ${r.email} ${r.phone} ${r.event_type ?? ""} ${r.message ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [inquiries, search, statusFilter]);

  type RentalSortKey = "date" | "name" | "event" | "status";
  const getValue = useCallback((row: RentalInquiry, key: RentalSortKey): number | string => {
    switch (key) {
      case "date": return new Date(row.created_at).getTime();
      case "name": return row.name;
      case "event": return row.event_type ?? "";
      case "status": return row.status;
    }
  }, []);
  const { sorted, sortKey, sortDir, toggle } = useTableSort(filtered, {
    initialKey: "date",
    initialDir: "desc",
    getValue,
    defaultDirFor: (k) => (k === "date" ? "desc" : "asc"),
  });
  const pagination = usePagination(sorted, 10, `${search}|${statusFilter}|${sortKey}|${sortDir}`);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Total Inquiries" value={total} icon={Building2} tone="sage" loading={loading} />
        <MetricCard label="New" value={byStatus("new")} icon={AlertTriangle} tone="clay" loading={loading} hint="Awaiting reply" />
        <MetricCard label="In Review" value={byStatus("in_review")} icon={Clock} tone="terracotta" loading={loading} />
        <MetricCard label="Total Guests Asked" value={totalGuests} icon={Users} tone="charcoal" loading={loading} />
      </div>
      <Card className="border-sage/20 bg-white-warm">
        <CardHeader>
          <CardTitle className="font-body font-semibold text-2xl text-charcoal">Space rental inquiries</CardTitle>
          <CardDescription className="font-body text-charcoal/60">
            Submissions from the public rental page. Newest first.
          </CardDescription>
          <FilterBar reset={filtersDirty ? resetFilters : undefined} className="mt-4">
            <FilterSearch
              value={search}
              onChange={setSearch}
              placeholder="Search name, email, event…"
              aria-label="Search rental inquiries"
            />
            <FilterSelect
              value={statusFilter}
              onChange={setStatusFilter}
              icon={CircleDot}
              className="w-full sm:w-44"
              options={[
                { value: "all", label: "All statuses" },
                { value: "new", label: "New" },
                { value: "in_review", label: "In review" },
                { value: "closed", label: "Closed" },
              ]}
            />
          </FilterBar>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="font-body text-charcoal/60 py-8">Loading…</p>
          ) : sorted.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-sage/20 rounded-xl bg-cream/20">
              <p className="font-body text-sm text-charcoal/50">
                {filtersDirty ? "No inquiries match your filters." : "No inquiries yet."}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-sage/15 bg-white-warm overflow-hidden">
              <ResponsiveTable stack>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHeader sortKey="date" active={sortKey} dir={sortDir} onToggle={toggle} className="w-[160px]">Date</SortableHeader>
                      <SortableHeader sortKey="name" active={sortKey} dir={sortDir} onToggle={toggle}>Name</SortableHeader>
                      <TableHead>Contact</TableHead>
                      <SortableHeader sortKey="event" active={sortKey} dir={sortDir} onToggle={toggle}>Event</SortableHeader>
                      <TableHead className="min-w-[180px]">Notes</TableHead>
                      <SortableHeader sortKey="status" active={sortKey} dir={sortDir} onToggle={toggle} className="w-[120px]">Status</SortableHeader>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagination.pageItems.map((row) => (
                      <TableRow key={row.id} className="align-top">
                        <TableCell className="font-body text-sm text-charcoal/70 whitespace-nowrap">
                          {new Date(row.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                        </TableCell>
                        <TableCell className="font-body font-medium text-charcoal">{row.name}</TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <a href={`mailto:${row.email}`} className="block font-body text-sm text-sage hover:underline break-all">{row.email}</a>
                            <a href={`tel:${row.phone}`} className="block font-body text-xs text-charcoal/60 hover:text-sage whitespace-nowrap">{row.phone}</a>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-body text-sm text-charcoal">{row.event_type?.trim() ? row.event_type : "—"}</div>
                          <div className="font-body text-xs text-charcoal/50 mt-0.5">
                            {row.event_date?.trim() ? row.event_date : ""}
                            {row.guest_count?.trim() ? ` · ${row.guest_count} guests` : ""}
                            {row.duration?.trim() ? ` · ${row.duration}` : ""}
                          </div>
                        </TableCell>
                        <TableCell className="font-body text-sm text-charcoal/70 max-w-md whitespace-pre-wrap">
                          {row.message?.trim() ? row.message : "—"}
                        </TableCell>
                        <TableCell>
                          <Pill tone="success" className="capitalize font-body whitespace-nowrap">
                            {row.status.replace(/_/g, " ")}
                          </Pill>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ResponsiveTable>
            </div>
          )}
          <Pagination page={pagination.page} total={pagination.total} onChange={pagination.setPage} />
        </CardContent>
      </Card>
    </>
  );
}

export const RentalInquiriesTab = memo(RentalInquiriesTabImpl);
