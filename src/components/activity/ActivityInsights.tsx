import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { MetricCard } from "@/components/admin/MetricCard";
import { Activity, Clock, CalendarDays, Zap, UserRound } from "lucide-react";

interface InsightsPayload {
  total: number;
  last24h: number;
  last7d: number;
  byCategory: { category: string; count: number }[];
  topAction: { action: string; count: number } | null;
  topActor: { name: string | null; count: number } | null;
}

// On-brand bar fills (sage / terracotta / deep-clay / charcoal tones only).
const CATEGORY_BAR: Record<string, string> = {
  auth: "bg-sage",
  member: "bg-terracotta",
  admin: "bg-[#a05e38]",
  instructor: "bg-charcoal/55",
  partner: "bg-sage/50",
  system: "bg-charcoal/30",
};

export function ActivityInsights() {
  const [data, setData] = useState<InsightsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/activity-log/insights");
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as InsightsPayload;
        if (!cancelled) setData(json);
      } catch {
        /* leave cards blank on failure */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const n = (v: number | undefined) => (v ?? 0).toLocaleString("en-IN");
  const maxCat = Math.max(1, ...(data?.byCategory.map((c) => c.count) ?? [1]));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Total events" value={data?.total ?? 0} icon={Activity} tone="sage" loading={loading} />
        <MetricCard label="Last 24 hours" value={data?.last24h ?? 0} icon={Clock} tone="terracotta" loading={loading} />
        <MetricCard label="Last 7 days" value={data?.last7d ?? 0} icon={CalendarDays} tone="sage" loading={loading} />
        <MetricCard
          label="Top action"
          value={data?.topAction?.action ?? "—"}
          icon={Zap}
          tone="charcoal"
          hint={data?.topAction ? `${n(data.topAction.count)} times` : undefined}
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="border-sage/20 bg-white-warm lg:col-span-2">
          <CardContent className="p-5">
            <span className="font-body text-xs uppercase tracking-wide text-charcoal/55">By category</span>
            <div className="mt-3 space-y-2">
              {(data?.byCategory ?? []).length === 0 ? (
                <p className="font-body text-sm text-charcoal/40">No data yet</p>
              ) : (
                data?.byCategory.map((c) => (
                  <div key={c.category} className="flex items-center gap-3">
                    <span className="font-body text-xs text-charcoal/70 w-20 shrink-0 capitalize">{c.category}</span>
                    <div className="flex-1 h-2.5 bg-sage/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${CATEGORY_BAR[c.category] ?? "bg-charcoal/30"}`}
                        style={{ width: `${Math.round((c.count / maxCat) * 100)}%` }}
                      />
                    </div>
                    <span className="font-body text-xs text-charcoal/50 w-12 text-right shrink-0">{n(c.count)}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <MetricCard
          label="Most active"
          value={data?.topActor?.name ?? "—"}
          icon={UserRound}
          tone="terracotta"
          hint={data?.topActor ? `${n(data.topActor.count)} actions` : undefined}
          loading={loading}
        />
      </div>
    </div>
  );
}
