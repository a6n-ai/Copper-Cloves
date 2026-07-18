import { useCallback, useEffect, useState } from "react";
import { Loader2, CalendarX, Check, X } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/responsive/ResponsiveDialog";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { Pagination, usePagination } from "@/components/Pagination";

type CancellationRequestRow = {
  id: string;
  status: string;
  kind: string;
  reason: string | null;
  refund_type: string | null;
  refund_amount_paise: number | null;
  created_at: string;
  decided_at: string | null;
  profile: { id: string; full_name: string | null; email: string } | null;
  booking: { id: string; class_name: string | null; class_time: string | null; status: string } | null;
  class_schedule: {
    id: string;
    start_time: string | null;
    class_model: { name: string | null } | null;
  } | null;
};

const REQUEST_STATUS_FILTERS = ["open", "approved", "denied", "all"] as const;

function fmtDateTime(v: string | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export default function CancellationsTab() {
  const [rows, setRows] = useState<CancellationRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<(typeof REQUEST_STATUS_FILTERS)[number]>("open");
  const [actingId, setActingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { page, setPage, pageItems, total, pageSize } = usePagination(rows, 10, statusFilter);
  const selected = rows.find((r) => r.id === selectedId) ?? null;

  const load = useCallback(async (filter: (typeof REQUEST_STATUS_FILTERS)[number]) => {
    const qs = filter === "all" ? "" : `?status=${filter}`;
    const r = await fetch(`/api/admin/class-cancellation-requests${qs}`, {
      headers: { "Cache-Control": "no-store" },
    });
    if (!r.ok) {
      toast.error("Could not load cancellation requests.");
      return;
    }
    const d = await r.json();
    setRows(Array.isArray(d.requests) ? d.requests : []);
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        await load(statusFilter);
      } finally {
        setLoading(false);
      }
    })();
  }, [load, statusFilter]);

  const decide = useCallback(
    async (
      id: string,
      action: "approve" | "deny",
      opts?: { refund_type?: "amount" | "class_pass"; refund_amount_paise?: number },
    ) => {
      if (action === "approve" && !opts && !window.confirm("Approve this cancellation? The booking will be cancelled and refund passes granted.")) {
        return;
      }
      setActingId(id);
      try {
        const r = await fetch("/api/admin/class-cancellation-requests", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, action, ...opts }),
        });
        if (!r.ok) {
          const e = await r.json().catch(() => ({}));
          toast.error(e.error ?? "Could not update request.");
          return;
        }
        toast.success(action === "approve" ? "Cancellation approved." : "Request denied.");
        setSelectedId(null);
        await load(statusFilter);
      } finally {
        setActingId(null);
      }
    },
    [load, statusFilter],
  );

  const approveRefundMoney = useCallback(
    async (id: string) => {
      const inr = window.prompt("Refund amount in ₹:");
      if (inr == null) return;
      const amt = Number(inr);
      if (!Number.isFinite(amt) || amt <= 0) {
        toast.error("Enter a valid amount in ₹.");
        return;
      }
      await decide(id, "approve", { refund_type: "amount", refund_amount_paise: Math.round(amt * 100) });
    },
    [decide],
  );

  const renderActions = (req: CancellationRequestRow) => {
    if (req.status !== "open") {
      return <span className="font-body text-xs text-charcoal/40">{fmtDateTime(req.decided_at)}</span>;
    }
    return (
      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        {req.kind === "refund" ? (
          <>
            <Button type="button" variant="sage" size="sm" disabled={actingId === req.id}
              onClick={() => decide(req.id, "approve", { refund_type: "class_pass" })} className="gap-1">
              {actingId === req.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Pass
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={actingId === req.id}
              onClick={() => approveRefundMoney(req.id)} className="gap-1 border-sage/30 text-sage">
              ₹ Refund
            </Button>
          </>
        ) : (
          <Button type="button" variant="sage" size="sm" disabled={actingId === req.id}
            onClick={() => decide(req.id, "approve")} className="gap-1">
            {actingId === req.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Approve
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" disabled={actingId === req.id}
          onClick={() => decide(req.id, "deny")} className="gap-1">
          <X className="h-3.5 w-3.5" /> Deny
        </Button>
      </div>
    );
  };

  const statusPill = (status: string) =>
    status === "open" ? (
      <Pill tone="warning" size="sm">Open</Pill>
    ) : status === "approved" ? (
      <Pill tone="success" size="sm">Approved</Pill>
    ) : (
      <Pill tone="danger" size="sm">Denied</Pill>
    );

  return (
    <Card className="border-sage/20 bg-white-warm">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="font-body font-semibold text-2xl text-charcoal">Cancellation & Refund Requests</CardTitle>
          <CardDescription className="font-body text-charcoal/60">
            Late-cancel requests (approve → cancel + 1 Class Pass refund) and member refund requests on
            already-cancelled classes (choose a class pass or a ₹ refund).
          </CardDescription>
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as (typeof REQUEST_STATUS_FILTERS)[number])}>
          <SelectTrigger className="w-[150px] shrink-0 border-sage/20 font-body">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REQUEST_STATUS_FILTERS.map((s) => (
              <SelectItem key={s} value={s} className="font-body capitalize">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-12 text-center font-body text-sm text-charcoal/40">Loading requests…</div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center font-body text-sm text-charcoal/40">
            <CalendarX className="mx-auto mb-3 h-10 w-10 text-charcoal/20" /> No {statusFilter === "all" ? "" : statusFilter} requests.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-sage/15 bg-white-warm">
            <ResponsiveTable stack>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead className="w-[110px]">Type</TableHead>
                    <TableHead className="w-[170px]">Class time</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="w-[120px]">Status</TableHead>
                    <TableHead className="w-[200px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageItems.map((req) => {
                    const className =
                      req.class_schedule?.class_model?.name ?? req.booking?.class_name ?? "Class";
                    const classTime = req.class_schedule?.start_time ?? req.booking?.class_time ?? null;
                    return (
                      <TableRow
                        key={req.id}
                        onClick={() => setSelectedId(req.id)}
                        className="h-16 cursor-pointer transition-colors hover:bg-sage/5"
                      >
                        <TableCell className="font-body text-sm text-charcoal">
                          <div className="truncate font-medium">{req.profile?.full_name ?? req.profile?.email ?? "Member"}</div>
                          {req.profile?.email && (
                            <div className="truncate font-body text-xs text-charcoal/50">{req.profile.email}</div>
                          )}
                        </TableCell>
                        <TableCell className="truncate font-body text-sm text-charcoal/70">{className}</TableCell>
                        <TableCell>
                          {req.kind === "refund" ? (
                            <Pill tone="warning" size="sm">Refund</Pill>
                          ) : (
                            <Pill tone="neutral" size="sm">Late cancel</Pill>
                          )}
                        </TableCell>
                        <TableCell className="font-body text-xs text-charcoal/60">{fmtDateTime(classTime)}</TableCell>
                        <TableCell className="max-w-[220px] truncate font-body text-xs text-charcoal/60">
                          {req.reason?.trim() || "—"}
                        </TableCell>
                        <TableCell>{statusPill(req.status)}</TableCell>
                        <TableCell className="text-right">{renderActions(req)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ResponsiveTable>
            <Pagination page={page} total={total} pageSize={pageSize} onChange={setPage} className="px-4 pb-3" />
          </div>
        )}
      </CardContent>

      <ResponsiveDialog open={selected != null} onOpenChange={(o) => !o && setSelectedId(null)}>
        <ResponsiveDialogContent className="max-w-lg">
          {selected && (
            <>
              <ResponsiveDialogHeader>
                <ResponsiveDialogTitle className="flex items-center gap-2 font-body">
                  {selected.kind === "refund" ? "Refund request" : "Late-cancel request"}
                  {statusPill(selected.status)}
                </ResponsiveDialogTitle>
                <ResponsiveDialogDescription className="font-body">
                  Requested {fmtDateTime(selected.created_at)}
                </ResponsiveDialogDescription>
              </ResponsiveDialogHeader>

              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 py-2 font-body text-sm">
                <dt className="text-charcoal/50">Member</dt>
                <dd className="text-charcoal">
                  <div className="font-medium">{selected.profile?.full_name ?? "—"}</div>
                  {selected.profile?.email && <div className="text-xs text-charcoal/50">{selected.profile.email}</div>}
                </dd>

                <dt className="text-charcoal/50">Class</dt>
                <dd className="text-charcoal">
                  {selected.class_schedule?.class_model?.name ?? selected.booking?.class_name ?? "Class"}
                </dd>

                <dt className="text-charcoal/50">Class time</dt>
                <dd className="text-charcoal">
                  {fmtDateTime(selected.class_schedule?.start_time ?? selected.booking?.class_time ?? null)}
                </dd>

                <dt className="text-charcoal/50">Reason</dt>
                <dd className="whitespace-pre-wrap text-charcoal">{selected.reason?.trim() || "—"}</dd>

                {selected.refund_type && (
                  <>
                    <dt className="text-charcoal/50">Refund</dt>
                    <dd className="text-charcoal">
                      {selected.refund_type === "amount"
                        ? `₹${((selected.refund_amount_paise ?? 0) / 100).toLocaleString("en-IN")}`
                        : "Class pass"}
                    </dd>
                  </>
                )}

                {selected.decided_at && (
                  <>
                    <dt className="text-charcoal/50">Decided</dt>
                    <dd className="text-charcoal">{fmtDateTime(selected.decided_at)}</dd>
                  </>
                )}
              </dl>

              {selected.status === "open" && (
                <ResponsiveDialogFooter>{renderActions(selected)}</ResponsiveDialogFooter>
              )}
            </>
          )}
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </Card>
  );
}
