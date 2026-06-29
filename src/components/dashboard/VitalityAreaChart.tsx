"use client";

import { useMemo } from "react";
import { Trophy } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatedIcon } from "@/components/dashboard/AnimatedIcon";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

export interface VitalityAreaChartProps {
  series: number[]; // length 30, daily minutes (index 0 = 29 days ago)
  totalMinutes: number;
  avgPerDay: number;
  vsLabel: string;
  vsTone: "up" | "down" | "neutral";
}

const chartConfig = {
  minutes: { label: "Minutes", color: "var(--color-chart-1)" },
} satisfies ChartConfig;

export function VitalityAreaChart({
  series,
  totalMinutes,
  avgPerDay,
  vsLabel,
  vsTone,
}: VitalityAreaChartProps) {
  // Rebuilding `data` per render makes recharts diff every path and re-render
  // the whole area chart even when the series is unchanged.
  const data = useMemo(
    () =>
      series.map((minutes, index) => ({
        day: index - (series.length - 1), // -29..0
        minutes,
      })),
    [series],
  );

  return (
    <Card className="h-full rounded-2xl shadow-none border-border transition-shadow hover:shadow-[0_4px_24px_rgba(51,51,51,0.08)]">
      <CardHeader className="border-b">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <AnimatedIcon icon={Trophy} size={24} className="text-primary" />
          </div>
          <div>
            <CardTitle className="font-body font-semibold text-2xl text-card-foreground md:text-3xl">
              Movement Vitality
            </CardTitle>
            <CardDescription>Your activity rhythm over the last 30 days</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <AreaChart accessibilityLayer data={data} margin={{ left: 0, right: 0, top: 8 }}>
            <defs>
              <linearGradient id="vitalityFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              fontSize={12}
              ticks={[-(series.length - 1), 0]}
              tickFormatter={(v) => (v === 0 ? "Today" : `${Math.abs(Number(v))}d ago`)}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="line" labelFormatter={() => "Minutes"} />}
            />
            <Area
              dataKey="minutes"
              type="natural"
              stroke="var(--color-chart-1)"
              strokeWidth={2}
              fill="url(#vitalityFill)"
            />
          </AreaChart>
        </ChartContainer>

        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-2 md:gap-4 border-t pt-6">
          <Stat value={totalMinutes} label="Total Minutes" />
          <Stat value={avgPerDay} label="Avg per Day" />
          <Stat
            value={vsLabel}
            label="vs Last Month"
            className={cn(
              vsTone === "up" && "text-primary",
              vsTone === "down" && "text-destructive",
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  value,
  label,
  className,
}: {
  value: string | number;
  label: string;
  className?: string;
}) {
  return (
    <div className="text-center">
      <p className={cn("mb-1 font-body font-semibold text-2xl text-card-foreground md:text-3xl lg:text-4xl break-all tabular-nums", className)}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
