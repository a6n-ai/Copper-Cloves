import { memo, useId, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { useReducedMotion } from "framer-motion";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { rates, type ClassReport } from "@/lib/classReport";
import { fmtBucket, fmtPct, plural, SAGE_DEEP } from "./format";

// Deep sage against terracotta clears the colour-blind and 3:1 mark-contrast checks that
// plain sage against terracotta fails; the dashed attendance line is the second cue.
const SERIES = {
  signups: { label: "Signups", color: "color-mix(in srgb, var(--color-sage) 80%, var(--color-charcoal))" },
  utilization: { label: "Utilization", color: SAGE_DEEP },
  attendance: { label: "Attendance", color: "var(--color-terracotta)" },
};
type SeriesKey = keyof typeof SERIES;

const signupsConfig = { signups: SERIES.signups };
const ratesConfig = { utilization: SERIES.utilization, attendance: SERIES.attendance };
const SIGNUPS_KEYS: SeriesKey[] = ["signups"];
const RATE_KEYS: SeriesKey[] = ["utilization", "attendance"];

const SURFACE = "var(--color-white-warm)";
const TICK = { fontSize: 11, fill: "var(--color-muted-foreground)" };
const GRID = "var(--color-border)";
const MARGIN = { top: 8, right: 8, left: 0, bottom: 0 };
const ACTIVE_DOT = { r: 5, stroke: SURFACE, strokeWidth: 2 };
const MOTION = { animationDuration: 300, animationEasing: "ease-out" as const };

const DAY_MS = 86_400_000;
// Range and bucket keys are IST calendar dates; reading them as UTC midnights keeps the day
// count exact whatever the browser's timezone.
const dayNumber = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / DAY_MS;

// Weekly buckets start on a Monday, so the first and last can hold fewer than 7 days of the range.
function daysInRange(bucketStart: string, from: string, to: string): number {
  const start = dayNumber(bucketStart);
  return Math.min(start + 6, dayNumber(to)) - Math.max(start, dayNumber(from)) + 1;
}

type RateKey = "utilization" | "attendance";

// Marker half-width per series, sized so neighbours never touch: a year of weekly
// buckets on a phone leaves about 5px per point, a 30-day range about 9px.
function markerSize(points: number): Record<RateKey, number> {
  if (points <= 14) return { utilization: 4, attendance: 5 };
  if (points <= 31) return { utilization: 2.5, attendance: 3.5 };
  return { utilization: 1.75, attendance: 2.25 };
}

// Utilization is a filled circle, attendance a diamond (hollow while there is room for
// a hole), so the two differ by shape as well as by colour and dash.
function MarkerShape({ series, cx, cy, half }: Readonly<{ series: RateKey; cx: number; cy: number; half: number }>) {
  const { color } = SERIES[series];
  if (series === "utilization") return <circle cx={cx} cy={cy} r={half} fill={color} />;
  const hollow = half >= 3;
  return (
    <path
      d={`M${cx} ${cy - half}L${cx + half} ${cy}L${cx} ${cy + half}L${cx - half} ${cy}Z`}
      fill={hollow ? SURFACE : color}
      stroke={color}
      strokeWidth={hollow ? 1.5 : 0}
    />
  );
}

// The lines bridge buckets that have no rate, so a marker is the only sign that a point
// was measured. It is drawn from the bucket's own value: no value, no marker.
const marker = (series: RateKey, half: number) =>
  function Marker({ cx, cy, index, payload }: { cx?: number; cy?: number; index: number; payload?: Record<string, unknown> }) {
    if (typeof payload?.[series] !== "number" || typeof cx !== "number" || typeof cy !== "number") {
      return <g key={index} />;
    }
    return <MarkerShape key={index} series={series} cx={cx} cy={cy} half={half} />;
  };

// Series colours come from the SERIES map above, so they are set inline rather than as utilities.
function SeriesMark({ series }: Readonly<{ series: SeriesKey }>) {
  const { color } = SERIES[series];
  if (series === "signups") {
    return <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: color }} />;
  }
  return (
    <span aria-hidden className="shrink-0">
      <svg width="24" height="10" viewBox="0 0 24 10" className="block">
        <line x1="0" y1="5" x2="24" y2="5" stroke={color} strokeWidth="2" strokeDasharray={series === "attendance" ? "5 4" : undefined} />
        <MarkerShape series={series} cx={12} cy={5} half={series === "attendance" ? 4 : 3} />
      </svg>
    </span>
  );
}

function Legend({ series }: Readonly<{ series: SeriesKey[] }>) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-body text-xs text-charcoal/70">
      {series.map((key) => (
        <span key={key} className="flex items-center gap-1.5">
          <SeriesMark series={key} />
          {SERIES[key].label}
        </span>
      ))}
    </div>
  );
}

// A custom formatter replaces the whole row in ChartTooltipContent, so it must rebuild mark + name + value.
const tooltipRow = (value: unknown, _name: unknown, item: { dataKey?: unknown }) => {
  const key = String(item.dataKey);
  if (!(key in SERIES)) return null;
  const series = key as SeriesKey;
  let shown = "—";
  if (typeof value === "number") shown = series === "signups" ? String(value) : fmtPct(value);
  return (
    <>
      <SeriesMark series={series} />
      <div className="flex flex-1 items-center justify-between gap-4 leading-none">
        <span className="text-muted-foreground">{SERIES[series].label}</span>
        <span className="font-body font-medium tabular-nums text-foreground">{shown}</span>
      </div>
    </>
  );
};

