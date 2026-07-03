import { useCallback, useEffect, useState } from "react";
import { Pill } from "@/components/ui/pill";
import { crmMessageStatusPill } from "@/lib/pillMaps";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import { Pagination } from "@/components/Pagination";
import { ArrowDown, ArrowUp, ChevronsUpDown, Mail, MessageCircle } from "lucide-react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/responsive/ResponsiveDialog";

export interface CrmMessageItem {
  id: string;
  channel: string;
  status: string;
  subject: string | null;
  message_body: string;
  error_message: string | null;
  scheduled_for: string | null;
  sent_at: string | null;
  created_at: string;
  recipientName: string | null;
  recipientEmail: string | null;
  templateName: string | null;
}

type SortField = "recipient" | "channel" | "status" | "created_at";
type SortDir = "asc" | "desc";

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
  });
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

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="grid grid-cols-3 gap-3 py-2 border-b border-sage/10 last:border-0">
      <dt className="font-body text-xs uppercase tracking-wide text-charcoal/50">{label}</dt>
      <dd className="col-span-2 font-body text-sm text-charcoal break-words">{value}</dd>
    </div>
  );
}

// The stored body is the already-rendered message (variables substituted at send
// time). Wrap bare HTML so the iframe styles it like the real email.
function looksLikeHtml(body: string): boolean {
  return /<[a-z][\s\S]*>/i.test(body);
}

function wrapHtml(body: string): string {
  if (/<html|<!doctype/i.test(body)) return body;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family:Georgia,serif;margin:0;padding:16px;background:#F5F0E8;color:#333">${body}</body></html>`;
}

function MessagePreview({ body }: { body: string }) {
  if (looksLikeHtml(body)) {
    return (
      <div className="rounded-md border border-sage/15 overflow-hidden bg-white-warm" style={{ height: 320 }}>
        <iframe title="message-preview" srcDoc={wrapHtml(body)} sandbox="" className="w-full h-full" />
      </div>
    );
  }
  return (
    <pre className="whitespace-pre-wrap break-words rounded-md bg-charcoal/5 p-3 text-xs text-charcoal/80">
      {body}
    </pre>
  );
}

function ChannelCell({ channel }: { channel: string }) {
  const Icon = channel === "email" ? Mail : MessageCircle;
  return (
    <span className="inline-flex items-center gap-1.5 font-body text-sm text-charcoal/70 capitalize">
      <Icon className="h-3.5 w-3.5 text-charcoal/40" />
      {channel}
    </span>
  );
}

function CrmMessageDetailDialog({ item, onClose }: { item: CrmMessageItem | null; onClose: () => void }) {
  return (
    <ResponsiveDialog open={!!item} onOpenChange={(open) => !open && onClose()}>
      <ResponsiveDialogContent className="max-w-lg">
        {item ? (
          <>
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle className="font-display text-xl text-charcoal flex items-center gap-2">
                {item.recipientName || "Unknown recipient"}
                <Pill tone={crmMessageStatusPill(item.status).tone}>
                  {item.status}
                </Pill>
              </ResponsiveDialogTitle>
              <ResponsiveDialogDescription className="font-body text-charcoal/60">
                {item.recipientEmail ?? "—"}
              </ResponsiveDialogDescription>
            </ResponsiveDialogHeader>

            <dl className="mt-2">
              <DetailRow label="Channel" value={<span className="capitalize">{item.channel}</span>} />
              <DetailRow label="Template" value={item.templateName} />
              <DetailRow label="Subject" value={item.subject} />
              {item.error_message ? (
                <DetailRow
                  label="Error"
                  value={<span className="text-pill-danger-fg">{item.error_message}</span>}
                />
              ) : null}
              <DetailRow label="Scheduled" value={item.scheduled_for ? fullTimestamp(item.scheduled_for) : null} />
              <DetailRow label="Sent" value={item.sent_at ? fullTimestamp(item.sent_at) : null} />
              <DetailRow label="Created" value={fullTimestamp(item.created_at)} />
            </dl>

            <div className="mt-4">
              <span className="font-body text-xs uppercase tracking-wide text-charcoal/50">Message</span>
              <div className="mt-2">
                <MessagePreview body={item.message_body} />
              </div>
            </div>
          </>
        ) : null}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

export function CrmMessageList({
  query = "",
  emptyLabel = "No messages yet.",
  pageSize = 10,
  refreshKey = 0,
}: {
  query?: string;
  emptyLabel?: string;
  pageSize?: number;
  refreshKey?: number;
}) {
  const [items, setItems] = useState<CrmMessageItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<CrmMessageItem | null>(null);
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
        const res = await fetch(`/api/admin/crm/messages?${params.toString()}`);
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as { items: CrmMessageItem[]; page: number; total: number };
        setItems(json.items);
        setPage(json.page);
        setTotal(json.total);
      } catch {
        if (!loaded) setItems([]);
      } finally {
        setLoaded(true);
      }
    },
    [query, pageSize, sortField, sortDir, loaded],
  );

  useEffect(() => {
    setItems([]);
    setPage(1);
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, sortField, sortDir, refreshKey]);

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
      <ResponsiveTable stack>
        <div className="rounded-xl border border-sage/15 bg-white-warm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHead label="Recipient" field="recipient" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <SortHead label="Channel" field="channel" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <TableHead className="font-body">
                  Template
                </TableHead>
                <SortHead label="Status" field="status" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
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
                    {it.recipientName || "Unknown"}
                    {it.recipientEmail ? (
                      <span className="block text-xs text-charcoal/45">{it.recipientEmail}</span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <ChannelCell channel={it.channel} />
                  </TableCell>
                  <TableCell className="font-body text-charcoal/70">
                    {it.templateName ?? <span className="text-charcoal/40">—</span>}
                  </TableCell>
                  <TableCell>
                    <Pill tone={crmMessageStatusPill(it.status).tone}>
                      {it.status}
                    </Pill>
                  </TableCell>
                  <TableCell
                    className="font-body text-charcoal/60 whitespace-nowrap"
                    title={fullTimestamp(it.created_at)}
                  >
                    {timeAgo(it.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </ResponsiveTable>

      <Pagination page={page} total={total} pageSize={pageSize} onChange={(p) => void load(p)} />

      <CrmMessageDetailDialog item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
