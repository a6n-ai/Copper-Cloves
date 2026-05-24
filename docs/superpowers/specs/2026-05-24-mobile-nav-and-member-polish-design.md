# Universal Mobile Bottom Nav + Member Component Polish — Design

**Date:** 2026-05-24
**Status:** Approved (design)
**Topic:** Make the mobile bottom navigation config-driven and apply it to all portals (member, admin, partner, instructor) with a "More" menu for items that don't fit; deep-polish the member portal pages for mobile (packages first).

## Decisions (locked)

| Decision | Choice |
|---|---|
| Bottom nav scope | All portals (member, admin, partner, instructor), config-driven |
| Overflow items | A "More" tab opens a bottom Sheet listing every nav item, grouped by section |
| Member bottom bar | Keep 5 tabs: Home·Book·Bookings·Café·More (Packages + Profile live in More) |
| Admin bottom bar | Dashboard·Schedule·Members·CRM·More |
| Partner bottom bar | Dashboard·Classes·Members·Settings (4 items → no More) |
| Instructor | Only Dashboard → no bottom bar (uses header) |
| Hamburger on phones | Hidden — bottom bar + More is the sole mobile nav |
| Member polish scope | All member pages; `/portal/packages` first |

## Context

- Nav source of truth: `src/components/dashboard/dashboardNav.ts` — `PORTALS[kind]` with `sections: NavSection[]` (`{ label, items: { href, label, icon }[] }`).
- `src/components/dashboard/DashboardShell.tsx` renders the sidebar (desktop) / Sheet (mobile via `ui/sidebar`), a header with `SidebarTrigger` (line ~257) + avatar dropdown (Profile/logout live here too), and currently `<MobileBottomNav />` only when `config.kind === "member"` with `pb-20 md:pb-0` clearance.
- `src/components/responsive/MobileBottomNav.tsx` — currently a hardcoded 5-item member bar.
- Member nav (6): Dashboard, Book Class, My Bookings, Packages, Café, Profile. Admin (9), Partner (4), Instructor (1).
- `useIsMobile` (`@/hooks/use-mobile`) → `md` (768px) breakpoint.

## Part A — Config-driven mobile bottom nav (all portals)

### A1. Nav config additions (`dashboardNav.ts`)
Add `mobilePrimary: string[]` (≤4 hrefs) to each `PortalConfig`:
- member: `["/portal/dashboard","/portal/book","/portal/bookings","/portal/menu"]`
- admin: `["/admin/dashboard","/admin/schedule","/admin/members","/admin/CRM"]`
- partner: `["/partner/dashboard","/partner/classes","/partner/members","/partner/settings"]`
- instructor: `["/instructor/dashboard"]`

Helper: a `flattenNavItems(config)` returning all `{href,label,icon}` across sections (for the More sheet + lookups).

### A2. `MobileBottomNav` (rewritten, config-driven)
- Props: `config: PortalConfig` (the active portal's config).
- Compute `allItems = flattenNavItems(config)`; `primary = allItems filtered/ordered by config.mobilePrimary` (max 4); `overflow = allItems not in primary`.
- Render:
  - If `allItems.length <= 1` → render nothing (instructor).
  - Else show a fixed bottom bar (`md:hidden`, safe-area padding) with the `primary` tabs; if `overflow.length > 0`, append a **More** tab (icon `Menu`/`MoreHorizontal`).
  - Active tab: `router.pathname === href`. More is "active" when current route is in `overflow` (not a primary tab).
- **More** opens a bottom `Sheet` (`side="bottom"`, `max-h-[80dvh]`, scroll) titled "Menu", listing **all** items grouped by `config.sections` (section label + items with icons), each a `Link` that closes the sheet on navigate. Current route highlighted.
- One source of truth: bar + More + desktop sidebar all derive from `dashboardNav`.

### A3. Shell integration (`DashboardShell.tsx`)
- Render `<MobileBottomNav config={config} />` for **all** portals (remove the `kind === "member"` gate). The component self-suppresses when there's nothing to show (instructor).
- Apply bottom clearance to the main content for all portals on mobile: `pb-20 md:pb-0` (only meaningful when a bar renders; harmless otherwise — or gate on `allItems.length > 1`).
- Hide the header `SidebarTrigger` on phones: add `hidden md:inline-flex` (keep on desktop where it collapses the sidebar). The mobile Sheet from `ui/sidebar` is no longer the mobile nav.

## Part B — Member page mobile polish

Beyond the shipped overflow pass, improve touch ergonomics and layout on phones; **desktop (`md+`) unchanged**. Use existing primitives (`Container`, `ResponsiveDialog`, `ResponsiveTable`) + responsive Tailwind.

Priority order:
1. **`/portal/packages`** (pay packages) — pass cards stack full-width on phones; price + "Buy/Pay" CTAs are full-width, ≥44px tall; benefits list readable; remove cramped multi-column rows; ensure the checkout modal is usable on phones.
2. `/portal/dashboard` — stat cards/grids stack cleanly; charts/`PathToMastery` scroll rather than overflow; comfortable spacing.
3. `/portal/book` — class list/filters; booking panel as a usable mobile sheet; week scroller already done.
4. `/portal/bookings` — booking cards stack; actions reachable.
5. `/portal/menu` — café items grid + cart/checkout panel on phones.
6. `/portal/profile` — form sections + avatar; comfortable spacing.

Each page: verify no horizontal overflow at 320/390/414/768; tap targets ≥44px; primary actions full-width on phones.

## Out of scope
- Deep component polish of admin/partner/instructor *pages* (they got the overflow pass; only the nav view changes here).
- Backend/API changes.
- Editing `src/components/ui/*`.

## Risks / notes
- `next build` must not run while `next dev` is live (corrupts `.next`); verify via dev compile or stop/build/restart.
- Instructor portal has 1 item — `MobileBottomNav` must render nothing for it (no 1-tab bar).
- Profile is reachable via header avatar dropdown + the More sheet, so it need not be a member bottom tab.
