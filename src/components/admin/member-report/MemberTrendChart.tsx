import { memo, useMemo } from "react";
import { useReducedMotion } from "framer-motion";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { MemberReport } from "@/lib/memberReport";
import { describeBucket, fmtBucket, plural } from "@/components/admin/class-report/format";

const SERIES = {
  active: { label: "Active members", color: "color-mix(in srgb, var(--color-sage) 80%, var(--color-charcoal))" },
  newMembers: { label: "New members", color: "var(--color-terracotta)" },
};
const TICK = { fontSize: 11, fill: "var(--color-muted-foreground)" };
const MARGIN = { top: 8, right: 8, left: 0, bottom: 0 };

const tooltipLabel = (_label: unknown, items: ReadonlyArray<{ payload?: { full?: string } }>) =>
  items[0]?.payload?.full ?? "";

function Panel({
  series,
  data,
  showAxis,
  animate,
}: Readonly<{
  series: keyof typeof SERIES;
  data: { label: string; full: string; partial: boolean; active: number; newMembers: number }[];
  showAxis: boolean;
  animate: boolean;
}>) {
  const { label, color } = SERIES[series];
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 font-body text-xs text-charcoal/70">
        {/* Series colours come from the SERIES map, so they are set inline rather than as utilities. */}
        <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: color }} />
        {label}
      </p>
      <ChartContainer config={{ [series]: SERIES[series] }} className={`${showAxis ? "h-[150px]" : "h-[130px]"} w-full`}>
        <BarChart data={data} syncId="member-trend" margin={MARGIN}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" />
          <XAxis
            dataKey="label"
            hide={!showAxis}
            tickLine={false}
            axisLine={false}
            tick={TICK}
            tickMargin={8}
            minTickGap={24}
            interval="preserveStartEnd"
          />
          <YAxis width={36} tickLine={false} axisLine={false} tick={TICK} allowDecimals={false} />
          <ChartTooltip content={<ChartTooltipContent labelFormatter={tooltipLabel} />} />
          <Bar dataKey={series} fill={color} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={animate} animationDuration={300}>
            {/* A week the range only partly covers is faded, so it is not read as a drop. */}
            {data.map((d) => (
              <Cell key={d.label} fillOpacity={d.partial ? 0.45 : 1} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  );
}

function MemberTrendChartImpl({
  trend,
  bucket,
  from,
  to,
}: Readonly<{ trend: MemberReport["trend"]; bucket: MemberReport["range"]["bucket"]; from: string; to: string }>) {
  const animate = !useReducedMotion();
  const data = useMemo(
    () => trend.map((t) => ({ ...t, label: fmtBucket(t.bucket), ...describeBucket(t.bucket, bucket, from, to) })),
    [trend, bucket, from, to],
  );
  const summary = useMemo(() => {
    if (data.length === 0) return "";
    const peak = data.reduce((a, b) => (b.active > a.active ? b : a));
    const joined = data.reduce((n, d) => n + d.newMembers, 0);
    return `Busiest: ${peak.full}, ${plural(peak.active, "active member")}. ${plural(joined, "new member")} over ${plural(data.length, bucket)}.`;
  }, [data, bucket]);

  return (
    <div className="space-y-5">
      <p className="sr-only">{summary}</p>
      <Panel series="active" data={data} showAxis={false} animate={animate} />
      <Panel series="newMembers" data={data} showAxis animate={animate} />
    </div>
  );
}

export const MemberTrendChart = memo(MemberTrendChartImpl);
