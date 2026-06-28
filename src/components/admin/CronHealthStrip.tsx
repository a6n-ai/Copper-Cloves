import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pill, type PillProps } from "@/components/ui/pill";

type CronRun = {
  id: string;
  job: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  result: Record<string, number> | null;
  error: string | null;
};

type CronStatus = {
  jobs: Array<{ job: string; lastRun: CronRun | null; lastOk: CronRun | null }>;
};

function ago(iso: string | null | undefined): string {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

// A green GitHub Actions tick only proves the endpoint returned 200 — this strip shows
// what each cron actually DID (its result counts) and when it last succeeded.
export function CronHealthStrip() {
  const [data, setData] = useState<CronStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/cron-status");
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runReconcile = useCallback(async () => {
    setRunning(true);
    try {
      const res = await fetch("/api/cron/reconcile-razorpay", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(
          `Reconcile ran: fulfilled ${body.fulfilled ?? 0}, healed ${body.healedPaid ?? 0}, flagged ${body.flaggedOrphans ?? 0}`,
        );
        await load();
      } else {
        toast.error(body.error ?? "Reconcile failed");
      }
    } catch {
      toast.error("Reconcile failed");
    } finally {
      setRunning(false);
    }
  }, [load]);

  return (
    <Card className="border-sage/15">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <CardTitle className="font-title text-base">Job health</CardTitle>
        <Button size="sm" variant="outline" onClick={runReconcile} disabled={running}>
          {running ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Run reconcile now
        </Button>
      </CardHeader>
      <CardContent>
        {loading && !data ? (
          <p className="font-body text-sm text-charcoal/50">Loading…</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {data?.jobs.map(({ job, lastRun, lastOk }) => {
              const tone: PillProps["tone"] =
                lastRun?.status === "failed" ? "danger" : lastRun?.status === "ok" ? "success" : "neutral";
              const counts = lastOk?.result
                ? Object.entries(lastOk.result)
                    .filter(([, v]) => typeof v === "number" && v > 0)
                    .map(([k, v]) => `${k}=${v}`)
                    .join(" ")
                : null;
              return (
                <div key={job} className="flex flex-col gap-1 rounded-md border border-sage/10 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-body text-sm text-charcoal">{job}</span>
                    <Pill tone={tone}>{lastRun?.status ?? "no runs"}</Pill>
                  </div>
                  <span className="font-body text-xs text-charcoal/50">
                    ran {ago(lastRun?.started_at)} · ok {ago(lastOk?.started_at)}
                  </span>
                  {counts && <span className="font-body text-xs text-sage">{counts}</span>}
                  {lastRun?.status === "failed" && lastRun.error && (
                    <span className="font-body text-xs text-terracotta">{lastRun.error}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
