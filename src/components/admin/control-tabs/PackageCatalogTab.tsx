import { useCallback, useEffect, useState } from "react";
import { Loader2, Package as PackageIcon, Plus, Pencil, Trash2, Star } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogFooter,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/responsive/ResponsiveDialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { offerState } from "@/lib/packageOffer";

type PackageRow = {
  id: string;
  name: string;
  type: string;
  price: number;
  class_count: number | null;
  duration_months: number | null;
  is_unlimited: boolean;
  includes_physique_57: boolean;
  benefits: string[];
  featured: boolean;
  badge: string | null;
  display_order: number;
  is_published: boolean;
  description: string | null;
  offer_price: number | null;
  offer_label: string | null;
  offer_starts_at: string | null;
  offer_ends_at: string | null;
};

type PackageForm = {
  name: string;
  type: string;
  price: string;
  is_unlimited: boolean;
  class_count: string;
  duration_months: string;
  includes_physique_57: boolean;
  benefitsText: string;
  featured: boolean;
  badge: string;
  display_order: string;
  is_published: boolean;
  description: string;
  offer_price: string;
  offer_label: string;
  offer_starts_at: string;
  offer_ends_at: string;
};

const EMPTY_FORM: PackageForm = {
  name: "",
  type: "class_pass",
  price: "",
  is_unlimited: false,
  class_count: "",
  duration_months: "",
  includes_physique_57: false,
  benefitsText: "",
  featured: false,
  badge: "",
  display_order: "0",
  is_published: true,
  description: "",
  offer_price: "",
  offer_label: "",
  offer_starts_at: "",
  offer_ends_at: "",
};

/**
 * Stored UTC ISO → `YYYY-MM-DDTHH:mm` in the admin's LOCAL wall-clock, for a
 * `datetime-local` input. submit() parses the input back as local time, so this
 * keeps the round-trip stable (a `.toISOString().slice(0,16)` here would show UTC
 * and silently shift the saved instant by the admin's offset on every save).
 */
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function rowToForm(p: PackageRow): PackageForm {
  return {
    name: p.name ?? "",
    type: p.type ?? "class_pass",
    price: String(p.price ?? ""),
    is_unlimited: !!p.is_unlimited,
    class_count: p.class_count == null ? "" : String(p.class_count),
    duration_months: p.duration_months == null ? "" : String(p.duration_months),
    includes_physique_57: !!p.includes_physique_57,
    benefitsText: (p.benefits ?? []).join("\n"),
    featured: !!p.featured,
    badge: p.badge ?? "",
    display_order: String(p.display_order ?? 0),
    is_published: p.is_published !== false,
    description: p.description ?? "",
    offer_price: p.offer_price == null ? "" : String(p.offer_price),
    offer_label: p.offer_label ?? "",
    offer_starts_at: toDatetimeLocal(p.offer_starts_at),
    offer_ends_at: toDatetimeLocal(p.offer_ends_at),
  };
}

