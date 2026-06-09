import type { PortalKind } from "@/components/dashboard/dashboardNav";

/** A deep-linkable sub-section (tab) of a page, so global search can reach it. */
export interface InnerPage {
  label: string;
  href: string;
}

/**
 * Inner pages = tab sub-sections that live under a single route but are reachable via `?tab=`.
 * Kept here (not in nav) so the sidebar stays top-level while search can still jump to e.g. Ledger.
 * Each href must match a tab value handled by useTabQuery on the target page.
 */
export const INNER_PAGES: Partial<Record<PortalKind, InnerPage[]>> = {
  admin: [
    { label: "Finances · Transactions", href: "/admin/finances?tab=transactions" },
    { label: "Finances · Ledger", href: "/admin/finances?tab=ledger" },
    { label: "Finances · Reconcile", href: "/admin/finances?tab=reconcile" },
    { label: "Expenses · Expenses", href: "/admin/expenses?tab=expenses" },
    { label: "Expenses · Payouts", href: "/admin/expenses?tab=payouts" },
    { label: "CRM · Templates", href: "/admin/CRM?tab=templates" },
    { label: "CRM · Triggers", href: "/admin/CRM?tab=triggers" },
    { label: "Settings · Members", href: "/admin/control?tab=users" },
    { label: "Settings · Pauses", href: "/admin/control?tab=pauses" },
    { label: "Settings · Classes", href: "/admin/control?tab=classes" },
    { label: "Settings · Instructors", href: "/admin/control?tab=instructors" },
    { label: "Settings · Analytics", href: "/admin/control?tab=analytics" },
    { label: "Dashboard · Finance", href: "/admin/dashboard?tab=finance" },
    { label: "Dashboard · Pricing", href: "/admin/dashboard?tab=pricing" },
    { label: "Dashboard · Meal Waitlist", href: "/admin/dashboard?tab=meal-waitlist" },
    { label: "Dashboard · Rental Inquiries", href: "/admin/dashboard?tab=rental-inquiries" },
    { label: "Dashboard · Members", href: "/admin/dashboard?tab=members" },
    { label: "Dashboard · Instructors", href: "/admin/dashboard?tab=instructors" },
    { label: "Dashboard · Classes", href: "/admin/dashboard?tab=classes" },
  ],
};
