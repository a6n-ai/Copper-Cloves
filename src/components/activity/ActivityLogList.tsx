import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface ActivityLogItem {
  id: string;
  action: string;
  category: string;
  summary: string;
  actorIsSelf?: boolean;
  actorName?: string | null;
  createdAt: string;
}

const CATEGORY_CLASS: Record<string, string> = {
  auth: "bg-sage/10 text-sage border-sage/20",
  member: "bg-sage/10 text-sage border-sage/20",
  admin: "bg-terracotta/10 text-terracotta border-terracotta/20",
  instructor: "bg-cream/40 text-charcoal border-sage/20",
  partner: "bg-cream/40 text-charcoal border-sage/20",
  system: "bg-charcoal/5 text-charcoal/60 border-charcoal/10",
};

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function ActivityLogList({
  endpoint = "/api/user/activity-log",
  query = "",
  emptyLabel = "No activity yet.",
}: {
  endpoint?: string;
  query?: string;
  emptyLabel?: string;
}) {
  const [items, setItems] = useState<ActivityLogItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(
    async (reset: boolean) => {
      setLoading(true);
      try {
        const params = new URLSearchParams(query);
        if (!reset && cursor) params.set("cursor", cursor);
        const sep = params.toString() ? "?" : "";
        const res = await fetch(`${endpoint}${sep}${params.toString()}`);
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as { items: ActivityLogItem[]; nextCursor: string | null };
        setItems((prev) => (reset ? json.items : [...prev, ...json.items]));
        setCursor(json.nextCursor);
      } catch {
        if (!loaded) setItems([]);
      } finally {
        setLoading(false);
        setLoaded(true);
      }
    },
    [endpoint, query, cursor, loaded],
  );

  // Reset + reload whenever endpoint/query change.
  useEffect(() => {
    setItems([]);
    setCursor(null);
    setLoaded(false);
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, query]);

  if (loaded && items.length === 0) {
    return <p className="font-body text-sm text-charcoal/50 py-6 text-center">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((it) => (
        <div
          key={it.id}
          className="flex items-start justify-between gap-3 rounded-lg border border-sage/10 bg-white-warm px-4 py-3"
        >
          <div className="min-w-0">
            <p className="font-body text-sm text-charcoal">
              {it.summary}
              {it.actorIsSelf === false && it.actorName ? (
                <span className="text-charcoal/50"> · by {it.actorName}</span>
              ) : null}
            </p>
            <p className="font-body text-xs text-charcoal/40 mt-0.5">{timeAgo(it.createdAt)}</p>
          </div>
          <Badge variant="outline" className={CATEGORY_CLASS[it.category] ?? CATEGORY_CLASS.system}>
            {it.category}
          </Badge>
        </div>
      ))}
      {cursor ? (
        <div className="flex justify-center pt-2">
          <Button variant="outline" size="sm" disabled={loading} onClick={() => void load(false)}>
            {loading ? "Loading…" : "Load more"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