export default function PackageCatalogTab() {
  const [rows, setRows] = useState<PackageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PackageForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/packages", { headers: { "Cache-Control": "no-store" } });
    if (!r.ok) {
      toast.error("Could not load packages.");
      return;
    }
    const d = await r.json();
    const list: PackageRow[] = Array.isArray(d) ? d : (d.packages ?? d.packageTypes ?? []);
    setRows(list.map((p) => ({ ...p, price: Number(p.price), offer_price: p.offer_price == null ? null : Number(p.offer_price), benefits: p.benefits ?? [] })));
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        await load();
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const openCreate = useCallback(() => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }, []);

  const openEdit = useCallback((p: PackageRow) => {
    setEditingId(p.id);
    setForm(rowToForm(p));
    setDialogOpen(true);
  }, []);

  const patch = useCallback(<K extends keyof PackageForm>(key: K, value: PackageForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

  const submit = useCallback(async () => {
    if (!form.name.trim()) {
      toast.error("Name is required.");
      return;
    }
    const price = Number(form.price);
    if (!Number.isFinite(price) || price < 0) {
      toast.error("Enter a valid price.");
      return;
    }
    const offerPriceNum = form.offer_price.trim() === "" ? null : Number(form.offer_price);
    if (offerPriceNum != null && (!Number.isFinite(offerPriceNum) || offerPriceNum <= 0 || offerPriceNum >= price)) {
      toast.error("Offer price must be greater than 0 and less than the regular price.");
      return;
    }
    if (form.offer_starts_at && form.offer_ends_at && new Date(form.offer_starts_at) >= new Date(form.offer_ends_at)) {
      toast.error("Offer start must be before offer end.");
      return;
    }
    const benefits = form.benefitsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      type: form.type.trim() || "class_pass",
      price,
      is_unlimited: form.is_unlimited,
      class_count: form.is_unlimited || form.class_count === "" ? null : Number(form.class_count),
      duration_months: form.duration_months === "" ? null : Number(form.duration_months),
      includes_physique_57: form.includes_physique_57,
      benefits,
      featured: form.featured,
      badge: form.badge.trim() || null,
      display_order: Number(form.display_order) || 0,
      is_published: form.is_published,
      description: form.description.trim() || null,
      offer_price: offerPriceNum,
      offer_label: form.offer_label.trim() || null,
      offer_starts_at: form.offer_starts_at ? new Date(form.offer_starts_at).toISOString() : null,
      offer_ends_at: form.offer_ends_at ? new Date(form.offer_ends_at).toISOString() : null,
    };

    setSaving(true);
    try {
      const r = await fetch("/api/packages", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { id: editingId, ...payload } : payload),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        toast.error(e.error ?? "Could not save package.");
        return;
      }
      toast.success(editingId ? "Package updated." : "Package created.");
      setDialogOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }, [form, editingId, load]);

  const remove = useCallback(
    async (p: PackageRow) => {
      if (!window.confirm(`Delete "${p.name}"? If members hold this package it will be unpublished instead.`)) return;
      setDeletingId(p.id);
      try {
        const r = await fetch(`/api/packages?id=${encodeURIComponent(p.id)}`, { method: "DELETE" });
        if (!r.ok) {
          const e = await r.json().catch(() => ({}));
          toast.error(e.error ?? "Could not delete package.");
          return;
        }
        const d = await r.json().catch(() => ({}));
        toast.success(d.softDeleted ? "Package unpublished (in use by members)." : "Package deleted.");
        await load();
      } finally {
        setDeletingId(null);
      }
    },
    [load],
  );

  return (
    <Card className="border-sage/20 bg-white-warm">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="font-display text-2xl text-charcoal">Package Catalog</CardTitle>
          <CardDescription className="font-body text-charcoal/60">
            Packages members can buy and admins can grant. The portal renders published packages from here.
          </CardDescription>
        </div>
        <Button type="button" variant="sage" size="sm" onClick={openCreate} className="shrink-0 gap-1.5">
          <Plus className="h-4 w-4" /> Add Package
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-12 text-center font-body text-sm text-charcoal/40">Loading catalog…</div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center font-body text-sm text-charcoal/40">
            <PackageIcon className="mx-auto mb-3 h-10 w-10 text-charcoal/20" /> No packages yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-sage/15 bg-white-warm">
            <ResponsiveTable>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Package</TableHead>
                    <TableHead className="w-[120px]">Type</TableHead>
                    <TableHead className="w-[110px]">Classes</TableHead>
                    <TableHead className="w-[110px]">Validity</TableHead>
                    <TableHead className="w-[120px] text-right">Price (₹)</TableHead>
                    <TableHead className="w-[150px]">Status</TableHead>
                    <TableHead className="w-[110px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-body text-sm text-charcoal">
                        <div className="flex items-center gap-2">
                          {p.featured && <Star className="h-3.5 w-3.5 fill-terracotta text-terracotta" />}
                          {p.name}
                          {p.badge && (
                            <Pill tone="warning" size="sm" noIcon>
                              {p.badge}
                            </Pill>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-body text-xs text-charcoal/60">{p.type}</TableCell>
                      <TableCell className="font-body text-sm text-charcoal/70">
                        {p.is_unlimited ? "Unlimited" : (p.class_count ?? "—")}
                      </TableCell>
                      <TableCell className="font-body text-sm text-charcoal/70">
                        {p.duration_months ? `${p.duration_months} mo` : "—"}
                      </TableCell>
                      <TableCell className="text-right font-body text-sm text-charcoal">
                        {offerState(p, new Date()) === "active" ? (
                          <div className="flex flex-col items-end">
                            <span className="text-charcoal/40 line-through">{p.price.toLocaleString("en-IN")}</span>
                            <span className="font-semibold text-terracotta">
                              {p.offer_price?.toLocaleString("en-IN") ?? "—"}
                            </span>
                          </div>
                        ) : (
                          p.price.toLocaleString("en-IN")
                        )}
                      </TableCell>
                      <TableCell>
                        {p.is_published ? (
                          <Pill tone="success" size="sm">
                            Published
                          </Pill>
                        ) : (
                          <Pill tone="neutral" size="sm">
                            Hidden
                          </Pill>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button type="button" variant="ghost" size="icon" onClick={() => openEdit(p)} title="Edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={deletingId === p.id}
                            onClick={() => remove(p)}
                            title="Delete"
                          >
                            {deletingId === p.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4 text-pill-danger-fg" />
                            )}
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
      </CardContent>

      <ResponsiveDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ResponsiveDialogContent className="sm:max-w-xl">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="font-display text-charcoal">
              {editingId ? "Edit Package" : "New Package"}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="font-body text-charcoal/60">
              {editingId ? "Update this package's details." : "Add a package to the catalog."}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="pkg-name">Name</Label>
              <Input id="pkg-name" value={form.name} onChange={(e) => patch("name", e.target.value)} placeholder="e.g. 12 Class Pass" />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="pkg-type">Type</Label>
                <Select value={form.type} onValueChange={(v) => patch("type", v)}>
                  <SelectTrigger id="pkg-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="class_pass">Class Pass</SelectItem>
                    <SelectItem value="studio_pass">Studio Pass</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="pkg-price">Price (₹)</Label>
                <Input
                  id="pkg-price"
                  type="number"
                  min="0"
                  inputMode="decimal"
                  value={form.price}
                  onChange={(e) => patch("price", e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-sage/15 px-3 py-2.5">
              <div>
                <Label htmlFor="pkg-unlimited" className="cursor-pointer">Unlimited classes</Label>
                <p className="font-body text-xs text-charcoal/50">Studio pass — no class counter.</p>
              </div>
              <Switch id="pkg-unlimited" checked={form.is_unlimited} onCheckedChange={(c) => patch("is_unlimited", c)} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="pkg-classes">Class count</Label>
                <Input
                  id="pkg-classes"
                  type="number"
                  min="0"
                  inputMode="numeric"
                  disabled={form.is_unlimited}
                  value={form.class_count}
                  onChange={(e) => patch("class_count", e.target.value)}
                  placeholder={form.is_unlimited ? "Unlimited" : "e.g. 12"}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="pkg-validity">Validity (months)</Label>
                <Input
                  id="pkg-validity"
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={form.duration_months}
                  onChange={(e) => patch("duration_months", e.target.value)}
                  placeholder="e.g. 1"
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="pkg-benefits">Benefits (one per line)</Label>
              <Textarea
                id="pkg-benefits"
                rows={4}
                value={form.benefitsText}
                onChange={(e) => patch("benefitsText", e.target.value)}
                placeholder={"Access to all classes\nFree mat rental"}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="pkg-description">Description</Label>
              <Textarea
                id="pkg-description"
                rows={2}
                value={form.description}
                onChange={(e) => patch("description", e.target.value)}
              />
            </div>

            <div className="rounded-lg border border-terracotta/25 bg-terracotta/[0.04] p-3">
              <div className="mb-3 flex items-center justify-between">
                <Label className="font-body text-sm font-semibold text-charcoal">Special offer</Label>
                {(() => {
                  const st = offerState(
                    {
                      price: Number(form.price) || 0,
                      offer_price: form.offer_price === "" ? null : Number(form.offer_price),
                      offer_starts_at: form.offer_starts_at || null,
                      offer_ends_at: form.offer_ends_at || null,
                    },
                    new Date(),
                  );
                  const tone = st === "active" ? "success" : st === "scheduled" ? "info" : st === "expired" ? "danger" : "neutral";
                  return (
                    <Pill tone={tone} size="sm" noIcon>
                      {st === "none" ? "No offer" : st[0].toUpperCase() + st.slice(1)}
                    </Pill>
                  );
                })()}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="pkg-offer-price">Offer price (₹)</Label>
                  <Input
                    id="pkg-offer-price"
                    type="number"
                    min="0"
                    inputMode="decimal"
                    value={form.offer_price}
                    onChange={(e) => patch("offer_price", e.target.value)}
                    placeholder="Leave blank for no offer"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="pkg-offer-label">Offer label</Label>
                  <Input
                    id="pkg-offer-label"
                    value={form.offer_label}
                    onChange={(e) => patch("offer_label", e.target.value)}
                    placeholder="e.g. Festive Sale"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="pkg-offer-start">Starts (optional)</Label>
                  <Input
                    id="pkg-offer-start"
                    type="datetime-local"
                    value={form.offer_starts_at}
                    onChange={(e) => patch("offer_starts_at", e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="pkg-offer-end">Ends (optional)</Label>
                  <Input
                    id="pkg-offer-end"
                    type="datetime-local"
                    value={form.offer_ends_at}
                    onChange={(e) => patch("offer_ends_at", e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="pkg-badge">Badge</Label>
                <Input
                  id="pkg-badge"
                  value={form.badge}
                  onChange={(e) => patch("badge", e.target.value)}
                  placeholder="e.g. Most Popular"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="pkg-order">Display order</Label>
                <Input
                  id="pkg-order"
                  type="number"
                  inputMode="numeric"
                  value={form.display_order}
                  onChange={(e) => patch("display_order", e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-sage/15 px-3 py-2.5">
              <Label htmlFor="pkg-featured" className="cursor-pointer">Featured (Most Popular)</Label>
              <Switch id="pkg-featured" checked={form.featured} onCheckedChange={(c) => patch("featured", c)} />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-sage/15 px-3 py-2.5">
              <Label htmlFor="pkg-p57" className="cursor-pointer">Includes Physique 57</Label>
              <Switch
                id="pkg-p57"
                checked={form.includes_physique_57}
                onCheckedChange={(c) => patch("includes_physique_57", c)}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-sage/15 px-3 py-2.5">
              <div>
                <Label htmlFor="pkg-published" className="cursor-pointer">Published</Label>
                <p className="font-body text-xs text-charcoal/50">Visible to members in the portal.</p>
              </div>
              <Switch id="pkg-published" checked={form.is_published} onCheckedChange={(c) => patch("is_published", c)} />
            </div>
          </div>

          <ResponsiveDialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" variant="sage" onClick={submit} disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? "Save Changes" : "Create Package"}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </Card>
  );
}
