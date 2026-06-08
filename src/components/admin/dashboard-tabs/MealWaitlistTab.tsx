import { memo, useCallback } from "react";
import { AlertTriangle, CheckCircle2, ChefHat } from "lucide-react";
import { SortableHeader, useTableSort } from "@/components/admin/sortable-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MetricCard } from "@/components/admin/MetricCard";
import { Pagination, usePagination } from "@/components/Pagination";

export interface MealInquiry {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  message: string | null;
  status: string;
  source: string;
  created_at: string;
}

interface Props {
  inquiries: MealInquiry[];
  loading: boolean;
  onUpdateStatus: (id: string, status: string) => void;
}

function MealWaitlistTabImpl({ inquiries, loading, onUpdateStatus }: Props) {
  const total = inquiries.length;
  const byStatus = (s: string) => inquiries.filter((r) => r.status === s).length;

  type MealSortKey = "date" | "name" | "status";
  const getValue = useCallback((row: MealInquiry, key: MealSortKey): number | string => {
    switch (key) {
      case "date": return new Date(row.created_at).getTime();
      case "name": return row.full_name;
      case "status": return row.status;
    }
  }, []);
  const { sorted, sortKey, sortDir, toggle } = useTableSort(inquiries, {
    initialKey: "date",
    initialDir: "desc",
    getValue,
    defaultDirFor: (k) => (k === "name" || k === "status" ? "asc" : "desc"),
  });
  const pagination = usePagination(sorted, 10, `${sortKey}|${sortDir}`);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Total Inquiries" value={total} icon={ChefHat} tone="sage" loading={loading} />
        <MetricCard label="New" value={byStatus("new")} icon={AlertTriangle} tone="amber" loading={loading} hint="Awaiting outreach" />
        <MetricCard label="Contacted" value={byStatus("contacted")} icon={CheckCircle2} tone="terracotta" loading={loading} />
        <MetricCard label="Closed" value={byStatus("closed")} icon={CheckCircle2} tone="charcoal" loading={loading} />
      </div>
      <Card className="border-sage/20 bg-white-warm">
        <CardHeader>
          <CardTitle className="font-display text-2xl text-charcoal">Meal subscription waitlist</CardTitle>
          <CardDescription className="font-body text-charcoal/60">
            Submissions from the &ldquo;Join the Waitlist&rdquo; form on the meal subscription page. Newest first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="font-body text-charcoal/60 py-8">Loading…</p>
          ) : inquiries.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-sage/20 rounded-xl bg-cream/20">
              <p className="font-body text-sm text-charcoal/50">No enquiries yet.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-sage/15 bg-white-warm overflow-hidden">
              <ResponsiveTable>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHeader sortKey="date" active={sortKey} dir={sortDir} onToggle={toggle} className="w-[160px]">Date</SortableHeader>
                      <SortableHeader sortKey="name" active={sortKey} dir={sortDir} onToggle={toggle}>Name</SortableHeader>
                      <TableHead>Contact</TableHead>
                      <TableHead className="min-w-[200px]">Message</TableHead>
                      <SortableHeader sortKey="status" active={sortKey} dir={sortDir} onToggle={toggle} className="w-[160px]">Status</SortableHeader>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagination.pageItems.map((row) => (
                      <TableRow key={row.id} className="align-top">
                        <TableCell className="font-body text-sm text-charcoal/70 whitespace-nowrap">
                          {new Date(row.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                        </TableCell>
                        <TableCell className="font-body font-medium text-charcoal">{row.full_name}</TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <a href={`mailto:${row.email}`} className="block font-body text-sm text-sage hover:underline break-all">{row.email}</a>
                            <a href={`tel:${row.phone}`} className="block font-body text-xs text-charcoal/60 hover:text-sage whitespace-nowrap">{row.phone}</a>
                          </div>
                        </TableCell>
                        <TableCell className="font-body text-sm text-charcoal/70 max-w-md whitespace-pre-wrap">
                          {row.message?.trim() ? row.message : "—"}
                        </TableCell>
                        <TableCell>
                          <Select value={row.status} onValueChange={(v) => onUpdateStatus(row.id, v)}>
                            <SelectTrigger className="w-[140px] border-sage/20 h-9 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="new">New</SelectItem>
                              <SelectItem value="contacted">Contacted</SelectItem>
                              <SelectItem value="closed">Closed</SelectItem>
                            </SelectContent>
                          </Select>
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

export const MealWaitlistTab = memo(MealWaitlistTabImpl);
