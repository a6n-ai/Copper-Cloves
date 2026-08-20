import { Activity, type LucideIcon } from "lucide-react";
import { MetricCard } from "@/components/admin/MetricCard";
import { cn } from "@/lib/utils";

export type StatTone = "default" | "up" | "down" | "warn";

export interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  hint?: string;
  tone?: StatTone;
  /** Square tile for the Apple-Fitness-style bento. */
  square?: boolean;
  /** Explains what this metric means. Renders an info icon with a tooltip next to the label. */
  description?: string;
}

/** Member-facing tones map onto the admin MetricCard's brand tones so both
 *  dashboards render the exact same tile. */
const TONE_MAP: Record<StatTone, "sage" | "terracotta" | "clay" | "charcoal"> = {
  default: "charcoal",
  up: "sage",
  down: "clay", // deep terracotta — negative/alert
  warn: "terracotta",
};

/** Thin wrapper over the admin MetricCard so the member dashboard stat strip is
 *  visually identical to the admin dashboard (animated number, tinted icon chip,
 *  hover lift). Keeps the StatCardProps API its existing callers rely on. */
export function StatCard({ label, value, icon, hint, tone = "default", square, description }: StatCardProps) {
  return (
    <MetricCard
      label={label}
      value={value}
      icon={icon ?? Activity}
      hint={hint}
      tone={TONE_MAP[tone]}
      square={square}
      description={description}
    />
  );
}

export interface StatCardRowProps {
  items: StatCardProps[];
  className?: string;
}

export function StatCardRow({ items, className }: StatCardRowProps) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-4", className)}>
      {items.map((item) => (
        <StatCard key={item.label} {...item} />
      ))}
    </div>
  );
}
