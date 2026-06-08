import { useCallback, useEffect, useState } from "react";
import { Pill, type PillProps } from "@/components/ui/pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import { Pagination } from "@/components/Pagination";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

type SortField = "summary" | "category" | "actor_name" | "created_at";
type SortDir = "asc" | "desc";
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

// Pill tone per category, inferred from the prior palette: sage→success,
// terracotta/deep-clay→warning, charcoal/sand/muted→neutral.
const CATEGORY_TONE: Record<string, NonNullable<PillProps["tone"]>> = {
  auth: "success",
  member: "warning",
  admin: "warning",
  instructor: "neutral",
  partner: "neutral",
  system: "neutral",
};

function categoryTone(category: string): NonNullable<PillProps["tone"]> {
  return CATEGORY_TONE[category] ?? "neutral";
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

function SortHead({
  label,
  field,
  sortField,
  sortDir,
  onSort,
  className,
}: {
  label: string;
  field: SortField;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (f: SortField) => void;
  className?: string;
}) {
  const active = sortField === field;
  const Icon = active ? (sortDir === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown;
  return (
    <TableHead
      className={`font-body ${className ?? ""}`}
      aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`inline-flex items-center gap-1.5 transition-colors hover:text-charcoal ${active ? "text-charcoal" : ""}`}
      >
        {label}
        <Icon className={`h-3.5 w-3.5 ${active ? "text-sage" : "text-charcoal/30"}`} />
      </button>
    </TableHead>
  );
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
                <Pill tone={categoryTone(item.category)}>
                  {item.category}
                </Pill>
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
  pageSize = 10,
}: {
  endpoint?: string;
  query?: string;
  emptyLabel?: string;
  pageSize?: number;
}) {
  const [items, setItems] = useState<ActivityLogItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<ActivityLogItem | null>(null);
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const load = useCallback(
    async (targetPage: number) => {
      try {
        const params = new URLSearchParams(query);
        params.set("page", String(targetPage));
        params.set("limit", String(pageSize));
        params.set("sort", sortField);
        params.set("dir", sortDir);
        const res = await fetch(`${endpoint}?${params.toString()}`);
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as {
          items: ActivityLogItem[];
          page: number;
          total: number;
        };
        setItems(json.items);
        setPage(json.page);
        setTotal(json.total);
      } catch {
        if (!loaded) setItems([]);
      } finally {
        setLoaded(true);
      }
    },
    [endpoint, query, pageSize, sortField, sortDir, loaded],
  );

  // Reset to page 1 + reload whenever endpoint/query/sort change.
  useEffect(() => {
    setItems([]);
    setPage(1);
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, query, sortField, sortDir]);

  // New column → sort that column (desc for time, asc for text); same column → flip.
  const toggleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "created_at" ? "desc" : "asc");
    }
  };

  if (loaded && items.length === 0) {
    return <p className="font-body text-sm text-charcoal/50 py-6 text-center">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-4">
      <ResponsiveTable>
        <div className="rounded-xl border border-sage/15 bg-white-warm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHead label="Action" field="summary" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <SortHead label="Category" field="category" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <SortHead label="Actor" field="actor_name" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <SortHead label="When" field="created_at" sortField={sortField} sortDir={sortDir} onSort={toggleSort} className="whitespace-nowrap" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((it) => (
              <TableRow
                key={it.id}
                className="cursor-pointer"
                onClick={() => setSelected(it)}
              >
                <TableCell className="font-body">
                  {it.summary}
                  {it.actorIsSelf === false && it.actorName ? (
                    <span className="block text-xs text-charcoal/45">by {it.actorName}</span>
                  ) : null}
                </TableCell>
                <TableCell>
                  <Pill tone={categoryTone(it.category)}>
                    {it.category}
                  </Pill>
                </TableCell>
                <TableCell className="font-body text-charcoal/70 whitespace-nowrap">
                  {actorLabel(it)}
                  {it.actorRole ? <span className="text-charcoal/40"> · {it.actorRole}</span> : null}
                </TableCell>
                <TableCell
                  className="font-body text-charcoal/60 whitespace-nowrap"
                  title={fullTimestamp(it.createdAt)}
                >
                  {timeAgo(it.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </ResponsiveTable>

      <Pagination page={page} total={total} pageSize={pageSize} onChange={(p) => void load(p)} />

      <ActivityDetailDialog item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
