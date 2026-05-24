import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { AnimatedIcon } from "@/components/dashboard/AnimatedIcon";
import { cn } from "@/lib/utils";

export type StatTone = "default" | "up" | "down" | "warn";

export interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  hint?: string;
  tone?: StatTone;
}

const toneRing: Record<StatTone, string> = {
  default: "bg-muted text-muted-foreground",
  up: "bg-primary/10 text-primary",
  down: "bg-destructive/10 text-destructive",
  warn: "bg-accent/10 text-accent",
};

export function StatCard({ label, value, icon: Icon, hint, tone = "default" }: StatCardProps) {
  return (
    <Card className="rounded-2xl shadow-xs">
      <CardContent className="flex items-center gap-3 p-4">
        {Icon ? (
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
              toneRing[tone],
            )}
          >
            <AnimatedIcon icon={Icon} size={20} />
          </div>
        ) : null}
        <div className="min-w-0">
          <p className="font-display text-2xl leading-none text-card-foreground">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{label}</p>
          {hint ? <p className="text-[10px] text-muted-foreground/70">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
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
