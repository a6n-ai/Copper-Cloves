import { useMemo } from "react";
import Image from "next/image";
import { CalendarDays, ChevronRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { EmptyState } from "@/components/ui/empty-state";
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
  /** ISO deadline for free (refund-pass) self-cancel; past it, cancel needs studio approval. */
  cancelByISO?: string;
  /** When set, a Cancel action is shown on the row. */
  onCancel?: () => void;
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
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "Asia/Kolkata" });
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
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
    () =>
      entries.map((entry) => ({
        entry,
        when: formatWhen(entry.whenISO),
        cancelBy: formatWhen(entry.cancelByISO),
        cancelOpen: entry.cancelByISO ? Date.now() < new Date(entry.cancelByISO).getTime() : false,
      })),
    [entries],
  );

  return (
    <Card className="rounded-2xl shadow-none border-border transition-shadow hover:shadow-[0_4px_24px_rgba(51,51,51,0.08)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-body font-semibold text-xl text-card-foreground">
          <AnimatedIcon icon={CalendarDays} size={20} className="text-primary" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No upcoming classes"
            description="Booked classes will show up here."
            className="py-8"
          />
        ) : (
          <div className="space-y-2">
            {rows.map(({ entry, when, cancelBy, cancelOpen }) => {
              return (
                <div
                  key={entry.id}
                  className="flex w-full items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted"
                >
                  <button
                    onClick={entry.onClick}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-1"
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
                      <p className="truncate font-body font-semibold text-base text-card-foreground">{entry.title}</p>
                      {entry.subtitle ? (
                        <p className="truncate text-xs text-muted-foreground">{entry.subtitle}</p>
                      ) : null}
                      {entry.status === "pending" ? (
                        <Pill tone="warning" className="mt-1">Pending confirmation</Pill>
                      ) : null}
                      {when ? <p className="mt-1 text-xs font-semibold text-primary">{when}</p> : null}
                      {cancelBy ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {cancelOpen ? `Cancel free until ${cancelBy}` : "Cancellation cutoff passed"}
                        </p>
                      ) : null}
                    </div>
                  </button>
                  {entry.onCancel ? (
                    <button
                      onClick={entry.onCancel}
                      className="shrink-0 rounded-md border border-terracotta/30 px-3 py-1.5 text-xs font-medium text-terracotta transition-colors hover:bg-terracotta/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-1"
                    >
                      Cancel
                    </button>
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground/40" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
