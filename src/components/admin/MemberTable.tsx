import type { ReactNode } from "react";
import { Trophy, Infinity as InfinityIcon } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import { ListAvatar } from "@/components/admin/ListAvatar";
import { SortableHeader } from "@/components/admin/sortable-table";
import { Pill } from "@/components/ui/pill";
import { passTypePill, memberStatusPill } from "@/lib/pillMaps";
import { cn } from "@/lib/utils";

export interface MemberTableMember {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  /** e.g. package name */
  passLabel?: string;
  passCategory?: "studio_pass" | "class_pass" | "none";
  unlimited?: boolean;
  credits?: number | null;
  totalClasses?: number;
  lastVisit?: string;
  status?: "active" | "expiring" | "expired";
  /** Active / Lapsed / Grace display text */
  accountLabel?: string;
  cafeDiscountPct?: number;
}

export type MemberColumnKey =
  | "member"
  | "contact"
  | "email"
  | "pass"
  | "account"
  | "classes"
  | "lastVisit"
  | "status"
  | "cafeDiscount";

export interface MemberTableSort {
  sortKey: string | null;
  sortDir: "asc" | "desc";
  onToggle: (key: string) => void;
  /** Which columns are sortable (by their sort-key string). */
  sortableKeys?: string[];
}

export interface MemberTableProps<T extends MemberTableMember = MemberTableMember> {
  members: T[];
  /** Column order; "member" should be first. */
  columns: MemberColumnKey[];
  sort?: MemberTableSort;
  onRowClick?: (m: T) => void;
  /** Adds a right-aligned Actions column when provided. */
  renderActions?: (m: T) => ReactNode;
  emptyState?: ReactNode;
  caption?: string;
}

function capitalize(s: string): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface ColumnDef {
  header: string;
  /** Sort-key string this column maps to (for SortableHeader). */
  sortKey?: string;
  headClassName?: string;
  cell: (m: MemberTableMember) => ReactNode;
}

const COLUMN_REGISTRY: Record<MemberColumnKey, ColumnDef> = {
  member: {
    header: "Member",
    sortKey: "name",
    cell: (m) => (
      <div className="flex items-center gap-3 min-w-0">
        <ListAvatar name={m.name} src={m.avatarUrl} size="md" />
        <div className="min-w-0">
          <div className="font-body font-medium text-charcoal truncate">{m.name}</div>
          <div className="font-body text-xs text-charcoal/60 truncate">{m.email}</div>
        </div>
      </div>
    ),
  },
  contact: {
    header: "Contact",
    cell: (m) => (
      <div className="min-w-0">
        <div className="font-body text-sm text-charcoal truncate">{m.phone || "—"}</div>
        <div className="font-body text-xs text-charcoal/60 truncate">{m.email}</div>
      </div>
    ),
  },
  email: {
    header: "Email",
    cell: (m) => <span className="font-body text-sm text-charcoal/60">{m.email}</span>,
  },
  pass: {
    header: "Pass",
    sortKey: "pass",
    headClassName: "w-[180px]",
    cell: (m) => {
      const isStudio = m.passCategory === "studio_pass";
      const isClass = m.passCategory === "class_pass";
      const isUnlimited = !!m.unlimited && !isStudio;
      const kind = isStudio
        ? "studio"
        : isClass
          ? "class"
          : isUnlimited
            ? "unlimited"
            : "none";
      const label = isStudio
        ? "Studio Pass"
        : isClass
          ? "Class Pass"
          : isUnlimited
            ? "Unlimited"
            : "No pass";
      // Studio pass = unlimited classes → infinity icon. Standalone unlimited too.
      const icon =
        isStudio || isUnlimited ? (
          <InfinityIcon className="h-3.5 w-3.5" />
        ) : undefined;
      return (
        <Pill {...passTypePill(kind)} icon={icon} className="font-body">
          {label}
        </Pill>
      );
    },
  },
  account: {
    header: "Account",
    sortKey: "account",
    headClassName: "w-[100px]",
    cell: (m) => (
      <span className="font-body text-sm text-charcoal/70">{m.accountLabel ?? "—"}</span>
    ),
  },
  classes: {
    header: "Classes",
    sortKey: "classes",
    headClassName: "w-[100px] text-right",
    cell: (m) => (
      <div className="flex items-center justify-end gap-1.5">
        <Trophy className="h-3.5 w-3.5 text-sage/60" />
        <span className="font-body font-medium text-charcoal tabular-nums">
          {m.totalClasses ?? 0}
        </span>
      </div>
    ),
  },
  lastVisit: {
    header: "Last Visit",
    sortKey: "lastVisit",
    headClassName: "w-[120px]",
    cell: (m) => <span className="font-body text-sm text-charcoal/70">{m.lastVisit ?? "—"}</span>,
  },
  status: {
    header: "Status",
    sortKey: "status",
    headClassName: "w-[140px]",
    cell: (m) => (
      <Pill {...memberStatusPill(m.status ?? "")} className="whitespace-nowrap font-body">
        {m.status ? capitalize(m.status) : "—"}
      </Pill>
    ),
  },
  cafeDiscount: {
    header: "Café discount",
    headClassName: "text-right",
    cell: (m) =>
      m.cafeDiscountPct ? (
        <div className="flex justify-end">
          <Pill tone="warning" className="font-body">
            {m.cafeDiscountPct}%
          </Pill>
        </div>
      ) : (
        <span className="block text-right font-body text-sm text-charcoal/40">—</span>
      ),
  },
};

export function MemberTable<T extends MemberTableMember = MemberTableMember>({
  members,
  columns,
  sort,
  onRowClick,
  renderActions,
  emptyState,
  caption,
}: MemberTableProps<T>) {
  const colSpan = columns.length + (renderActions ? 1 : 0);

  return (
    <ResponsiveTable>
      <Table>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <TableHeader>
          <TableRow>
            {columns.map((key) => {
              const def = COLUMN_REGISTRY[key];
              const isSortable =
                sort && def.sortKey && (sort.sortableKeys?.includes(def.sortKey) ?? false);
              if (isSortable && sort && def.sortKey) {
                return (
                  <SortableHeader
                    key={key}
                    sortKey={def.sortKey}
                    active={sort.sortKey}
                    dir={sort.sortDir}
                    onToggle={sort.onToggle}
                    className={def.headClassName}
                  >
                    {def.header}
                  </SortableHeader>
                );
              }
              return (
                <TableHead key={key} className={def.headClassName}>
                  {def.header}
                </TableHead>
              );
            })}
            {renderActions ? (
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.length === 0 ? (
            <TableRow>
              <TableCell colSpan={colSpan} className="py-10 text-center font-body text-charcoal/50">
                {emptyState ?? "No members found."}
              </TableCell>
            </TableRow>
          ) : (
            members.map((m) => (
              <TableRow
                key={m.id}
                onClick={onRowClick ? () => onRowClick(m) : undefined}
                className={cn(onRowClick && "cursor-pointer")}
              >
                {columns.map((key) => {
                  const def = COLUMN_REGISTRY[key];
                  return (
                    <TableCell key={key} className={def.headClassName}>
                      {def.cell(m)}
                    </TableCell>
                  );
                })}
                {renderActions ? (
                  <TableCell
                    className="text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {renderActions(m)}
                  </TableCell>
                ) : null}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </ResponsiveTable>
  );
}

export default MemberTable;
