import { memo, useMemo } from "react";
import { CreditCard } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pill, type PillProps } from "@/components/ui/pill";
import { EmptyState } from "@/components/ui/empty-state";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";

export interface OrderRow {
  id: string;
  item: string;
  dateISO: string;
  amount: number; // rupees
  status: string;
  method: string;
}

export interface OrderHistoryTableProps {
  rows: OrderRow[];
}

function statusTone(status: string): PillProps["tone"] {
  switch ((status || "").toLowerCase()) {
    case "pending":
      return "warning";
    case "preparing":
    case "ready":
    case "completed":
      return "success";
    case "cancelled":
      return "danger";
    default:
      return "neutral";
  }
}

function formatStatus(status: string) {
  return (status || "pending").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatMethod(method: string) {
  const u = (method || "").toLowerCase();
  if (u === "pay_at_studio" || u.includes("studio")) return "Pay at studio";
  return "Paid online";
}

interface RowViewProps {
  id: string;
  item: string;
  dateLabel: string;
  amount: number;
  statusBadge: string;
  statusTone: PillProps["tone"];
  methodLabel: string;
}

const OrderRowView = memo(function OrderRowView({
  id,
  item,
  dateLabel,
  amount,
  statusBadge,
  statusTone,
  methodLabel,
}: RowViewProps) {
  return (
    <TableRow>
      <TableCell>
        <p className="text-sm font-medium text-card-foreground">{item}</p>
        <p className="font-mono text-xs text-muted-foreground">#{id.slice(0, 8)}…</p>
      </TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">{dateLabel}</TableCell>
      <TableCell>
        <Pill tone={statusTone} className="font-normal">{statusBadge}</Pill>
      </TableCell>
      <TableCell>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <CreditCard size={14} />
          {methodLabel}
        </span>
      </TableCell>
      <TableCell className="whitespace-nowrap text-right font-body font-semibold tabular-nums text-base text-primary">
        ₹{amount}
      </TableCell>
    </TableRow>
  );
});

export function OrderHistoryTable({ rows }: OrderHistoryTableProps) {
  // Precompute display strings per row once per `rows` change. Without this the
  // table re-parsed every Date + recomputed every status/method string on every
  // parent rerender, even when row data was identical.
  const viewRows = useMemo(
    () =>
      rows.map((row) => ({
        id: row.id,
        item: row.item,
        amount: row.amount,
        dateLabel: new Date(row.dateISO).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        statusBadge: formatStatus(row.status),
        statusTone: statusTone(row.status),
        methodLabel: formatMethod(row.method),
      })),
    [rows],
  );

  return (
    <ResponsiveTable stack>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-border">
          {viewRows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-10">
                <EmptyState
                  icon={CreditCard}
                  title="No orders yet"
                  description="Your café and boutique orders will appear here."
                  className="py-0"
                />
              </TableCell>
            </TableRow>
          ) : (
            viewRows.map((row) => <OrderRowView key={row.id} {...row} />)
          )}
        </TableBody>
      </Table>
    </ResponsiveTable>
  );
}
