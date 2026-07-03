import type { ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import { MobileSortControl } from "@/components/responsive/MobileSortControl";
import { ListAvatar } from "@/components/admin/ListAvatar";
import { SortableHeader } from "@/components/admin/sortable-table";
import { Pill } from "@/components/ui/pill";
import { cn } from "@/lib/utils";

export interface InstructorTableInstructor {
  id: string;
  name: string;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  imageUrl?: string | null;
  specialties?: string[];
  isActive?: boolean;
}

export type InstructorColumnKey = "instructor" | "contact" | "specialties" | "status";

export interface InstructorTableSort {
  sortKey: string | null;
  sortDir: "asc" | "desc";
  onToggle: (key: string) => void;
  /** Which columns are sortable (by their column key). */
  sortableKeys?: InstructorColumnKey[];
}

export interface InstructorTableProps<
  T extends InstructorTableInstructor = InstructorTableInstructor,
> {
  instructors: T[];
  /** Column order; "instructor" should be first. */
  columns: InstructorColumnKey[];
  sort?: InstructorTableSort;
  onRowClick?: (i: T) => void;
  /** Adds a right-aligned Actions column when provided. */
  renderActions?: (i: T) => ReactNode;
  emptyState?: ReactNode;
  caption?: string;
}

interface ColumnDef {
  header: string;
  /** Sort-key string this column maps to (for SortableHeader). */
  sortKey?: string;
  headClassName?: string;
  cell: (i: InstructorTableInstructor) => ReactNode;
}

const COLUMN_REGISTRY: Record<InstructorColumnKey, ColumnDef> = {
  instructor: {
    header: "Instructor",
    sortKey: "name",
    cell: (i) => (
      <div className="flex items-center gap-3 min-w-0">
        <ListAvatar name={i.name} src={i.imageUrl} size="md" ringClassName="ring-sage/20" />
        <div className="min-w-0">
          <div className="font-body font-medium text-charcoal truncate">{i.name}</div>
          {i.title ? (
            <div className="font-body text-xs text-charcoal/60 truncate">{i.title}</div>
          ) : null}
        </div>
      </div>
    ),
  },
  contact: {
    header: "Contact",
    cell: (i) => (
      <div className="min-w-0">
        <div className="font-body text-sm text-charcoal truncate">{i.email || "—"}</div>
        <div className="font-body text-xs text-charcoal/60 truncate">{i.phone || "—"}</div>
      </div>
    ),
  },
  specialties: {
    header: "Specialties",
    sortKey: "specialties",
    headClassName: "hidden md:table-cell w-[180px]",
    cell: (i) => {
      const specs = i.specialties ?? [];
      if (specs.length === 0) {
        return <span className="font-body text-sm text-charcoal/40">—</span>;
      }
      return (
        <div className="flex items-center gap-1 max-w-[180px]">
          <Pill tone="success" size="sm" className="font-body truncate max-w-[120px]">
            {specs[0]}
          </Pill>
          {specs.length > 1 ? (
            <Pill
              tone="neutral"
              size="sm"
              className="shrink-0 font-body text-charcoal/50"
              title={specs.slice(1).join(", ")}
            >
              +{specs.length - 1}
            </Pill>
          ) : null}
        </div>
      );
    },
  },
  status: {
    header: "Status",
    sortKey: "status",
    headClassName: "w-[110px]",
    cell: (i) => {
      const active = i.isActive !== false;
      return (
        <Pill tone={active ? "success" : "danger"}>{active ? "Active" : "Inactive"}</Pill>
      );
    },
  },
};

export function InstructorTable<
  T extends InstructorTableInstructor = InstructorTableInstructor,
>({
  instructors,
  columns,
  sort,
  onRowClick,
  renderActions,
  emptyState,
  caption,
}: InstructorTableProps<T>) {
  const colSpan = columns.length + (renderActions ? 1 : 0);
  const sortOptions =
    sort?.sortableKeys?.length
      ? columns
          .filter((key) => sort.sortableKeys?.includes(key) && COLUMN_REGISTRY[key].sortKey)
          .map((key) => ({ value: COLUMN_REGISTRY[key].sortKey as string, label: COLUMN_REGISTRY[key].header }))
      : [];

  return (
    <>
      {sort && sortOptions.length > 0 && (
        <MobileSortControl
          className="mb-3"
          options={sortOptions}
          activeKey={sort.sortKey}
          dir={sort.sortDir}
          onToggle={sort.onToggle}
        />
      )}
    <ResponsiveTable stack>
      <Table>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <TableHeader>
          <TableRow>
            {columns.map((key) => {
              const def = COLUMN_REGISTRY[key];
              const isSortable =
                sort && def.sortKey && (sort.sortableKeys?.includes(key) ?? false);
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
          {instructors.length === 0 ? (
            <TableRow>
              <TableCell colSpan={colSpan} className="py-10 text-center font-body text-charcoal/50">
                {emptyState ?? "No instructors found."}
              </TableCell>
            </TableRow>
          ) : (
            instructors.map((i) => (
              <TableRow
                key={i.id}
                onClick={onRowClick ? () => onRowClick(i) : undefined}
                className={cn(onRowClick && "cursor-pointer")}
              >
                {columns.map((key) => {
                  const def = COLUMN_REGISTRY[key];
                  return (
                    <TableCell key={key} className={def.headClassName}>
                      {def.cell(i)}
                    </TableCell>
                  );
                })}
                {renderActions ? (
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    {renderActions(i)}
                  </TableCell>
                ) : null}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </ResponsiveTable>
    </>
  );
}

export default InstructorTable;
