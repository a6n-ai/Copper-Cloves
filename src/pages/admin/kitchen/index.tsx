import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { SEO as Seo } from "@/components/SEO";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Pill } from "@/components/ui/pill";
import { MetricCard } from "@/components/admin/MetricCard";
import { ClipboardList, Clock, CheckCircle2, ChefHat, X } from "lucide-react";

interface CafeOrderRow {
  id: string;
  status: string;
  order_date: string;
  quantity: number;
  cafe_item: { name: string; price: number } | null;
  profile: { full_name: string | null; email: string } | null;
}

const NEXT_STATUS: Record<string, { next: string; label: string }> = {
  pending: { next: "preparing", label: "Start preparing" },
  preparing: { next: "ready", label: "Mark ready" },
  ready: { next: "completed", label: "Complete" },
};

const STATUS_TONES: Record<string, "warning" | "neutral" | "success"> = {
  pending: "warning",
  preparing: "neutral",
  ready: "success",
};

function minsAgo(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m ago` : `${h}h ago`;
}

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export default function KitchenDashboard() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [orders, setOrders] = useState<CafeOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/cafe/orders");
      if (res.ok) setOrders(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    const role = (session?.user as { role?: string })?.role;
    if (status === "authenticated" && role !== "admin" && role !== "chef") {
      router.push("/login");
      return;
    }
    if (status === "authenticated") {
      void load();
      // Pause polling when tab hidden — avoids hammering the API on idle screens.
      const id = setInterval(() => {
        if (typeof document !== "undefined" && document.hidden) return;
        void load();
      }, 20000);
      const onVis = () => { if (!document.hidden) void load(); };
      document.addEventListener("visibilitychange", onVis);
      return () => {
        clearInterval(id);
        document.removeEventListener("visibilitychange", onVis);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function updateStatus(id: string, next: string) {
    setUpdating(id);
    try {
      const res = await fetch("/api/cafe/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: next }),
      });
      if (res.ok) await load();
    } finally {
      setUpdating(null);
    }
  }

  // Single pass over `orders`: build active list (sorted asc by date), count pending,
  // count completed-today. Was three separate filters/scans per render.
  const { active, pendingCount, completedToday } = useMemo(() => {
    const activeRows: Array<typeof orders[number] & { _ms: number }> = [];
    let pending = 0;
    let completed = 0;
    for (const o of orders) {
      if (o.status === "completed" && isToday(o.order_date)) completed += 1;
      if (!(o.status === "completed" || o.status === "cancelled")) {
        if (o.status === "pending") pending += 1;
        activeRows.push({ ...o, _ms: new Date(o.order_date).getTime() });
      }
    }
    activeRows.sort((a, b) => a._ms - b._ms);
    return {
      active: activeRows.map(({ _ms: _ms_omit, ...rest }) => rest as typeof orders[number]),
      pendingCount: pending,
      completedToday: completed,
    };
  }, [orders]);

  let orderQueue: React.ReactNode;
  if (loading) {
    orderQueue = (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {["k1", "k2", "k3", "k4", "k5", "k6"].map((sk) => (
          <Skeleton key={sk} className="h-36 rounded-2xl" />
        ))}
      </div>
    );
  } else if (active.length === 0) {
    orderQueue = (
      <Card className="rounded-2xl border-sage/15">
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <CheckCircle2 className="h-10 w-10 text-sage/50" />
          <p className="font-body font-semibold text-lg text-charcoal">All caught up</p>
          <p className="font-body text-sm text-charcoal/55">No open orders right now.</p>
        </CardContent>
      </Card>
    );
  } else {
    orderQueue = (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {active.map((o) => {
          const step = NEXT_STATUS[o.status];
          return (
            <Card key={o.id} className="rounded-2xl border-sage/15 hover:shadow-[0_4px_24px_rgba(51,51,51,0.08)] transition-shadow">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-body font-semibold text-lg text-charcoal truncate">
                      {o.cafe_item?.name ?? "Item"}{" "}
                      {o.quantity > 1 ? <span className="text-charcoal/50">×{o.quantity}</span> : null}
                    </p>
                    <p className="font-body text-sm text-charcoal/55 truncate">
                      {o.profile?.full_name ?? o.profile?.email ?? "Member"}
                    </p>
                  </div>
                  <Pill
                    tone={STATUS_TONES[o.status] ?? "neutral"}

                    size="sm"
                    className="shrink-0 font-body font-medium capitalize"
                  >
                    {o.status}
                  </Pill>
                </div>
                <p className="font-body text-xs text-charcoal/45">{minsAgo(o.order_date)}</p>
                <div className="flex gap-2 pt-1">
                  {step ? (
                    <Button
                      size="sm"
                      disabled={updating === o.id}
                      onClick={() => updateStatus(o.id, step.next)}
                      variant="sage"
                      className="flex-1"
                    >
                      {step.label}
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={updating === o.id}
                    onClick={() => updateStatus(o.id, "cancelled")}
                    className="border-terracotta/30 text-terracotta hover:bg-terracotta/5 font-body hover:text-terracotta!"
                    aria-label="Cancel order"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <>
      <Seo title="Live Orders - Kitchen" description="Live café order queue" />
      <div className="min-h-screen bg-linear-to-br from-cream via-cream to-sage/10">
        <main className="min-h-screen">
          <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-8">
            <PageHeader
              title="Live Orders"
              subtitle="Café order queue — updates every 20s"
              actions={
                <Button
                  variant="outline"
                  onClick={() => router.push("/admin/cafe")}
                  className="border-sage/30 text-sage hover:bg-sage/5 font-body hover:text-sage!"
                >
                  <ChefHat className="h-4 w-4 mr-2" />
                  Manage Café
                </Button>
              }
            />

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <MetricCard label="Active orders" value={String(active.length)} icon={ClipboardList} />
              <MetricCard label="Pending" value={String(pendingCount)} icon={Clock} />
              <MetricCard label="Completed today" value={String(completedToday)} icon={CheckCircle2} />
            </div>

            {orderQueue}
          </div>
        </main>
      </div>
    </>
  );
}
