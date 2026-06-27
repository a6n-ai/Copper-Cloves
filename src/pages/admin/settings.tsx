import { useCallback, useEffect, useState } from "react";
import { Loader2, Package as PackageIcon, Plus, Pencil, Trash2, SlidersHorizontal, Star, CalendarX, Check, X } from "lucide-react";
import { toast } from "sonner";

import { requireSessionSSP } from "@/lib/requireSessionSSP";
import { useTabQuery } from "@/hooks/useTabQuery";
import { SEO } from "@/components/SEO";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export const getServerSideProps = requireSessionSSP({ roles: ["admin"] });

const SETTINGS_TABS = [
  { v: "packages", l: "Packages", I: PackageIcon },
  { v: "studio", l: "Studio Settings", I: SlidersHorizontal },
  { v: "cancellations", l: "Cancellations", I: CalendarX },
];

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
};

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
  };
}

// ── Packages tab ──────────────────────────────────────────────
function PackagesSection() {
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
    setRows(list.map((p) => ({ ...p, price: Number(p.price), benefits: p.benefits ?? [] })));
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
                        {p.price.toLocaleString("en-IN")}
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

// ── Studio settings tab ───────────────────────────────────────
type StudioForm = {
  cancellation_cutoff_hours: string;
  default_package_validity_days: string;
  cancelled_pass_validity_days: string;
};

function StudioSettingsSection() {
  const [form, setForm] = useState<StudioForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/studio-settings");
    if (!r.ok) {
      toast.error("Could not load studio settings.");
      return;
    }
    const d = await r.json();
    const s = d.settings ?? d;
    setForm({
      cancellation_cutoff_hours: String(s.cancellation_cutoff_hours ?? ""),
      default_package_validity_days: String(s.default_package_validity_days ?? ""),
      cancelled_pass_validity_days: String(s.cancelled_pass_validity_days ?? ""),
    });
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

  const patch = useCallback((key: keyof StudioForm, value: string) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }, []);

  const save = useCallback(async () => {
    if (!form) return;
    const entries = Object.entries(form) as [keyof StudioForm, string][];
    for (const [k, v] of entries) {
      const n = Number(v);
      if (!Number.isInteger(n) || n <= 0) {
        toast.error(`${k.replace(/_/g, " ")} must be a positive integer.`);
        return;
      }
    }
    setSaving(true);
    try {
      const r = await fetch("/api/admin/studio-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cancellation_cutoff_hours: Number(form.cancellation_cutoff_hours),
          default_package_validity_days: Number(form.default_package_validity_days),
          cancelled_pass_validity_days: Number(form.cancelled_pass_validity_days),
        }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        toast.error(e.error ?? "Could not save settings.");
        return;
      }
      toast.success("Studio settings saved.");
      await load();
    } finally {
      setSaving(false);
    }
  }, [form, load]);

  return (
    <Card className="border-sage/20 bg-white-warm">
      <CardHeader>
        <CardTitle className="font-display text-2xl text-charcoal">Studio Settings</CardTitle>
        <CardDescription className="font-body text-charcoal/60">
          Cancellation cutoff and package validity defaults used across booking and grant flows.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading || !form ? (
          <div className="py-12 text-center font-body text-sm text-charcoal/40">Loading settings…</div>
        ) : (
          <div className="grid max-w-xl gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="set-cutoff">Cancellation cutoff (hours)</Label>
              <Input
                id="set-cutoff"
                type="number"
                min="1"
                inputMode="numeric"
                value={form.cancellation_cutoff_hours}
                onChange={(e) => patch("cancellation_cutoff_hours", e.target.value)}
              />
              <p className="font-body text-xs text-charcoal/50">
                Members can self-cancel up to this many hours before a class. Later cancels need admin approval.
              </p>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="set-default-validity">Default package validity (days)</Label>
              <Input
                id="set-default-validity"
                type="number"
                min="1"
                inputMode="numeric"
                value={form.default_package_validity_days}
                onChange={(e) => patch("default_package_validity_days", e.target.value)}
              />
              <p className="font-body text-xs text-charcoal/50">
                Fallback expiry when a granted package has no validity of its own.
              </p>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="set-cancelled-validity">Cancelled-pass validity (days)</Label>
              <Input
                id="set-cancelled-validity"
                type="number"
                min="1"
                inputMode="numeric"
                value={form.cancelled_pass_validity_days}
                onChange={(e) => patch("cancelled_pass_validity_days", e.target.value)}
              />
              <p className="font-body text-xs text-charcoal/50">
                Validity of the 1 Class Pass granted when a class is cancelled.
              </p>
            </div>

            <div>
              <Button type="button" variant="sage" onClick={save} disabled={saving} className="gap-1.5">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Settings
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Cancellation requests tab ─────────────────────────────────
type CancellationRequestRow = {
  id: string;
  status: string;
  reason: string | null;
  created_at: string;
  decided_at: string | null;
  profile: { id: string; full_name: string | null; email: string } | null;
  booking: { id: string; class_name: string | null; class_time: string | null; status: string } | null;
  class_schedule: {
    id: string;
    start_time: string | null;
    class_model: { name: string | null } | null;
  } | null;
};

const REQUEST_STATUS_FILTERS = ["open", "approved", "denied", "all"] as const;

function fmtDateTime(v: string | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function CancellationsSection() {
  const [rows, setRows] = useState<CancellationRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<(typeof REQUEST_STATUS_FILTERS)[number]>("open");
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async (filter: (typeof REQUEST_STATUS_FILTERS)[number]) => {
    const qs = filter === "all" ? "" : `?status=${filter}`;
    const r = await fetch(`/api/admin/class-cancellation-requests${qs}`, {
      headers: { "Cache-Control": "no-store" },
    });
    if (!r.ok) {
      toast.error("Could not load cancellation requests.");
      return;
    }
    const d = await r.json();
    setRows(Array.isArray(d.requests) ? d.requests : []);
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        await load(statusFilter);
      } finally {
        setLoading(false);
      }
    })();
  }, [load, statusFilter]);

  const decide = useCallback(
    async (id: string, action: "approve" | "deny") => {
      if (action === "approve" && !window.confirm("Approve this cancellation? The booking will be cancelled and refund passes granted.")) {
        return;
      }
      setActingId(id);
      try {
        const r = await fetch("/api/admin/class-cancellation-requests", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, action }),
        });
        if (!r.ok) {
          const e = await r.json().catch(() => ({}));
          toast.error(e.error ?? "Could not update request.");
          return;
        }
        toast.success(action === "approve" ? "Cancellation approved." : "Request denied.");
        await load(statusFilter);
      } finally {
        setActingId(null);
      }
    },
    [load, statusFilter],
  );

  return (
    <Card className="border-sage/20 bg-white-warm">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="font-display text-2xl text-charcoal">Late-Cancel Requests</CardTitle>
          <CardDescription className="font-body text-charcoal/60">
            Requests filed after the cancellation cutoff. Approving cancels the booking and grants a 1 Class Pass refund.
          </CardDescription>
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as (typeof REQUEST_STATUS_FILTERS)[number])}>
          <SelectTrigger className="w-[150px] shrink-0 border-sage/20 font-body">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REQUEST_STATUS_FILTERS.map((s) => (
              <SelectItem key={s} value={s} className="font-body capitalize">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-12 text-center font-body text-sm text-charcoal/40">Loading requests…</div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center font-body text-sm text-charcoal/40">
            <CalendarX className="mx-auto mb-3 h-10 w-10 text-charcoal/20" /> No {statusFilter === "all" ? "" : statusFilter} requests.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-sage/15 bg-white-warm">
            <ResponsiveTable>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead className="w-[170px]">Class time</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="w-[120px]">Status</TableHead>
                    <TableHead className="w-[140px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((req) => {
                    const className =
                      req.class_schedule?.class_model?.name ?? req.booking?.class_name ?? "Class";
                    const classTime = req.class_schedule?.start_time ?? req.booking?.class_time ?? null;
                    return (
                      <TableRow key={req.id}>
                        <TableCell className="font-body text-sm text-charcoal">
                          <div className="font-medium">{req.profile?.full_name ?? req.profile?.email ?? "Member"}</div>
                          {req.profile?.email && (
                            <div className="font-body text-xs text-charcoal/50">{req.profile.email}</div>
                          )}
                        </TableCell>
                        <TableCell className="font-body text-sm text-charcoal/70">{className}</TableCell>
                        <TableCell className="font-body text-xs text-charcoal/60">{fmtDateTime(classTime)}</TableCell>
                        <TableCell className="max-w-[220px] font-body text-xs text-charcoal/60">
                          {req.reason?.trim() || "—"}
                        </TableCell>
                        <TableCell>
                          {req.status === "open" ? (
                            <Pill tone="warning" size="sm">Open</Pill>
                          ) : req.status === "approved" ? (
                            <Pill tone="success" size="sm">Approved</Pill>
                          ) : (
                            <Pill tone="danger" size="sm">Denied</Pill>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {req.status === "open" ? (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                type="button"
                                variant="sage"
                                size="sm"
                                disabled={actingId === req.id}
                                onClick={() => decide(req.id, "approve")}
                                className="gap-1"
                              >
                                {actingId === req.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Check className="h-3.5 w-3.5" />
                                )}
                                Approve
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={actingId === req.id}
                                onClick={() => decide(req.id, "deny")}
                                className="gap-1"
                              >
                                <X className="h-3.5 w-3.5" /> Deny
                              </Button>
                            </div>
                          ) : (
                            <span className="font-body text-xs text-charcoal/40">{fmtDateTime(req.decided_at)}</span>
                          )}
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

export default function AdminSettings() {
  const [activeTab, changeTab] = useTabQuery(SETTINGS_TABS.map((t) => t.v), "packages");

  return (
    <>
      <SEO title="Settings - Admin" description="Manage packages and studio settings" />

      <div className="min-h-screen bg-linear-to-br from-cream via-cream to-sage/10">
        <main className="min-h-screen">
          <div className="mx-auto max-w-7xl space-y-8 p-6 lg:p-8">
            <AdminPageHeader title="Settings" subtitle="Package catalog and studio-wide settings" />

            <Tabs value={activeTab} onValueChange={changeTab} className="space-y-6">
              <Select value={activeTab} onValueChange={changeTab}>
                <SelectTrigger className="w-full border-sage/20 font-body md:hidden">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SETTINGS_TABS.map((t) => (
                    <SelectItem key={t.v} value={t.v} className="font-body">
                      {t.l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <TabsList className="hidden h-auto w-auto justify-start gap-1 border border-sage/15 bg-cream/50 p-1 md:flex">
                {SETTINGS_TABS.map((t) => (
                  <TabsTrigger
                    key={t.v}
                    value={t.v}
                    className="gap-2 px-3 font-body text-charcoal/60 data-[state=active]:bg-sage data-[state=active]:text-cream data-[state=active]:shadow-xs"
                  >
                    <t.I className="h-4 w-4" />
                    {t.l}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="packages" className="space-y-6">
                <PackagesSection />
              </TabsContent>

              <TabsContent value="studio" className="space-y-6">
                <StudioSettingsSection />
              </TabsContent>

              <TabsContent value="cancellations" className="space-y-6">
                <CancellationsSection />
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </>
  );
}
