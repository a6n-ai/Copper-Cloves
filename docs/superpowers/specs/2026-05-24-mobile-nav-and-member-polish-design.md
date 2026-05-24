# App-Style Mobile Nav (center check-in scanner) + Member/Instructor Polish — Design

**Date:** 2026-05-24
**Status:** Approved (design)
**Topic:** Config-driven, app-style mobile bottom navigation for all portals with a raised center **Check-in Scanner** (member + instructor), a **More** sheet for overflow items, and app-like, minimal-scroll polish of member + instructor pages (packages first).

## Decisions (locked)

| Decision | Choice |
|---|---|
| Bottom nav | Config-driven from `dashboardNav`, all portals, app-style |
| Center scanner | Raised circular FAB opening `ScanCheckInModal` — **member + instructor only** |
| Overflow items | **More** tab → bottom Sheet listing all nav items grouped by section |
| Member bar | `Home · Book | ◉Scan | Bookings · More` (More: Café, Packages, Profile) |
| Admin bar | `Dashboard · Schedule · Members · CRM · More` (no scanner) |
| Partner bar | `Dashboard · Classes · Members · Settings` (4 → no More, no scanner) |
| Instructor bar | `Dashboard | ◉Scan` (no More) |
| Hamburger on phones | Hidden — bottom bar is the sole mobile nav |
| Polish | App-like, minimal scroll; member pages (packages first) + instructor dashboard |

## Context

- Nav source: `src/components/dashboard/dashboardNav.ts` → `PORTAL_CONFIGS[kind]` (`sections: NavSection[]`, each `{ label, items: { href, label, icon }[] }`).
- `DashboardShell.tsx`: sidebar (desktop) / Sheet (mobile), header with `SidebarTrigger` (~line 257) + avatar dropdown (Profile/logout), renders `<MobileBottomNav />` only for member with `pb-20 md:pb-0`.
- `MobileBottomNav.tsx`: hardcoded 5-item member bar (to be rewritten).
- Check-in: `CheckInScanButton` ("drop into any portal") + `ScanCheckInModal` (camera QR → `POST /api/checkin/scan`). The scan API handles `kind:"instructor"` (self check-in) and member (role `user`) check-in from session. No backend change needed.
- `useIsMobile` → `md` (768px).

## Part A — App-style config-driven bottom nav

### A1. `dashboardNav.ts` additions
Add to `PortalConfig`: `mobilePrimary: string[]` (side-tab hrefs) and `mobileScanner?: boolean`.
- member: `mobilePrimary: ["/portal/dashboard","/portal/book","/portal/bookings"]`, `mobileScanner: true`
- admin: `mobilePrimary: ["/admin/dashboard","/admin/schedule","/admin/members","/admin/CRM"]`
- partner: `mobilePrimary: ["/partner/dashboard","/partner/classes","/partner/members","/partner/settings"]`
- instructor: `mobilePrimary: ["/instructor/dashboard"]`, `mobileScanner: true`

Export helper `flattenNavItems(config): NavLink[]` (all items across sections).

### A2. `MobileBottomNav` (rewrite, config-driven)
Props: `{ config: PortalConfig }`.
- `all = flattenNavItems(config)`; `primary = config.mobilePrimary` resolved to `NavLink`s (skip missing); `overflow = all − primary`.
- `showMore = overflow.length > 0`; `showScanner = !!config.mobileScanner`.
- Render nothing if `all.length <= 1 && !showScanner` (defensive).
- **Slots** = `[...primary, ...(showMore ? [MoreSlot] : [])]`.
- **Layout** (`fixed bottom-0 inset-x-0 z-50 md:hidden`, safe-area bottom padding, blurred bg):
  - If `showScanner`: split slots into left/right halves; render `flex`: `[left slots] [center FAB] [right slots]`. The FAB is a raised circular button (`-translate-y-3`, shadow, sage/terracotta) with QR icon + "Check in" label below.
  - Else: even `grid` of slots (e.g. `grid-cols-{n}`).
- **Tab**: `Link`, icon + short label, active when `router.pathname === href` (terracotta) else muted.
- **More**: opens bottom `Sheet` ("Menu", `max-h-[80dvh]`, scroll) listing every section (label + items as `Link`s with icons), closing on navigate; active route highlighted. "More" tab itself active when current route ∈ overflow.
- **Scanner FAB**: local `open` state → `<ScanCheckInModal open onOpenChange />`.

### A3. `DashboardShell.tsx`
- Render `<MobileBottomNav config={config} />` for **all** portals (drop the member-only gate); component self-suppresses when empty.
- Main content bottom clearance on phones: `pb-24 md:pb-0` (taller to clear the raised FAB) when a bar shows.
- Hide header `SidebarTrigger` on phones: `hidden md:inline-flex`.

## Part B — App-like, minimal-scroll polish (member + instructor)

Principle: phone screens should feel like an app — content fits with minimal scrolling, card-based, comfortable density, primary actions full-width and ≥44px. Desktop (`md+`) unchanged. Use `Container`, `ResponsiveDialog`, `ResponsiveTable` + responsive Tailwind.

Priority:
1. **`/portal/packages`** — pass cards full-width stacked; price + CTA prominent, full-width, ≥44px; benefits compact; checkout modal usable on phones.
2. **`/portal/dashboard`** — compact stat cards, fit common content above the fold where feasible; charts/PathToMastery scroll, don't overflow.
3. **`/instructor/dashboard`** — app-like today/week + the center scanner is the primary action; compact cards.
4. `/portal/book`, `/portal/bookings`, `/portal/menu`, `/portal/profile` — comfortable spacing, stacked cards, full-width actions, no horizontal overflow at 320/390/414/768.

## Out of scope
- Deep polish of admin/partner *pages* (overflow pass already shipped; only their nav view changes).
- Backend/API/check-in logic changes.
- Editing `src/components/ui/*`.

## Risks / notes
- Don't run `next build` while `next dev` is live (corrupts `.next`); verify via dev compile or stop/build/restart.
- Center FAB overlaps content → main needs `pb-24` on phones.
- Instructor bar = 1 tab + scanner; layout must look intentional (Dashboard beside a centered Scan).
- Scanner uses camera (`@yudiel/react-qr-scanner`) — needs HTTPS/localhost + camera permission; existing modal already handles the unavailable case.
