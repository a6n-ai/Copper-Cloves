import * as React from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * Default: horizontal-scroll wrapper with a subtle both-edge fade on phones.
 * The fade is a `mask-image` on the scroll container (fades the content itself
 * to transparent) — NOT a coloured overlay. A colour overlay (the old
 * `from-card` gradient) picks up the theme's card token and reads as a dirty
 * black smear in dark mode / over coloured cells; a mask is theme-agnostic.
 * Disabled at md+ where tables fit without scrolling. `-webkit-mask-image` is
 * required for iOS Safari, the main place this shows.
 */
const EDGE_FADE =
  "[mask-image:linear-gradient(to_right,transparent,#000_16px,#000_calc(100%-16px),transparent)] " +
  "[-webkit-mask-image:linear-gradient(to_right,transparent,#000_16px,#000_calc(100%-16px),transparent)] " +
  "md:[mask-image:none] md:[-webkit-mask-image:none]";

/**
 * `stack` mode: the SAME `<Table>` renders as a real table at md+ and as a stack
 * of label/value cards under md — no horizontal scroll on phones. The card view
 * is derived by introspecting the same table markup: each `<TableHead>`'s text
 * becomes a field label, its aligned `<TableCell>` the value. Callers flip ONE
 * prop (`<ResponsiveTable stack>`); sorting/paging live outside the table, so
 * both views share them untouched.
 *
 * ponytail: introspection assumes positional header↔cell alignment (the shadcn
 * convention every table here already follows). It does NOT understand a
 * mid-table `colSpan` merge; the only colSpan in practice is the single-cell
 * empty-state row, which is special-cased. A table needing a genuine multi-column
 * merge on mobile should get a bespoke card view (ResponsiveCards) instead.
 */
export function ResponsiveTable({
  className,
  children,
  stack,
}: {
  className?: string;
  children: React.ReactNode;
  stack?: boolean;
}) {
  if (!stack) {
    return (
      <div className={cn("w-full overflow-x-auto [-webkit-overflow-scrolling:touch]", EDGE_FADE, className)}>
        {children}
      </div>
    );
  }

  const tableEl = findElement(children, Table);
  const cards = tableEl ? renderStackCards(tableEl) : null;

  return (
    <>
      {/* Phone: derived card stack. Falls back to a scroll table if the child
          isn't a recognisable <Table> (introspection found no rows). */}
      <div className="md:hidden">
        {cards ?? (
          <div className={cn("w-full overflow-x-auto [-webkit-overflow-scrolling:touch]", EDGE_FADE, className)}>
            {children}
          </div>
        )}
      </div>
      {/* md+: the untouched real table. */}
      <div className={cn("hidden md:block", className)}>{children}</div>
    </>
  );
}

/** Flatten a node tree to visible text (labels live inside <TableHead>/SortableHeader). */
function nodeText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (React.isValidElement(node)) return nodeText((node.props as { children?: React.ReactNode }).children);
  return "";
}

/** First descendant element (depth-first over direct children) whose type matches. */
function findElement(children: React.ReactNode, type: React.ElementType): React.ReactElement | null {
  for (const child of React.Children.toArray(children)) {
    if (!React.isValidElement(child)) continue;
    if (child.type === type) return child;
    const nested = findElement((child.props as { children?: React.ReactNode }).children, type);
    if (nested) return nested;
  }
  return null;
}

function elementChildren(el: React.ReactElement | null, type: React.ElementType): React.ReactElement[] {
  if (!el) return [];
  return React.Children.toArray((el.props as { children?: React.ReactNode }).children).filter(
    (c): c is React.ReactElement => React.isValidElement(c) && c.type === type,
  );
}

function renderStackCards(tableEl: React.ReactElement): React.ReactNode {
  const sections = React.Children.toArray((tableEl.props as { children?: React.ReactNode }).children);
  const header = sections.find(
    (c): c is React.ReactElement => React.isValidElement(c) && c.type === TableHeader,
  );
  const bodyEl = sections.find(
    (c): c is React.ReactElement => React.isValidElement(c) && c.type === TableBody,
  );
  if (!bodyEl) return null;

  const headRow = elementChildren(header ?? null, TableRow)[0] ?? null;
  const labels = headRow
    ? React.Children.toArray((headRow.props as { children?: React.ReactNode }).children)
        .filter(React.isValidElement)
        .map(nodeText)
    : [];

  const rows = elementChildren(bodyEl, TableRow);
  if (rows.length === 0) return null;

  return (
    <div className="space-y-3">
      {rows.map((row, ri) => {
        const rowProps = row.props as {
          children?: React.ReactNode;
          onClick?: React.MouseEventHandler;
        };
        const cells = React.Children.toArray(rowProps.children).filter(
          (c): c is React.ReactElement => React.isValidElement(c) && c.type === TableCell,
        );

        // Empty-state / full-width row: one cell spanning the table. Render its
        // content plainly inside a single card, no label/value split.
        if (cells.length === 1 && (cells[0].props as { colSpan?: number }).colSpan) {
          return (
            <div key={row.key ?? ri} className="rounded-lg border border-border bg-card p-4">
              {(cells[0].props as { children?: React.ReactNode }).children}
            </div>
          );
        }

        // First cell = card title (identity column, no label). A trailing
        // label-less cell (sr-only "Actions") = footer. Everything between with a
        // label = a label/value row.
        const fields = cells.map((cell, i) => ({
          label: (labels[i] ?? "").trim(),
          value: (cell.props as { children?: React.ReactNode }).children,
        }));
        const title = fields[0];
        const actions =
          fields.length > 1 && fields[fields.length - 1].label === "" ? fields[fields.length - 1] : null;
        const detailFields = fields
          .slice(1, actions ? fields.length - 1 : fields.length)
          .filter((f) => f.label !== "");

        const clickable = typeof rowProps.onClick === "function";
        return (
          <div
            key={row.key ?? ri}
            onClick={rowProps.onClick}
            className={cn(
              "rounded-lg border border-border bg-card p-4 transition-colors",
              clickable && "cursor-pointer active:bg-muted/60",
            )}
          >
            {title && <div className="min-w-0">{title.value}</div>}
            {detailFields.length > 0 && (
              <dl className="mt-3 space-y-2 border-t border-border/60 pt-3">
                {detailFields.map((f, i) => (
                  <div key={i} className="flex items-start justify-between gap-3">
                    <dt className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {f.label}
                    </dt>
                    <dd className="min-w-0 text-right text-sm text-foreground">{f.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {actions && (
              <div
                className="mt-3 flex justify-end border-t border-border/60 pt-3"
                onClick={(e) => e.stopPropagation()}
              >
                {actions.value}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Card-stack: render rows as cards under md, real table at md+. Use only where flagged. */
export function ResponsiveCards<T>({
  data,
  renderCard,
  renderTable,
}: {
  data: T[];
  renderCard: (row: T, i: number) => React.ReactNode;
  renderTable: () => React.ReactNode;
}) {
  return (
    <>
      <div className="space-y-3 md:hidden">{data.map(renderCard)}</div>
      <div className="hidden md:block">{renderTable()}</div>
    </>
  );
}
