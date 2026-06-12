import { memo, useCallback, useEffect, useState } from "react";
import { Loader2, Tag } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type PackageTypeRow = {
  id: string;
  name: string;
  type: string;
  price: number;
  class_count: number | null;
  duration_months: number | null;
};

function CatalogPricesSectionImpl() {
  const [rows, setRows] = useState<PackageTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/packages");
    if (!r.ok) return;
    const d = await r.json();
    const list: PackageTypeRow[] = Array.isArray(d) ? d : (d.packages ?? d.packageTypes ?? []);
    setRows(list.map((p) => ({ ...p, price: Number(p.price) })));
  }, []);

  useEffect(() => {
    void (async () => { setLoading(true); try { await load(); } finally { setLoading(false); } })();
  }, [load]);

  const save = useCallback(async (id: string) => {
    const val = Number(draft[id]);
    if (!Number.isFinite(val) || val < 0) { toast.error("Enter a valid price."); return; }
    setSavingId(id);
    try {
      const r = await fetch("/api/packages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, price: val }),
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); toast.error(e.error ?? "Could not save price."); return; }
      toast.success("Price updated.");
      setDraft((d) => { const n = { ...d }; delete n[id]; return n; });
      await load();
    } finally { setSavingId(null); }
  }, [draft, load]);

  return (
    <Card className="border-sage/20 bg-white-warm">
      <CardHeader>
        <CardTitle className="font-display text-2xl text-charcoal">Package Catalog</CardTitle>
        <CardDescription className="font-body text-charcoal/60">
          Edit package prices. These amounts are the default when moving a class grant to money-in.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-12 text-center font-body text-sm text-charcoal/40">Loading catalog…</div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center font-body text-sm text-charcoal/40">
            <Tag className="h-10 w-10 text-charcoal/20 mx-auto mb-3" /> No packages found.
          </div>
        ) : (
          <div className="rounded-xl border border-sage/15 bg-white-warm overflow-hidden">
            <ResponsiveTable>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Package</TableHead>
                    <TableHead className="w-[120px]">Type</TableHead>
                    <TableHead className="w-[100px]">Classes</TableHead>
                    <TableHead className="w-[220px] text-right">Price (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((p) => {
                    const editing = draft[p.id] !== undefined;
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-body text-sm text-charcoal">{p.name}</TableCell>
                        <TableCell className="font-body text-xs text-charcoal/60">{p.type}</TableCell>
                        <TableCell className="font-body text-sm text-charcoal/70">{p.class_count ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Input
                              type="number" min="0" inputMode="decimal"
                              value={editing ? draft[p.id] : String(p.price)}
                              onChange={(e) => setDraft((d) => ({ ...d, [p.id]: e.target.value }))}
                              className="w-28 border-sage/20 bg-white text-right"
                            />
                            <Button
                              type="button" variant="sage" size="sm"
                              disabled={!editing || savingId === p.id}
                              onClick={() => save(p.id)}
                            >
                              {savingId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
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
  );
}

export const CatalogPricesSection = memo(CatalogPricesSectionImpl);
export default CatalogPricesSection;
