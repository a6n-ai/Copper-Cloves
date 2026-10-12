import { Calendar, CheckCircle2, TrendingUp, UserX, Users } from "lucide-react";
import { MetricCard } from "@/components/admin/MetricCard";
import { percentDelta, pointDelta, rates, type Totals } from "@/lib/classReport";
import { percentLabel, pointsLabel } from "./format";

const rateValue = (v: number | null) => (v === null ? { value: "—" } : { value: Math.round(v), suffix: "%" });
const FLAT = "shadow-none";

export function ClassReportKpis({
  current,
  previous,
  loading,
}: Readonly<{ current: Totals; previous: Totals; loading: boolean }>) {
  const c = rates(current);
  const p = rates(previous);
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      <MetricCard
        label="Sessions"
        value={current.sessions}
        icon={Calendar}
        tone="sage"
        loading={loading}
        className={FLAT}
        hint={percentLabel(percentDelta(current.sessions, previous.sessions))}
        description="Classes held or scheduled in the selected range. Cancelled sessions are not counted."
      />
      <MetricCard
        label="Signups"
        value={current.signups}
        icon={Users}
        tone="sage"
        loading={loading}
        className={FLAT}
        hint={percentLabel(percentDelta(current.signups, previous.signups))}
        description="Seats taken by confirmed bookings, guests included."
      />
      {/* Full row on phones: five cards in two columns would strand one, and this is the number the tab leads with. */}
      <MetricCard
        label="Utilization"
        {...rateValue(c.utilization)}
        icon={TrendingUp}
        tone="sage"
        loading={loading}
        className={`${FLAT} col-span-2 md:col-span-1`}
        hint={pointsLabel(pointDelta(c.utilization, p.utilization))}
        description="Signups as a share of all seats offered in the range."
      />
      <MetricCard
        label="Attendance rate"
        {...rateValue(c.attendance)}
        icon={CheckCircle2}
        tone="sage"
        loading={loading}
        className={FLAT}
        hint={pointsLabel(pointDelta(c.attendance, p.attendance))}
        description="Share of confirmed bookings that checked in. Counts bookings, not people. Only classes that have already ended are included."
      />
      <MetricCard
        label="No-show rate"
        {...rateValue(c.noShowRate)}
        icon={UserX}
        tone="terracotta"
        loading={loading}
        className={FLAT}
        hint={pointsLabel(pointDelta(c.noShowRate, p.noShowRate))}
        description="Share of confirmed bookings marked no-show, for classes that have ended."
      />
    </div>
  );
}
