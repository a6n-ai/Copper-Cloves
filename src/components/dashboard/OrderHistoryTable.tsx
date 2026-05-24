import { CreditCard } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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

function statusClass(status: string) {
  switch ((status || "").toLowerCase()) {
    case "pending":
      return "bg-accent/10 text-accent";
    case "preparing":
      return "bg-primary/10 text-primary";
    case "ready":
    case "completed":
      return "bg-primary/10 text-primary";
    case "cancelled":
      return "bg-destructive/10 text-destructive";
    default:
      return "bg-muted text-muted-foreground";
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

export function OrderHistoryTable({ rows }: OrderHistoryTableProps) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Order</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-border">
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <p className="text-sm font-medium text-card-foreground">{row.item}</p>
                <p className="font-mono text-xs text-muted-foreground">#{row.id.slice(0, 8)}…</p>
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                {new Date(row.dateISO).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </TableCell>
              <TableCell>
                <Badge className={cn("font-normal", statusClass(row.status))}>
                  {formatStatus(row.status)}
                </Badge>
              </TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <CreditCard size={14} />
                  {formatMethod(row.method)}
                </span>
              </TableCell>
              <TableCell className="whitespace-nowrap text-right font-display text-base text-primary">
                ₹{row.amount}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
