# Mobile-Friendly Site Pass — Design

**Date:** 2026-05-24
**Status:** Approved (design); spec under review
**Topic:** Make the entire Copper & Cloves site mobile-friendly (phones + tablets) using a primitive-first approach, leaning on shadcn-space components where they pay off.

## Goal

Every page works well on phones (320–430px) and tablets (768px): no horizontal overflow, readable type, tappable targets, usable dialogs/tables/calendars. Plus targeted visual polish using shadcn-space components — not a full redesign.

## Decisions (locked)

| Decision | Choice |
|---|---|
| Scope | Everything, one effort (public + member + admin + partner + instructor), phased for review |
| Depth | Responsive fixes **+** shadcn-space polish (not heavy redesign) |
| Devices | Phones **and** tablets (320 → 768+) |
| Approach | **A — Primitive-first**: build shared mobile primitives, then sweep pages |
| Member portal nav | Add app-style **bottom tab bar** on phones; drawer kept for admin/partner/instructor |
| Tables | **Horizontal scroll** wrapper by default; card-stack only where it clearly helps |
| Verification | **Playwright** responsive tests; add a seed/login fixture for auth'd pages |

## Context (current state)

- **Tailwind v4** — config in `@theme` inside `src/styles/globals.css` (no JS config). Palette: sage/sand/cream/charcoal/terracotta. Fonts: Bricolage Grotesque, Playfair Display, Montserrat.
- **Public pages** use `src/components/Navigation.tsx` — already has a hamburger mobile menu.
- **Portals** (member/admin/partner/instructor) share `src/components/dashboard/DashboardShell.tsx` built on `src/components/ui/sidebar.tsx`, which ships `useIsMobile` + an auto Sheet drawer. Old per-role nav components were deleted.
- **shadcn-space** MCP available: ~150 components + many blocks. Already vendored under `src/components/shadcn-space/blocks/`: `statistics-01`, `table-01`, `chart-01`, `widget-01`.
- `src/components/ui/` is shadcn-generated — **do not edit directly** (project convention). New primitives live in a new folder.

### Audited mobile offenders (grounding)

- **Wide tables, no mobile treatment:** `partner/members.tsx`, `admin/members.tsx`, `admin/products.tsx`, `portal/packages.tsx`, `admin/dashboard.tsx`, `components/admin/DayScheduleList.tsx`, `components/dashboard/OrderHistoryTable.tsx`.
- **Non-responsive `grid-cols-*`:** `partner/classes.tsx` (`grid-cols-7` calendar), `portal/book.tsx` (`grid-cols-7`), `instructor/dashboard.tsx` (`grid-cols-3`), `admin/members.tsx` (`grid-cols-4`), `admin/dashboard.tsx` (`grid-cols-3`), `portal/onboarding.tsx`, `founder.tsx`.
- **Fixed px widths:** `w-[180px]`/`w-[280px]` selects (`classes.tsx`), `min-w-[520px]` (`PathToMastery.tsx`), `w-[380px]` popover (`DashboardShell.tsx`), table head widths (`members.tsx`, `DayScheduleList.tsx`).
- **Dialog overload:** `admin/dashboard.tsx` (17 `DialogContent`), `admin/control.tsx` (15), `admin/members.tsx` (7), `admin/schedule.tsx` (5) — phones need full-width + scrollable dialogs.

## Architecture — Shared primitives

New folder: `src/components/responsive/`. Each primitive has one clear job and a drop-in-ish interface so call-sites change minimally.

### `ResponsiveDialog`
- **Does:** Renders a shadcn `Dialog` on `md+`; on phone renders a bottom `Sheet`/Drawer with `max-h-[90dvh]` internal scroll and safe-area padding.
- **Interface:** Same surface as `Dialog` + `DialogContent` (`open`, `onOpenChange`, header/footer slots). Sub-parts `ResponsiveDialogContent/Header/Footer/Title` mirror shadcn names so swaps are mechanical.
- **Depends on:** `ui/dialog`, `ui/sheet`, `useIsMobile`.
- **Payoff:** Fixes 40+ dialog call-sites by import swap rather than per-dialog rewrite.

### `ResponsiveTable` + `DataCards`
- **Does:** Wraps a table in `overflow-x-auto` with an edge fade and momentum scroll. Optional `renderCard` render-prop stacks rows as cards under `md` (used only where flagged useful).
- **Interface:** `<ResponsiveTable>{table}</ResponsiveTable>` for scroll mode; `<ResponsiveTable data renderCard renderTable>` for card-stack mode.
- **Depends on:** `ui/table`, shadcn-space `table-01` patterns, `useIsMobile`.

