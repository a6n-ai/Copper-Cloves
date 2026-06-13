import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pill } from "@/components/ui/pill";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Win = "week" | "month" | "quarter" | "all";

type PayoutInstructor = {
  instructorId: string;
  payableUnits: number;
  classes: number;
  checkIns: number;
  studioCutPercent: number;
  percentage: number;
  rateCard: { rate12: number; rate8: number; rate4: number; rate1: number };
  netBreakdown: { net12: number; net8: number; net4: number; net1: number };
  autoBlendedRatePaise: number;
  overrideBlendedRatePaise: number | null;
  blendedRatePaise: number;
  total: number;
  overrideTotal: number | null;
  paidAt: string | null;
  status: "paid" | "pending";
};

const r = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export function InstructorPayoutTab({ instructorId }: { instructorId: string }) {
  const [win, setWin] = useState<Win>("month");
  const [data, setData] = useState<PayoutInstructor | null>(null);
  const [loading, setLoading] = useState(false);
  const [blendedInput, setBlendedInput] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/instructor-payouts?window=${win}&instructorId=${encodeURIComponent(instructorId)}`,
      );
      const d = await res.json();
      const ins = (d.instructors ?? [])[0] ?? null;
      setData(ins);
      setBlendedInput(
        ins?.overrideBlendedRatePaise != null ? (ins.overrideBlendedRatePaise / 100).toString() : "",
      );
    } catch {
      toast.error("Failed to load payout");
    } finally {
      setLoading(false);
    }
  }, [win, instructorId]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveBlended() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { instructorId, window: win };
      body.override_blended_rate_paise = blendedInput.trim() === "" ? null : Math.round(Number(blendedInput) * 100);
      const res = await fetch("/api/admin/instructor-payout-adjustment", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Save failed");
      toast.success("Blended rate updated");
      load();
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function markPaid(paid: boolean) {
    if (!data) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/instructor-payout-adjustment", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instructorId,
          window: win,
          paid,
          blended_rate_paise: data.blendedRatePaise,
          payout_paise: Math.round((data.overrideTotal ?? data.total) * 100),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      toast.success(paid ? "Marked paid" : "Marked unpaid");
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Select value={win} onValueChange={(v) => setWin(v as Win)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="week">This week</SelectItem>
            <SelectItem value="month">This month</SelectItem>
            <SelectItem value="quarter">This quarter</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
        {data?.status === "paid" ? <Pill tone="success">Paid</Pill> : <Pill tone="warning">Pending</Pill>}
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!loading && !data && (
        <p className="text-sm text-muted-foreground">No classes in this period.</p>
      )}

      {!loading && data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Metric label="Classes" value={String(data.classes)} />
            <Metric label="Payable units" value={String(data.payableUnits)} />
            <Metric label="Check-ins" value={String(data.checkIns)} />
            <Metric label="Instructor share" value={`${data.percentage}%`} />
          </div>

          <div className="rounded-lg border border-[#e5e4dc] p-4 space-y-2">
            <p className="text-sm font-medium">Rate card (per-class net @ {data.percentage}%, GST-excl)</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              <RateCell label="12-class" gross={data.rateCard.rate12} net={data.netBreakdown.net12} />
              <RateCell label="8-class" gross={data.rateCard.rate8} net={data.netBreakdown.net8} />
              <RateCell label="4-class" gross={data.rateCard.rate4} net={data.netBreakdown.net4} />
              <RateCell label="1-class" gross={data.rateCard.rate1} net={data.netBreakdown.net1} />
            </div>
            <p className="text-xs text-muted-foreground">
              Auto blended (avg): {r(data.autoBlendedRatePaise)} / class
            </p>
          </div>

          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Blended rate ₹/class (blank = auto {r(data.autoBlendedRatePaise)})</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={blendedInput}
                placeholder={(data.autoBlendedRatePaise / 100).toString()}
                onChange={(e) => setBlendedInput(e.target.value)}
                disabled={data.status === "paid"}
              />
            </div>
            <Button onClick={saveBlended} disabled={saving || data.status === "paid"}>Save rate</Button>
          </div>

          <div className="rounded-lg border border-[#e5e4dc] p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">
                {data.payableUnits} units × {r(data.blendedRatePaise)}
              </p>
              <p className="text-2xl font-semibold">₹{(data.overrideTotal ?? data.total).toLocaleString("en-IN")}</p>
            </div>
            {data.status === "paid" ? (
              <Button variant="secondary" onClick={() => markPaid(false)} disabled={saving}>Mark unpaid</Button>
            ) : (
              <Button onClick={() => markPaid(true)} disabled={saving}>Mark paid</Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#e5e4dc] p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

function RateCell({ label, gross, net }: { label: string; gross: number; net: number }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label} ({r(gross)})</p>
      <p className="font-medium">{r(net)}/cls</p>
    </div>
  );
}
