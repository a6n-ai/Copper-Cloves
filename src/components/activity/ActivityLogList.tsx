import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/responsive/ResponsiveDialog";

export interface ActivityLogItem {
  id: string;
  action: string;
  category: string;
  summary: string;
  actorIsSelf?: boolean;
  actorName?: string | null;
  actorRole?: string | null;
  actorEmail?: string | null;
  target?: { id: string; name: string | null; email: string | null; role: string | null } | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
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

function categoryClass(category: string): string {
  return CATEGORY_CLASS[category] ?? CATEGORY_CLASS.system;
}

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

function fullTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function actorLabel(it: ActivityLogItem): string {
  if (it.actorIsSelf) return "You";
  return it.actorName ?? "—";
}

/** One labelled row in the detail dialog. Renders nothing when the value is empty. */
function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="grid grid-cols-3 gap-3 py-2 border-b border-sage/10 last:border-0">
      <dt className="font-body text-xs uppercase tracking-wide text-charcoal/50">{label}</dt>
      <dd className="col-span-2 font-body text-sm text-charcoal break-words">{value}</dd>
    </div>
  );
}

function hasMetadata(meta: Record<string, unknown> | null | undefined): meta is Record<string, unknown> {
  return !!meta && typeof meta === "object" && Object.keys(meta).length > 0;
}

function ActivityDetailDialog({
  item,
  onClose,
}: {
  item: ActivityLogItem | null;
  onClose: () => void;
}) {
  return (
    <ResponsiveDialog open={!!item} onOpenChange={(open) => !open && onClose()}>
      <ResponsiveDialogContent className="max-w-lg">
        {item ? (
          <>
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle className="font-display text-xl text-charcoal flex items-center gap-2">
                {item.summary}
                <Badge variant="outline" className={categoryClass(item.category)}>
                  {item.category}
                </Badge>
              </ResponsiveDialogTitle>
              <ResponsiveDialogDescription className="font-body text-charcoal/60">
                {fullTimestamp(item.createdAt)}
              </ResponsiveDialogDescription>
            </ResponsiveDialogHeader>

            <dl className="mt-2">
              <DetailRow label="Action" value={<code className="text-xs">{item.action}</code>} />
              <DetailRow
                label="Actor"
                value={
                  [actorLabel(item), item.actorRole && `(${item.actorRole})`, item.actorEmail]
                    .filter(Boolean)
                    .join(" ")
                }
              />
              <DetailRow
                label="Target"
                value={
                  item.target
                    ? [item.target.name, item.target.email && `· ${item.target.email}`, item.target.role && `· ${item.target.role}`]
                        .filter(Boolean)
                        .join(" ")
                    : null
                }
              />
              <DetailRow
                label="Entity"
                value={item.entityType ? `${item.entityType} ${item.entityId ?? ""}`.trim() : null}
              />
              {hasMetadata(item.metadata) ? (
                <DetailRow
                  label="Details"
                  value={
                    <pre className="whitespace-pre-wrap break-words rounded-md bg-charcoal/5 p-3 text-xs text-charcoal/80">
                      {JSON.stringify(item.metadata, null, 2)}
                    </pre>
                  }
                />
              ) : null}
              <DetailRow label="IP" value={item.ip} />
              <DetailRow label="Device" value={item.userAgent} />
            </dl>
          </>
        ) : null}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
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
  const [selected, setSelected] = useState<ActivityLogItem | null>(null);

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
    <div className="space-y-4">
      <ResponsiveTable>
        <Table>
          <TableHeader>
            <TableRow className="bg-sage/5 hover:bg-sage/5 border-sage/10">
              <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3">Action</TableHead>
              <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3">Category</TableHead>
              <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3">Actor</TableHead>
              <TableHead className="font-body text-xs uppercase tracking-wide text-charcoal/60 px-5 py-3 whitespace-nowrap">When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((it) => (
              <TableRow
                key={it.id}
                className="border-sage/10 hover:bg-sage/5 cursor-pointer"
                onClick={() => setSelected(it)}
              >
                <TableCell className="px-5 py-4 font-body text-sm text-charcoal">
                  {it.summary}
                  {it.actorIsSelf === false && it.actorName ? (
                    <span className="block text-xs text-charcoal/45">by {it.actorName}</span>
                  ) : null}
                </TableCell>
                <TableCell className="px-5 py-4">
                  <Badge variant="outline" className={categoryClass(it.category)}>
                    {it.category}
                  </Badge>
                </TableCell>
                <TableCell className="px-5 py-4 font-body text-sm text-charcoal/70 whitespace-nowrap">
                  {actorLabel(it)}
                  {it.actorRole ? <span className="text-charcoal/40"> · {it.actorRole}</span> : null}
                </TableCell>
                <TableCell
                  className="px-5 py-4 font-body text-sm text-charcoal/60 whitespace-nowrap"
                  title={fullTimestamp(it.createdAt)}
                >
                  {timeAgo(it.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ResponsiveTable>

      {cursor ? (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" disabled={loading} onClick={() => void load(false)}>
            {loading ? "Loading…" : "Load more"}
          </Button>
        </div>
      ) : null}

      <ActivityDetailDialog item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
