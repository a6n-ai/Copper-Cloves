import assert from "node:assert";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";

// Renders <ResponsiveTable stack> around a table and returns only the phone
// (md:hidden) card markup — the desktop copy is sliced off so assertions target
// the derived card view, not the untouched table.
function mobileMarkup(node: React.ReactElement): string {
  const html = renderToStaticMarkup(node);
  const cut = html.indexOf('class="hidden md:block');
  return cut === -1 ? html : html.slice(0, cut);
}

// 1. Label/value pairing + first-column-as-title + actions footer.
{
  const html = mobileMarkup(
    <ResponsiveTable stack>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Chai Latte</TableCell>
            <TableCell>Jul 3, 2026</TableCell>
            <TableCell>
              <button>Cancel</button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </ResponsiveTable>,
  );
  // First column becomes the card title (its header "Order" is NOT shown as a label).
  assert(html.includes("Chai Latte"), "title value rendered");
  assert(!/>Order<\/dt>/i.test(html), "first column header not shown as a field label");
  // Second column shows as a LABEL/value pair.
  assert(html.includes("Date"), "second column label rendered");
  assert(html.includes("Jul 3, 2026"), "second column value rendered");
  // Label-less trailing (Actions) cell → footer, not a label row.
  assert(html.includes("Cancel"), "actions rendered in footer");
}

// 2. Empty-state colSpan row renders once as a plain card (no label/value split).
{
  const html = mobileMarkup(
    <ResponsiveTable stack>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell colSpan={2}>No orders yet</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </ResponsiveTable>,
  );
  const matches = html.match(/No orders yet/g) ?? [];
  assert(matches.length === 1, `empty-state shown once in cards, got ${matches.length}`);
  assert(!/>Date<\/dt>/i.test(html), "no field labels emitted for empty-state row");
}

console.log("OK: stack-table introspection");
