import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  netRateBreakdown,
  autoBlendedRate,
  payableForSchedule,
  payoutForUnits,
  instructorPctFrom,
  PAYABLE_BASES,
  type PayableBasis,
  type RateCard,
  type BookingRow,
} from "@/lib/payoutCalc";

const r = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const toR = (p: number) => (p / 100).toString();
const toP = (s: string) => Math.round(Number(s) * 100);

const BASIS_LABEL: Record<PayableBasis, string> = {
  all_booked: "All booked (minus timely cancels)",
  checked_in: "Checked-in only (actual attendance)",
  per_class: "Per class taught (flat)",
};

const SAMPLE = [
  {
    name: "WARRIOR Strength", date: "02 Jun", time: "18:30",
    bookings: [
      { member: "Alina (Unlimited)", status: "confirmed", checked_in: true, cancellation_date: null, check_in_outcome: "on_time" },
      { member: "Samyukta", status: "confirmed", checked_in: true, cancellation_date: null, check_in_outcome: "on_time" },
      { member: "Parneet (no-show)", status: "confirmed", checked_in: false, cancellation_date: null, check_in_outcome: "no_show" },
      { member: "Tena (cancelled early)", status: "cancelled", checked_in: false, cancellation_date: new Date("2026-06-01T00:00:00Z"), check_in_outcome: null },
    ],
    outcome: "on_time",
    start: new Date("2026-06-02T13:00:00Z"),
  },
  {
    name: "WARRIOR Rhythm", date: "09 Jun", time: "10:00",
    bookings: [
      { member: "Arushi", status: "confirmed", checked_in: true, cancellation_date: null, check_in_outcome: "on_time" },
      { member: "Deepti (late)", status: "confirmed", checked_in: true, cancellation_date: null, check_in_outcome: "late" },
    ],
    outcome: "on_time",
    start: new Date("2026-06-09T04:30:00Z"),
  },
  {
    name: "WARRIOR Strength", date: "16 Jun", time: "18:30",
    bookings: [] as { member: string; status: string; checked_in: boolean; cancellation_date: Date | null; check_in_outcome: string | null }[],
    outcome: "on_time",
    start: new Date("2026-06-16T13:00:00Z"),
  },
];

type SettingsForm = { r12: string; r8: string; r4: string; r1: string; gst: string; cut: string; basis: PayableBasis };

