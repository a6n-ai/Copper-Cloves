// Public marketing site = everything that is NOT an authenticated dashboard.
// Page transitions + the route progress bar/skeleton apply only here; the
// admin/portal/partner/instructor shells keep their own chrome + loading states.
const DASHBOARD_RE = /^\/(admin|portal|partner|instructor|account)(?:\/|$)/;

export function isPublicSite(pathname: string): boolean {
  return !DASHBOARD_RE.test(pathname);
}

import type { NavigationVariant } from "@/components/Navigation";

// Public routes that render the shared marketing <Navigation>, keyed by the
// Next.js route pattern (`router.pathname`, so dynamic routes use `[id]`).
// The nav is hoisted to _app and stays mounted across these routes — only the
// page body below it transitions. Routes absent here render no nav (login,
// signup, meal-subscription, checkin, 404).
export const PUBLIC_NAV_ROUTES: Record<string, NavigationVariant> = {
  "/": "overlay",
  "/classes": "default",
  "/cafe": "default",
  "/shop": "default",
  "/shop/[id]": "default",
  "/rental": "default",
  "/story": "default",
  "/instructors": "default",
  "/pricing": "default",
  "/policy": "default",
  "/terms": "default",
};
