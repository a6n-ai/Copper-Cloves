import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import EmailHealthCheck from "@/components/admin/EmailHealthCheck";

type StudioForm = {
  cancellation_cutoff_hours: string;
  default_package_validity_days: string;
  cancelled_pass_validity_days: string;
  business_name: string;
  business_address: string;
  business_gstin: string;
  business_email: string;
  business_phone: string;
  business_logo_url: string;
  invoice_prefix: string;
  invoice_footer_note: string;
};

const INT_KEYS = [
  "cancellation_cutoff_hours",
  "default_package_validity_days",
  "cancelled_pass_validity_days",
] as const;

export default function StudioSettingsTab() {
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
      business_name: String(s.business_name ?? ""),
      business_address: String(s.business_address ?? ""),
      business_gstin: String(s.business_gstin ?? ""),
      business_email: String(s.business_email ?? ""),
      business_phone: String(s.business_phone ?? ""),
      business_logo_url: String(s.business_logo_url ?? ""),
      invoice_prefix: String(s.invoice_prefix ?? ""),
      invoice_footer_note: String(s.invoice_footer_note ?? ""),
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
    for (const k of INT_KEYS) {
      const n = Number(form[k]);
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
          business_name: form.business_name,
          business_address: form.business_address,
          business_gstin: form.business_gstin,
          business_email: form.business_email,
          business_phone: form.business_phone,
          business_logo_url: form.business_logo_url,
          invoice_prefix: form.invoice_prefix,
          invoice_footer_note: form.invoice_footer_note,
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
    <div className="space-y-6">
    <Card className="border-sage/20 bg-white-warm">
      <CardHeader>
        <CardTitle className="font-body font-semibold text-2xl text-charcoal">Studio Settings</CardTitle>
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

    <Card className="border-sage/20 bg-white-warm">
      <CardHeader>
        <CardTitle className="font-body font-semibold text-2xl text-charcoal">Business / Invoice details</CardTitle>
        <CardDescription className="font-body text-charcoal/60">
          Shown on generated booking invoices. Leave a field blank to omit it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading || !form ? (
          <div className="py-12 text-center font-body text-sm text-charcoal/40">Loading settings…</div>
        ) : (
          <div className="grid max-w-xl gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="set-business-name">Business name</Label>
              <Input
                id="set-business-name"
                value={form.business_name}
                onChange={(e) => patch("business_name", e.target.value)}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="set-business-address">Business address</Label>
              <textarea
                id="set-business-address"
                className="min-h-20 rounded-lg border border-warm-border bg-white-warm px-3 py-2 font-body text-sm text-charcoal focus:border-sage focus:outline-none focus:ring-2 focus:ring-sage/30"
                value={form.business_address}
                onChange={(e) => patch("business_address", e.target.value)}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="set-business-gstin">GSTIN</Label>
              <Input
                id="set-business-gstin"
                value={form.business_gstin}
                onChange={(e) => patch("business_gstin", e.target.value)}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="set-business-email">Business email</Label>
              <Input
                id="set-business-email"
                type="email"
                value={form.business_email}
                onChange={(e) => patch("business_email", e.target.value)}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="set-business-phone">Business phone</Label>
              <Input
                id="set-business-phone"
                value={form.business_phone}
                onChange={(e) => patch("business_phone", e.target.value)}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="set-business-logo-url">Logo URL</Label>
              <Input
                id="set-business-logo-url"
                value={form.business_logo_url}
                onChange={(e) => patch("business_logo_url", e.target.value)}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="set-invoice-prefix">Invoice prefix</Label>
              <Input
                id="set-invoice-prefix"
                value={form.invoice_prefix}
                onChange={(e) => patch("invoice_prefix", e.target.value)}
              />
              <p className="font-body text-xs text-charcoal/50">Example: INV → INV-000123.</p>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="set-invoice-footer-note">Invoice footer note</Label>
              <textarea
                id="set-invoice-footer-note"
                className="min-h-20 rounded-lg border border-warm-border bg-white-warm px-3 py-2 font-body text-sm text-charcoal focus:border-sage focus:outline-none focus:ring-2 focus:ring-sage/30"
                value={form.invoice_footer_note}
                onChange={(e) => patch("invoice_footer_note", e.target.value)}
              />
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

    <EmailHealthCheck />
    </div>
  );
}
