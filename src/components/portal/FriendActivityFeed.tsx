import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cdnUrl } from "@/lib/cdnUrl";
import { getFriendActivity, type FriendActivity } from "@/services/friends";

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
  });
}
function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  if (avatarUrl)
    return <Image src={cdnUrl(avatarUrl)} alt={name} width={36} height={36} unoptimized className="size-9 shrink-0 rounded-full object-cover" />;
  return <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sage text-xs font-semibold text-cream">{initials || "?"}</div>;
}

export function FriendActivityFeed() {
  const [items, setItems] = useState<FriendActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getFriendActivity()
      .then((d) => { if (!cancelled) setItems(d); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading)
    return (
      <div className="space-y-3" aria-hidden>
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center gap-2.5">
            <div className="size-9 animate-pulse rounded-full bg-muted" />
            <div className="h-3.5 w-40 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  if (error) return <p className="text-sm text-muted-foreground">Couldn&apos;t load activity right now.</p>;
  if (items.length === 0)
    return <EmptyState icon={CalendarClock} title="Nothing upcoming" description="When your friends book a class, it'll show here." />;

  return (
    <ul className="space-y-2">
      {items.map((a) => (
        <li key={`${a.friendId}-${a.scheduleId}`} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar name={a.friendName} avatarUrl={a.friendAvatarUrl} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-charcoal">{a.className}</p>
              <p className="truncate text-xs text-muted-foreground">{a.friendName} · {fmt(a.startTime)}</p>
            </div>
          </div>
          <Button asChild size="sm" variant="sage-outline" className="shrink-0">
            <Link href="/portal/book">Book this too</Link>
          </Button>
        </li>
      ))}
    </ul>
  );
}
