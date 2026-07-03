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

// 3. Leading checkbox control + literal "Actions" header footer + base-`hidden`
//    (desktop-only) column skipped. Mirrors the dashboard "expiring members" table.
{
  const html = mobileMarkup(
    <ResponsiveTable stack>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10" />
            <TableHead>Member</TableHead>
            <TableHead className="hidden sm:table-cell">Package</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>
              <input type="checkbox" aria-label="Select Asha" />
            </TableCell>
            <TableCell>Asha Rao</TableCell>
            <TableCell className="hidden sm:table-cell">Studio Unlimited</TableCell>
            <TableCell>3 days</TableCell>
            <TableCell>
              <button>View</button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </ResponsiveTable>,
  );
  assert(html.includes("Asha Rao"), "name is the card title");
  assert(html.includes('aria-label="Select Asha"'), "checkbox control kept");
  assert(html.includes("3 days"), "expires value kept");
  assert(html.includes("View"), "actions rendered");
  // "Actions" is a footer, not a field label.
  assert(!/>Actions<\/dt>/i.test(html), "Actions column is not a field label");
  // Desktop-only (base `hidden`) Package column is dropped from the card.
  assert(!html.includes("Studio Unlimited"), "hidden sm:table-cell column skipped on mobile");
  assert(!/>Member<\/dt>/i.test(html), "title column header not shown as a label");
}

// 4. Unlabelled middle column renders value-only (never dropped).
{
  const html = mobileMarkup(
    <ResponsiveTable stack>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead />
            <TableHead>Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Widget</TableCell>
            <TableCell>MIDDLE-NOLABEL</TableCell>
            <TableCell>42</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </ResponsiveTable>,
  );
  assert(html.includes("MIDDLE-NOLABEL"), "unlabelled middle column value not dropped");
  assert(html.includes("42"), "labelled column value kept");
}

console.log("OK: stack-table introspection");
