import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Calendar } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatedIcon } from "@/components/dashboard/AnimatedIcon";

export interface ActivityItem {
  id: string;
  text: string;
  date: string;
  icon?: LucideIcon;
}

export interface ActivityTimelineProps {
  title?: string;
  description?: string;
  items: ActivityItem[];
  emptyCta?: ReactNode;
}

export function ActivityTimeline({
  title = "Recent Activity",
  description = "Your latest movements",
  items,
  emptyCta,
}: ActivityTimelineProps) {
  return (
    <Card className="rounded-2xl shadow-none border-border transition-shadow hover:shadow-[0_4px_24px_rgba(51,51,51,0.08)]">
      <CardHeader>
        <CardTitle className="font-body font-semibold text-2xl text-card-foreground">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length > 0 ? (
          <ul className="space-y-4">
            {items.map((item) => {
              const Icon = item.icon ?? Calendar;
              return (
                <li key={item.id} className="group flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <AnimatedIcon icon={Icon} size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-card-foreground">{item.text}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.date}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="py-8 text-center">
            <Calendar className="mx-auto mb-3 text-muted-foreground/30" size={40} />
            <p className="text-sm text-muted-foreground">No recent activity yet</p>
            {emptyCta ? <div className="mt-4">{emptyCta}</div> : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