export function PayoutRateSettingsPanel() {
  const [form, setForm] = useState<SettingsForm | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/payout-settings")
      .then((res) => res.json())
      .then((d) => {
        const s = d.settings;
        setForm({
          r12: toR(s.rate_12_paise), r8: toR(s.rate_8_paise), r4: toR(s.rate_4_paise), r1: toR(s.rate_1_paise),
          gst: String(Number(s.gst_percent)), cut: String(Number(s.default_studio_cut_percent)),
          basis: (s.payable_basis ?? "all_booked") as PayableBasis,
        });
      })
      .catch(() => toast.error("Failed to load payout settings"));
  }, []);

  const preview = useMemo(() => {
    if (!form) return null;
    const card: RateCard = { rate12: toP(form.r12), rate8: toP(form.r8), rate4: toP(form.r4), rate1: toP(form.r1) };
    const gst = Number(form.gst);
    const pct = instructorPctFrom(Number(form.cut));
    const breakdown = netRateBreakdown(card, gst, pct);
    const blended = autoBlendedRate(card, gst, pct);
    const classes = SAMPLE.map((c) => {
      const units = payableForSchedule(c.bookings as BookingRow[], c.start, c.outcome, form.basis);
      return { name: c.name, date: c.date, time: c.time, units, linePaise: payoutForUnits(units, blended) };
    });
    const totalUnits = classes.reduce((s, c) => s + c.units, 0);
    return { card, gst, pct, breakdown, blended, classes, totalUnits, totalPaise: payoutForUnits(totalUnits, blended) };
  }, [form]);

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/payout-settings", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rate_12_paise: toP(form.r12), rate_8_paise: toP(form.r8), rate_4_paise: toP(form.r4), rate_1_paise: toP(form.r1),
          gst_percent: Number(form.gst), default_studio_cut_percent: Number(form.cut), payable_basis: form.basis,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Save failed");
      toast.success("Payout settings saved");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!form || !preview) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const set = (k: keyof SettingsForm, v: string) => setForm({ ...form, [k]: v } as SettingsForm);

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="font-display text-lg">Payout Rate Settings</CardTitle>
          <CardDescription>Studio-wide rate card, GST, default studio cut, and how attendance is counted.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Field label="12-class package (₹)" value={form.r12} onChange={(v) => set("r12", v)} />
          <Field label="8-class package (₹)" value={form.r8} onChange={(v) => set("r8", v)} />
          <Field label="4-class package (₹)" value={form.r4} onChange={(v) => set("r4", v)} />
          <Field label="1-class package (₹)" value={form.r1} onChange={(v) => set("r1", v)} />
          <Field label="GST %" value={form.gst} onChange={(v) => set("gst", v)} />
          <Field label="Default studio cut %" value={form.cut} onChange={(v) => set("cut", v)} />
          <div className="space-y-1 col-span-2 sm:col-span-3">
            <Label className="text-xs">Payout basis</Label>
            <Select value={form.basis} onValueChange={(v) => set("basis", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYABLE_BASES.map((b) => (
                  <SelectItem key={b} value={b}>{BASIS_LABEL[b]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 sm:col-span-3">
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save settings"}</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="font-display text-lg">How payout is calculated</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-charcoal/80">
          <p><b>Formula:</b> payout = payable units × blended rate. Blended = average over the four tiers of:
            <code className="mx-1">package rate ÷ classes ÷ (1 + GST) × instructor share</code>, where instructor share = 100 − studio cut.</p>
          <p><b>Eligible classes:</b> only classes with status <b>Started</b> or <b>Completed</b> count. Cancelled, abandoned, inactive and not-yet-started classes are excluded.</p>
          <p><b>Payout basis ({BASIS_LABEL[form.basis]}):</b></p>
          <ul className="list-disc pl-5 space-y-1">
            <li><b>All booked</b> — every booking except timely cancels (≥6h before). No-shows & late cancels are paid; if nobody booked but the instructor checked in on time, 1 unit.</li>
            <li><b>Checked-in only</b> — only members who actually attended (checked in on time or late).</li>
            <li><b>Per class taught</b> — 1 unit per class regardless of headcount.</li>
          </ul>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="font-display text-lg">Worked example (live)</CardTitle>
          <CardDescription>Sample data, recalculated with the settings above. Basis: <b>{BASIS_LABEL[form.basis]}</b>.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ResponsiveTable>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Classes</TableHead><TableHead>Pkg rate</TableHead><TableHead>Per-class</TableHead>
                  <TableHead>Ex-GST</TableHead><TableHead>Net @ {preview.pct}%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <RateRow n={12} pkgPaise={preview.card.rate12} netPaise={preview.breakdown.net12} gst={preview.gst} />
                <RateRow n={8} pkgPaise={preview.card.rate8} netPaise={preview.breakdown.net8} gst={preview.gst} />
                <RateRow n={4} pkgPaise={preview.card.rate4} netPaise={preview.breakdown.net4} gst={preview.gst} />
                <RateRow n={1} pkgPaise={preview.card.rate1} netPaise={preview.breakdown.net1} gst={preview.gst} />
              </TableBody>
            </Table>
          </ResponsiveTable>
          <p className="text-sm">Blended rate = <b>{r(preview.blended)}</b>/class (average of the four net rates).</p>

          <ResponsiveTable>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead><TableHead>Date</TableHead><TableHead>Time</TableHead>
                  <TableHead className="text-right">Units</TableHead><TableHead className="text-right">Line ₹</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.classes.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell>{c.name}</TableCell><TableCell>{c.date}</TableCell><TableCell>{c.time}</TableCell>
                    <TableCell className="text-right">{c.units}</TableCell>
                    <TableCell className="text-right">{r(c.linePaise)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold">
                  <TableCell colSpan={3} className="text-right">Total</TableCell>
                  <TableCell className="text-right">{preview.totalUnits}</TableCell>
                  <TableCell className="text-right">{r(preview.totalPaise)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </ResponsiveTable>
          <p className="text-xs text-muted-foreground">
            Sample classes: Strength (2 attended, 1 no-show, 1 early cancel), Rhythm (2 attended), Strength (empty, instructor on time).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function RateRow({ n, pkgPaise, netPaise, gst }: { n: number; pkgPaise: number; netPaise: number; gst: number }) {
  const perClass = pkgPaise / n / 100;
  const exGst = perClass / (1 + gst / 100);
  return (
    <TableRow>
      <TableCell>{n}-class</TableCell>
      <TableCell>₹{(pkgPaise / 100).toLocaleString("en-IN")}</TableCell>
      <TableCell>₹{perClass.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</TableCell>
      <TableCell>₹{exGst.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</TableCell>
      <TableCell>₹{(netPaise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</TableCell>
    </TableRow>
  );
}
