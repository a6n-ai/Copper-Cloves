import { memo, useCallback } from "react";
import { BarChart3, CheckCircle2, Tag, TrendingUp } from "lucide-react";
import { SortableHeader, useTableSort } from "@/components/admin/sortable-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/admin/MetricCard";
import { Pagination, usePagination } from "@/components/Pagination";
import { COUPON_CONTEXTS } from "@/lib/couponHelpers";

export interface Coupon {
  id: string;
  code: string;
  applies_to: string;
  discount_type: string;
  discount_value: unknown;
  is_active: boolean;
  max_redemptions: number | null;
  redemption_count: number;
  max_uses_per_user: number | null;
  starts_at: Date | string | null;
  ends_at: Date | string | null;
}

export interface CouponDraft {
  code: string;
  applies_to: string;
  discount_type: string;
  discount_value: string;
  is_active: boolean;
  max_redemptions: string;
  max_uses_per_user: string;
  starts_at: string;
  ends_at: string;
}

interface Props {
  coupons: Coupon[];
  loading: boolean;
  saving: boolean;
  editingId: string | null;
  draft: CouponDraft;
  onDraftChange: (draft: CouponDraft) => void;
  onSave: () => void;
  onCancelEdit: () => void;
  onEdit: (c: Coupon) => void;
  onDelete: (id: string) => void;
}

