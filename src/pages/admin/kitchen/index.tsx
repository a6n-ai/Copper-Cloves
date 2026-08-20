import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useSession } from "@/lib/auth/client";
import { SEO as Seo } from "@/components/SEO";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Pill } from "@/components/ui/pill";
import { MetricCard } from "@/components/admin/MetricCard";
import { ClipboardList, Clock, CheckCircle2, ChefHat, X } from "lucide-react";
import { hasRole } from "@/lib/auth/roles";

interface CafeOrderRow {
  id: string;
  status: string;
  order_date: string;
  quantity: number;
  cafe_item: { name: string; price: number | string } | null;
  profile: { full_name: string | null; email: string } | null;
  member_pass_name: string | null;
  member_cafe_discount_percent: number;
  /** Pass + coupon discount actually charged on this line (Prisma Decimal → string). */
  discount_inr: number | string;
  booking: {
    class_schedule: {
      start_time: string;
      class_model: { name: string } | null;
    } | null;
  } | null;
}

/** Absolute order date + time, e.g. "18 Jul, 11:52 AM". */
function orderDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
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

/** Relative countdown/elapsed to a class start time, e.g. "in 25m" / "started 5m ago". */
function relativeToNow(iso: string) {
  const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (mins > 0) {
    if (mins < 60) return `in ${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `in ${h}h ${m}m` : `in ${h}h`;
  }
  const ago = Math.abs(mins);
  if (ago < 1) return "starting now";
  if (ago < 60) return `started ${ago}m ago`;
  const h = Math.floor(ago / 60);
  const m = ago % 60;
  return `started ${m ? `${h}h ${m}m` : `${h}h`} ago`;
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

const URGENT_MINS = 15;

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
  const { data: session, isPending } = useSession();
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
    if (isPending) return;
    if (!session?.user) {
      router.push("/login");
      return;
    }
    const role = (session?.user as { role?: string })?.role;
    if (!hasRole(role, "admin") && !hasRole(role, "chef")) {
      router.push("/login");
      return;
    }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, session]);

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

  // Single pass over `orders`: build active list (sorted by when the food is needed —
  // the class start time, not order time), count pending, count completed-today.
  const { active, pendingCount, completedToday } = useMemo(() => {
    const activeRows: Array<typeof orders[number] & { _ms: number }> = [];
    let pending = 0;
    let completed = 0;
    for (const o of orders) {
      if (o.status === "completed" && isToday(o.order_date)) completed += 1;
      if (!(o.status === "completed" || o.status === "cancelled")) {
        if (o.status === "pending") pending += 1;
        const startTime = o.booking?.class_schedule?.start_time;
        // No class → no deadline; push to the end of the queue (Infinity sorts last).
        activeRows.push({ ...o, _ms: startTime ? new Date(startTime).getTime() : Infinity });
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
          const startTime = o.booking?.class_schedule?.start_time;
          const className = o.booking?.class_schedule?.class_model?.name;
          const minsToClass = startTime ? Math.round((new Date(startTime).getTime() - Date.now()) / 60000) : null;
          const isUrgent = minsToClass !== null && minsToClass <= URGENT_MINS;
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
                <div className="flex items-center justify-between gap-2">
                  <p className="font-body text-xs text-charcoal/45">
                    Ordered {orderDateTime(o.order_date)} · {minsAgo(o.order_date)}
                  </p>
                  {o.member_cafe_discount_percent > 0 ? (
                    <Pill tone="success" size="sm" className="shrink-0 font-body font-medium">
                      {o.member_cafe_discount_percent}% off{o.member_pass_name ? ` · ${o.member_pass_name}` : ""}
                    </Pill>
                  ) : null}
                </div>
                {(() => {
                  const gross = Number(o.cafe_item?.price ?? 0) * o.quantity;
                  const discount = Number(o.discount_inr ?? 0);
                  return (
                    <p className="font-body text-sm text-charcoal/70">
                      {discount > 0 ? (
                        <>
                          <span className="line-through text-charcoal/40">{inr(gross)}</span>{" "}
                          <span className="text-sage font-medium">− {inr(discount)}</span>{" "}
                          <span className="font-semibold text-charcoal">{inr(gross - discount)}</span>
                        </>
                      ) : (
                        <span className="font-semibold text-charcoal">{inr(gross)}</span>
                      )}
                    </p>
                  );
                })()}
                <div className="flex items-center justify-between gap-2 rounded-lg bg-sand/40 px-3 py-2">
                  {startTime ? (
                    <>
                      <p className="font-body text-sm text-charcoal min-w-0 truncate">
                        <span className="font-medium">{className ?? "Class"}</span>
                        <span className="text-charcoal/55"> · {orderDateTime(startTime)}</span>
                      </p>
                      <Pill
                        tone={isUrgent ? "danger" : "warning"}
                        size="sm"
                        className="shrink-0 font-body font-medium"
                      >
                        {relativeToNow(startTime)}
                      </Pill>
                    </>
                  ) : (
                    <p className="font-body text-sm text-charcoal/55">Walk-in — no class</p>
                  )}
                </div>
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
              <MetricCard label="Active orders" value={String(active.length)} icon={ClipboardList} description="Café orders currently in progress, not yet completed or cancelled." />
              <MetricCard label="Pending" value={String(pendingCount)} icon={Clock} description="Active orders still awaiting preparation to start." />
              <MetricCard label="Completed today" value={String(completedToday)} icon={CheckCircle2} description="Orders marked completed since midnight today." />
            </div>

            {orderQueue}
          </div>
        </main>
      </div>
    </>
  );
}
