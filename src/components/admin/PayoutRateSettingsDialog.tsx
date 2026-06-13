import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/responsive/ResponsiveDialog";

type Settings = {
  rate_12_paise: number;
  rate_8_paise: number;
  rate_4_paise: number;
  rate_1_paise: number;
  gst_percent: number;
  default_studio_cut_percent: number;
};

const toR = (p: number | string) => (Number(p) / 100).toString();
const toP = (r: string) => Math.round(Number(r) * 100);

export function PayoutRateSettingsDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
}) {
  const [s, setS] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ r12: "", r8: "", r4: "", r1: "", gst: "", cut: "" });

  useEffect(() => {
    if (!open) return;
    fetch("/api/admin/payout-settings")
      .then((r) => r.json())
      .then((d) => {
        const x = d.settings as Settings;
        setS(x);
        setForm({
          r12: toR(x.rate_12_paise),
          r8: toR(x.rate_8_paise),
          r4: toR(x.rate_4_paise),
          r1: toR(x.rate_1_paise),
          gst: String(Number(x.gst_percent)),
          cut: String(Number(x.default_studio_cut_percent)),
        });
      })
      .catch(() => toast.error("Failed to load payout settings"));
  }, [open]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/payout-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rate_12_paise: toP(form.r12),
          rate_8_paise: toP(form.r8),
          rate_4_paise: toP(form.r4),
          rate_1_paise: toP(form.r1),
          gst_percent: Number(form.gst),
          default_studio_cut_percent: Number(form.cut),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Save failed");
      toast.success("Payout rates updated");
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Payout Rate Settings</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Studio-wide package rates (₹). Per-class payout = rate ÷ classes ÷ (1+GST) × instructor
            share (100 − cut). Individual instructors can override these.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <div className="grid grid-cols-2 gap-4 py-2">
          <Field label="12-class package (₹)" value={form.r12} onChange={(v) => setForm({ ...form, r12: v })} />
          <Field label="8-class package (₹)" value={form.r8} onChange={(v) => setForm({ ...form, r8: v })} />
          <Field label="4-class package (₹)" value={form.r4} onChange={(v) => setForm({ ...form, r4: v })} />
          <Field label="1-class package (₹)" value={form.r1} onChange={(v) => setForm({ ...form, r1: v })} />
          <Field label="GST %" value={form.gst} onChange={(v) => setForm({ ...form, gst: v })} />
          <Field label="Default studio cut %" value={form.cut} onChange={(v) => setForm({ ...form, cut: v })} />
        </div>
        <ResponsiveDialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !s}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
