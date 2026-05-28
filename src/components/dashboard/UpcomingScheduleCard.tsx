import { useMemo } from "react";
import Image from "next/image";
import { CalendarDays, ChevronRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AnimatedIcon } from "@/components/dashboard/AnimatedIcon";
import { cdnUrl } from "@/lib/cdnUrl";

export interface ScheduleEntry {
  id: string;
  title: string;
  subtitle?: string;
  whenISO?: string;
  imageUrl?: string;
  status?: "pending" | "confirmed";
  onClick?: () => void;
}

export interface UpcomingScheduleCardProps {
  title?: string;
  description?: string;
  entries: ScheduleEntry[];
}

function formatWhen(iso?: string) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  return `${date} at ${time}`;
}

export function UpcomingScheduleCard({
  title = "Upcoming",
  description = "Your next sessions",
  entries,
}: UpcomingScheduleCardProps) {
  // Precompute the formatted when-label per entry so a parent rerender doesn't
  // re-parse Date + invoke 2× toLocale* per row.
  const rows = useMemo(
    () => entries.map((entry) => ({ entry, when: formatWhen(entry.whenISO) })),
    [entries],
  );

  return (
    <Card className="rounded-2xl shadow-xs">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-xl text-card-foreground">
          <AnimatedIcon icon={CalendarDays} size={20} className="text-primary" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">No upcoming classes</p>
        ) : (
          <div className="space-y-2">
            {rows.map(({ entry, when }) => {
              return (
                <button
                  key={entry.id}
                  onClick={entry.onClick}
                  className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted"
                >
                  <Image
                    src={entry.imageUrl || cdnUrl("/placeholder.jpg")}
                    alt={entry.title}
                    width={56}
                    height={56}
                    unoptimized
                    className="h-14 w-14 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-base text-card-foreground">{entry.title}</p>
                    {entry.subtitle ? (
                      <p className="truncate text-xs text-muted-foreground">{entry.subtitle}</p>
                    ) : null}
                    {entry.status === "pending" ? (
                      <Badge className="mt-1 bg-accent/10 text-accent">Pending confirmation</Badge>
                    ) : null}
                    {when ? <p className="mt-1 text-xs font-semibold text-primary">{when}</p> : null}
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground/40" />
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