const tooltipLabel = (_label: unknown, items: ReadonlyArray<{ payload?: { full?: string } }>) =>
  items[0]?.payload?.full ?? "";

function ClassTrendChartImpl({
  trend,
  bucket,
  from,
  to,
}: Readonly<{ trend: ClassReport["trend"]; bucket: ClassReport["range"]["bucket"]; from: string; to: string }>) {
  const reduceMotion = useReducedMotion();
  const patternId = `partial-week-${useId().replace(/\W/g, "")}`;
  const data = useMemo(
    () =>
      trend.map((b) => {
        const r = rates(b.totals);
        const day = parseISO(b.bucket);
        const days = bucket === "week" ? daysInRange(b.bucket, from, to) : 7;
        const partial = days < 7;
        let full = format(day, "EEE d MMM");
        if (bucket === "week") {
          full = `Week of ${format(day, "d MMM")}`;
          if (partial) full += `, partial week: ${plural(days, "day")} in range`;
        }
        return {
          label: fmtBucket(b.bucket),
          full,
          partial,
          signups: b.totals.signups,
          utilization: r.utilization,
          attendance: r.attendance,
        };
      }),
    [trend, bucket, from, to],
  );

  const summary = useMemo(() => {
    if (data.length === 0) return "";
    let total = 0;
    let peak = data[0];
    for (const d of data) {
      total += d.signups;
      if (d.signups > peak.signups) peak = d;
    }
    return `${plural(total, "signup")} over ${plural(data.length, bucket)}. Busiest: ${peak.full}, ${plural(peak.signups, "signup")}.`;
  }, [data, bucket]);

  const animate = !reduceMotion;
  const markers = useMemo(() => {
    const size = markerSize(data.length);
    return {
      utilization: marker("utilization", size.utilization),
      attendance: marker("attendance", size.attendance),
    };
  }, [data.length]);

  return (
    <div className="space-y-5">
      <p className="sr-only">{summary}</p>
      <div className="space-y-2">
        <Legend series={SIGNUPS_KEYS} />
        <ChartContainer config={signupsConfig} className="h-[160px] w-full">
          <BarChart data={data} syncId="class-trend" margin={MARGIN}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <defs>
              <pattern id={patternId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="6" height="6" fill={SURFACE} />
                <rect width="2.5" height="6" fill={SERIES.signups.color} />
              </pattern>
            </defs>
            <XAxis dataKey="label" hide />
            <YAxis width={36} tickLine={false} axisLine={false} tick={TICK} allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent formatter={tooltipRow} labelFormatter={tooltipLabel} />} />
            <Bar
              dataKey="signups"
              fill="var(--color-signups)"
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
              isAnimationActive={animate}
              {...MOTION}
            >
              {data.map((d) => (
                <Cell
                  key={d.label}
                  fill={d.partial ? `url(#${patternId})` : "var(--color-signups)"}
                  stroke={d.partial ? SERIES.signups.color : undefined}
                  strokeDasharray={d.partial ? "3 2" : undefined}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </div>
      <div className="space-y-2">
        <Legend series={RATE_KEYS} />
        <ChartContainer config={ratesConfig} className="h-[200px] w-full">
          <LineChart data={data} syncId="class-trend" margin={MARGIN}>
            <CartesianGrid vertical={false} stroke={GRID} />
            {/* band, not the line chart's default point scale, so points sit at the centre of the bands the bars use. */}
            <XAxis
              dataKey="label"
              scale="band"
              tickLine={false}
              axisLine={false}
              tick={TICK}
              tickMargin={8}
              minTickGap={24}
              interval="preserveStartEnd"
            />
            <YAxis
              width={36}
              domain={[0, 100]}
              allowDataOverflow
              tickLine={false}
              axisLine={false}
              tick={TICK}
              tickFormatter={(v: number) => `${v}%`}
            />
            {/* filterNull off: a bucket with no rate keeps its row and reads "—" instead of vanishing. */}
            <ChartTooltip
              filterNull={false}
              content={<ChartTooltipContent formatter={tooltipRow} labelFormatter={tooltipLabel} />}
            />
            {/* Days with no classes have no rate. Bridging them keeps a lone day's point on the chart
                instead of dropping it; every measured point carries a marker, bridged stretches carry none. */}
            <Line
              dataKey="utilization"
              stroke="var(--color-utilization)"
              strokeWidth={2}
              dot={markers.utilization}
              activeDot={ACTIVE_DOT}
              connectNulls
              isAnimationActive={animate}
              {...MOTION}
            />
            <Line
              dataKey="attendance"
              stroke="var(--color-attendance)"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={markers.attendance}
              activeDot={ACTIVE_DOT}
              connectNulls
              isAnimationActive={animate}
              {...MOTION}
            />
          </LineChart>
        </ChartContainer>
      </div>
    </div>
  );
}

export const ClassTrendChart = memo(ClassTrendChartImpl);
