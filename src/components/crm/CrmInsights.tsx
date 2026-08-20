import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { MetricCard } from "@/components/admin/MetricCard";
import { Send, CalendarDays, CheckCircle2, Zap } from "lucide-react";

export interface CrmInsightsPayload {
  total: number;
  last7d: number;
  deliveryRate: number;
  activeTriggers: number;
  byChannel: { channel: string; count: number }[];
  byStatus: { status: string; count: number }[];
  byTemplate: { template: string; count: number }[];
  overTime: { week: string; count: number }[];
}

// On-brand bar fills — sage / terracotta / deep-clay / charcoal tones only.
const CHANNEL_BAR: Record<string, string> = {
  email: "bg-terracotta",
  whatsapp: "bg-sage",
};
const STATUS_BAR: Record<string, string> = {
  sent: "bg-sage",
  failed: "bg-pill-danger-fg",
  scheduled: "bg-terracotta",
  pending: "bg-charcoal/40",
};

function BarRow({
  label,
  count,
  max,
  fill,
  n,
}: {
  label: string;
  count: number;
  max: number;
  fill: string;
  n: (v: number) => string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-body text-xs text-charcoal/70 w-24 shrink-0 capitalize truncate">{label}</span>
      <div className="flex-1 h-2.5 bg-sage/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${fill}`} style={{ width: `${Math.round((count / max) * 100)}%` }} />
      </div>
      <span className="font-body text-xs text-charcoal/50 w-12 text-right shrink-0">{n(count)}</span>
    </div>
  );
}

function BarCard({
  title,
  rows,
  fillFor,
  n,
}: {
  title: string;
  rows: { label: string; count: number }[];
  fillFor: (label: string) => string;
  n: (v: number) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <Card className="border-sage/20 bg-white-warm">
      <CardContent className="p-5">
        <span className="font-body text-xs uppercase tracking-wide text-charcoal/55">{title}</span>
        <div className="mt-3 space-y-2">
          {rows.length === 0 ? (
            <p className="font-body text-sm text-charcoal/40">No data yet</p>
          ) : (
            rows.map((r) => (
              <BarRow key={r.label} label={r.label} count={r.count} max={max} fill={fillFor(r.label)} n={n} />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function CrmInsights({ refreshKey = 0 }: { refreshKey?: number }) {
  const [data, setData] = useState<CrmInsightsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/crm/insights");
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as CrmInsightsPayload;
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
  }, [refreshKey]);

  const n = (v: number | undefined) => (v ?? 0).toLocaleString("en-IN");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Messages sent" value={data?.total ?? 0} icon={Send} tone="sage" loading={loading} description="Total CRM messages (email + WhatsApp) sent to date" />
        <MetricCard label="Last 7 days" value={data?.last7d ?? 0} icon={CalendarDays} tone="terracotta" loading={loading} description="CRM messages sent in the last 7 days" />
        <MetricCard
          label="Delivery rate"
          value={data?.deliveryRate ?? 0}
          suffix="%"
          icon={CheckCircle2}
          tone="charcoal"
          loading={loading}
          description="Share of sent CRM messages that were successfully delivered"
        />
        <MetricCard label="Active triggers" value={data?.activeTriggers ?? 0} icon={Zap} tone="sage" loading={loading} description="Number of CRM automation triggers currently enabled" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BarCard
          title="By channel"
          rows={(data?.byChannel ?? []).map((c) => ({ label: c.channel, count: c.count }))}
          fillFor={(l) => CHANNEL_BAR[l] ?? "bg-charcoal/30"}
          n={n}
        />
        <BarCard
          title="By status"
          rows={(data?.byStatus ?? []).map((s) => ({ label: s.status, count: s.count }))}
          fillFor={(l) => STATUS_BAR[l] ?? "bg-charcoal/30"}
          n={n}
        />
      </div>
    </div>
  );
}

// Analytics tab: deeper breakdowns (per-template volume + weekly trend) on real
// data. No conversions/revenue — those can't be tied to a message reliably.
export function CrmAnalytics({ refreshKey = 0 }: { refreshKey?: number }) {
  const [data, setData] = useState<CrmInsightsPayload | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/crm/insights");
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as CrmInsightsPayload;
        if (!cancelled) setData(json);
      } catch {
        /* leave blank on failure */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const n = (v: number) => v.toLocaleString("en-IN");
  const maxWeek = Math.max(1, ...(data?.overTime ?? []).map((w) => w.count));

  if (loaded && (data?.total ?? 0) === 0) {
    return <p className="font-body text-sm text-charcoal/50 py-10 text-center">No message data yet.</p>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <BarCard
        title="Sent by template"
        rows={(data?.byTemplate ?? []).map((t) => ({ label: t.template, count: t.count }))}
        fillFor={() => "bg-sage"}
        n={n}
      />
      <Card className="border-sage/20 bg-white-warm">
        <CardContent className="p-5">
          <span className="font-body text-xs uppercase tracking-wide text-charcoal/55">Sent over time (weekly)</span>
          <div className="mt-3 space-y-2">
            {(data?.overTime ?? []).length === 0 ? (
              <p className="font-body text-sm text-charcoal/40">No data yet</p>
            ) : (
              data?.overTime.map((w) => (
                <div key={w.week} className="flex items-center gap-3">
                  <span className="font-body text-xs text-charcoal/70 w-20 shrink-0">{w.week}</span>
                  <div className="flex-1 h-2.5 bg-sage/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-terracotta"
                      style={{ width: `${Math.round((w.count / maxWeek) * 100)}%` }}
                    />
                  </div>
                  <span className="font-body text-xs text-charcoal/50 w-12 text-right shrink-0">{n(w.count)}</span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