function PricingTabImpl({
  coupons,
  loading,
  saving,
  editingId,
  draft,
  onDraftChange,
  onSave,
  onCancelEdit,
  onEdit,
  onDelete,
}: Props) {
  type CouponSortKey = "code" | "scope" | "discount" | "uses" | "status";
  const getValue = useCallback((row: Coupon, key: CouponSortKey): number | string => {
    switch (key) {
      case "code": return row.code;
      case "scope": return row.applies_to;
      case "discount": return Number(row.discount_value) || 0;
      case "uses": return row.redemption_count;
      case "status": return row.is_active ? 1 : 0;
    }
  }, []);
  const { sorted: sortedCoupons, sortKey, sortDir, toggle } = useTableSort(coupons, {
    initialKey: null,
    initialDir: "asc",
    getValue,
    defaultDirFor: (k) => (k === "code" || k === "scope" ? "asc" : "desc"),
  });
  const pagination = usePagination(sortedCoupons, 10, `${sortKey}|${sortDir}`);

  const totalCoupons = coupons.length;
  const activeCoupons = coupons.filter((c) => c.is_active).length;
  const totalRedemptions = coupons.reduce((s, c) => s + (c.redemption_count ?? 0), 0);
  const scopeTally: Record<string, number> = {};
  for (const c of coupons) scopeTally[c.applies_to] = (scopeTally[c.applies_to] ?? 0) + 1;
  const topScope = Object.entries(scopeTally).sort((a, b) => b[1] - a[1])[0];
  const topLabel = topScope
    ? COUPON_CONTEXTS.find((x) => x.value === topScope[0])?.label ?? topScope[0]
    : "—";

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Total Coupons" value={totalCoupons} icon={Tag} tone="sage" loading={loading} />
        <MetricCard label="Active" value={activeCoupons} icon={CheckCircle2} tone="sage" loading={loading} hint="Live for checkout" />
        <MetricCard label="Redemptions" value={totalRedemptions} icon={TrendingUp} tone="terracotta" loading={loading} />
        <MetricCard label="Top scope" value={topLabel} icon={BarChart3} tone="charcoal" loading={loading} hint={topScope ? `${topScope[1]} coupons` : ""} />
      </div>
      <Card className="border-sage/20 bg-white-warm">
        <CardHeader>
          <CardTitle className="font-display text-2xl text-charcoal">Coupons & discounts</CardTitle>
          <CardDescription className="font-body text-charcoal/60">
            Create codes for Food (café), Ecommerce (boutique), Class pass, or Studio pass. Members enter a code at checkout.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4 rounded-xl border border-sage/15 bg-cream/20">
            <div className="space-y-3">
              <div>
                <Label className="font-body text-charcoal">Coupon code</Label>
                <Input
                  value={draft.code}
                  onChange={(e) => onDraftChange({ ...draft, code: e.target.value })}
                  placeholder="E.g. SUMMER20"
                  className="border-sage/20 mt-1 font-mono uppercase"
                />
              </div>
              <div>
                <Label className="font-body text-charcoal">Applies to</Label>
                <Select
                  value={draft.applies_to}
                  onValueChange={(v) => onDraftChange({ ...draft, applies_to: v })}
                >
                  <SelectTrigger className="border-sage/20 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COUPON_CONTEXTS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="font-body text-charcoal">Discount type</Label>
                  <Select
                    value={draft.discount_type}
                    onValueChange={(v) => onDraftChange({ ...draft, discount_type: v })}
                  >
                    <SelectTrigger className="border-sage/20 mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Percent %</SelectItem>
                      <SelectItem value="fixed">Fixed ₹</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="font-body text-charcoal">
                    {draft.discount_type === "percent" ? "Percent off" : "Amount (₹)"}
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    step={draft.discount_type === "percent" ? 1 : 1}
                    value={draft.discount_value}
                    onChange={(e) => onDraftChange({ ...draft, discount_value: e.target.value })}
                    className="border-sage/20 mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="font-body text-charcoal">Max uses (total)</Label>
                  <Input
                    placeholder="Unlimited"
                    value={draft.max_redemptions}
                    onChange={(e) => onDraftChange({ ...draft, max_redemptions: e.target.value })}
                    className="border-sage/20 mt-1"
                  />
                </div>
                <div>
                  <Label className="font-body text-charcoal">Max / user</Label>
                  <Input
                    placeholder="Unlimited"
                    value={draft.max_uses_per_user}
                    onChange={(e) => onDraftChange({ ...draft, max_uses_per_user: e.target.value })}
                    className="border-sage/20 mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="font-body text-charcoal">Starts (optional)</Label>
                  <Input
                    type="datetime-local"
                    value={draft.starts_at}
                    onChange={(e) => onDraftChange({ ...draft, starts_at: e.target.value })}
                    className="border-sage/20 mt-1"
                  />
                </div>
                <div>
                  <Label className="font-body text-charcoal">Ends (optional)</Label>
                  <Input
                    type="datetime-local"
                    value={draft.ends_at}
                    onChange={(e) => onDraftChange({ ...draft, ends_at: e.target.value })}
                    className="border-sage/20 mt-1"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Switch
                  id="coupon-active"
                  checked={draft.is_active}
                  onCheckedChange={(v) => onDraftChange({ ...draft, is_active: v })}
                />
                <Label htmlFor="coupon-active" className="font-body text-charcoal cursor-pointer">
                  Active
                </Label>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button type="button" onClick={onSave} disabled={saving} variant="sage">
                  {saving ? "Saving..." : editingId ? "Update coupon" : "Create coupon"}
                </Button>
                {editingId && (
                  <Button
                    type="button"
                    variant="outline"
                    className="border-sage/30 font-body"
                    onClick={onCancelEdit}
                  >
                    Cancel edit
                  </Button>
                )}
              </div>
            </div>
            <div className="rounded-xl bg-white-warm border border-sage/10 p-4">
              <p className="font-body text-sm text-charcoal/70 leading-relaxed">
                Fixed amount never exceeds cart or package subtotal. Percent is capped at 100%.
                Café and boutique prices are taken from the database at checkout so codes cannot be abused with
                fake totals. Package coupons match studio vs class pass automatically.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {loading ? (
              <p className="p-6 font-body text-charcoal/60">Loading coupons…</p>
            ) : coupons.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-sage/20 rounded-xl bg-cream/20">
                <p className="font-body text-sm text-charcoal/50">No coupons yet. Create one on the left.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-sage/15 bg-white overflow-hidden">
                <ResponsiveTable>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-sage/5 hover:bg-sage/5 border-sage/10">
                        <SortableHeader sortKey="code" active={sortKey} dir={sortDir} onToggle={toggle}>Code</SortableHeader>
                        <SortableHeader sortKey="scope" active={sortKey} dir={sortDir} onToggle={toggle}>Scope</SortableHeader>
                        <SortableHeader sortKey="discount" active={sortKey} dir={sortDir} onToggle={toggle}>Discount</SortableHeader>
                        <SortableHeader sortKey="uses" active={sortKey} dir={sortDir} onToggle={toggle}>Uses</SortableHeader>
                        <SortableHeader sortKey="status" active={sortKey} dir={sortDir} onToggle={toggle}>Status</SortableHeader>
                        <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3 w-[180px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagination.pageItems.map((c) => (
                        <TableRow key={c.id} className="border-sage/10">
                          <TableCell className="px-5 py-3 font-mono font-semibold text-charcoal">{c.code}</TableCell>
                          <TableCell className="px-5 py-3 font-body text-sm text-charcoal/80">
                            {COUPON_CONTEXTS.find((x) => x.value === c.applies_to)?.label ?? c.applies_to}
                          </TableCell>
                          <TableCell className="px-5 py-3 font-body text-sm text-charcoal">
                            {c.discount_type === "percent" ? `${c.discount_value}%` : `₹${c.discount_value}`}
                          </TableCell>
                          <TableCell className="px-5 py-3 font-body text-sm text-charcoal/80 tabular-nums">
                            {c.redemption_count}
                            {c.max_redemptions != null ? ` / ${c.max_redemptions}` : ""}
                          </TableCell>
                          <TableCell className="px-5 py-3">
                            <Badge className={c.is_active ? "bg-sage text-white font-body" : "bg-charcoal/15 text-charcoal/70 font-body"}>
                              {c.is_active ? "Active" : "Off"}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-5 py-3">
                            <div className="flex items-center gap-1.5">
                              <Button type="button" size="sm" variant="sage-outline" className="h-8" onClick={() => onEdit(c)}>
                                Edit
                              </Button>
                              <Button type="button" size="sm" variant="outline" className="border-[#a05e38]/25 text-[#a05e38] hover:bg-[#a05e38]/10 font-body h-8" onClick={() => onDelete(c.id)}>
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ResponsiveTable>
              </div>
            )}
            <Pagination page={pagination.page} total={pagination.total} onChange={pagination.setPage} />
          </div>
        </CardContent>
      </Card>
    </>
  );
}

export const PricingTab = memo(PricingTabImpl);