### `MobileBottomNav`
- **Does:** Fixed bottom tab bar for the **member portal** on phones — Dashboard / Book / Bookings / Menu / Profile (5 destinations). Hidden at `md+`. Active state from router path.
- **Interface:** Self-contained; rendered by `DashboardShell` only when `role === "user"` and mobile.
- **Depends on:** shadcn-space `apple-dock` (restyled to palette), `next/router`, `useIsMobile`.

### `Container`
- **Does:** Consistent horizontal padding + max width (`px-4 sm:px-6 lg:px-8`, `max-w-*`) so pages stop hand-rolling spacing.
- **Interface:** `<Container size="default|wide|narrow">`.

## Shell changes

- **`DashboardShell`:**
  - Render `<MobileBottomNav>` when `role === "user"` and phone; add `pb-[calc(env(safe-area-inset-bottom)+4rem)]` to main content so it clears the bar.
  - Popover `w-[380px]` → `w-[min(380px,calc(100vw-2rem))]`.
  - Confirm header actions collapse gracefully (RoleSwitcher/Badge already `hidden sm:`/`hidden lg:`).
- **`Navigation` (public):** Already has hamburger. Audit touch-target sizes (≥44px), ensure menu closes on route change, verify no overflow of the expanded menu.

## Calendars (highest risk)

`partner/classes.tsx` and `portal/book.tsx` use `grid-cols-7` week grids that overflow phones.
- **Phone:** horizontal **day-scroller** (snap, one day at a time) OR single-day list with a day-picker; keep the 7-column grid at `md+`.
- Pick the lighter-touch option per page during implementation; both keep desktop unchanged.

## Page sweep (each group = one plan phase)

For every page: replace non-responsive `grid-cols-*` with responsive variants; remove/relax fixed px widths; adopt `ResponsiveDialog` / `ResponsiveTable`; wrap content in `Container`; verify no horizontal overflow at 320/375/414/768.

1. **Primitives + shell** (foundation)
2. **Calendars** (partner/classes, portal/book)
3. **Public:** index, classes, cafe, shop, shop/[id], rental, founder, policy, terms, meal-subscription, login, signup, checkin
4. **Member portal:** dashboard, book, bookings, packages, profile, menu, onboarding
5. **Admin:** dashboard (largest — 4400+ lines), members, schedule, products, CRM, control, cafe, badges, credits, partners, + remaining
6. **Partner:** dashboard, classes, settings, members
7. **Instructor:** dashboard
8. **Playwright tests** (can be written alongside each group; finalized last)

## shadcn-space component usage

| Need | shadcn-space source |
|---|---|
| Member bottom nav | `apple-dock-01/02` |
| Mobile table cards | `table-01` |
| Dialog/drawer variants | `dialog-02` (bottom), `ui/sheet` |
| Stacked mobile cards | `card-*` variants |
| Mobile galleries | `carousel-*` (cafe/shop already use scroll-snap) |
| Loading states | `skeleton-*`, `spinner-*` |

Install via the shadcn-space MCP (`getBlockInstall`) into `src/components/shadcn-space/`; restyle to palette before wiring.

## Verification — Playwright

- Add `@playwright/test` + `playwright.config.ts`. Projects/viewports: **320, 375, 414** (phone), **768** (tablet).
- **Auth fixture:** seed a test member + test admin (reuse existing seed scripts / a dedicated test seed), perform a programmatic login, persist `storageState` per role; auth'd specs load that state.
- **Per key page, assert:**
  - No horizontal scroll: `document.documentElement.scrollWidth <= clientWidth` (allow ~1px tolerance).
  - Primary nav reachable (hamburger/drawer opens on portal; bottom nav visible on member phone).
  - Primary dialog opens fully within viewport (no clipped content).
- Run locally against `npm run dev:next`; document the command in `.llm/commands.md`.

## Out of scope

- Heavy visual redesign / new information architecture.
- Backend/API changes (except a test-only seed for Playwright).
- Editing `src/components/ui/` primitives directly.
- New features beyond responsiveness + polish.

## Risks / notes

- `next.config.mjs` silences TS/ESLint build errors — don't rely on the build to catch regressions; lean on Playwright + manual checks.
- `admin/dashboard.tsx` is very large; the `ResponsiveDialog`/`ResponsiveTable` swaps must be done carefully and verified page-by-page.
- Tailwind v4: any new design tokens go in `@theme` in `globals.css`, not a JS config.
- Git: per user preference, nothing is committed automatically — commits happen only on explicit request.