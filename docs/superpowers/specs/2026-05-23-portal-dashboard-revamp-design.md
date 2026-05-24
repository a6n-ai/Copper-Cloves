# Member Portal Dashboard Revamp — Design

**Date:** 2026-05-23
**Status:** Approved design, pending spec review
**Scope of this spec:** Sub-project 0 (shared block foundation) + Sub-project 1 (`/portal/dashboard` revamp). Later portal pages are listed as follow-up specs, not built here.

## Goal

Rebuild the member dashboard (`src/pages/portal/dashboard.tsx`) to the same structural quality and component language as the admin dashboard, composed from **Shadcn Space blocks** wrapped as reusable, data-driven components. The wrappers are shared so the **admin dashboard can adopt them too**. The member-facing page keeps the warm Copper & Cloves brand palette (cream / sage / charcoal / terracotta).

## Key architectural insight

The shadcn semantic tokens in `src/styles/globals.css` are **already brand-mapped**:

- `--primary: 80 8% 47%` → sage
- `--accent: 17 47% 55%` → terracotta
- `--secondary: 43 24% 88%` → sand
- `--chart-1..5` → sage / terracotta / sand / green / tan

Therefore any installed Space block that uses semantic utilities (`bg-card`, `text-primary`, `text-muted-foreground`, `bg-accent`, chart token vars) renders **on-brand automatically in both admin and portal** with **no per-subtree theme scoping**. This is what makes "use the same blocks in admin as well" cheap. Wrappers must consume semantic tokens, never hardcode hex.

## Tailwind v4 note

This project is Tailwind v4 (CSS-first; no `tailwind.config.ts` despite `components.json` referencing one). Tokens live in `globals.css` `@theme` + `@layer utilities :root`.

### Pre-existing bug to fix as part of foundation

`cream` is **not** a defined color token, yet the portal uses `bg-cream` / `from-cream` widely — these currently resolve to nothing. The intended cream is `--color-sand` (`#e8e4d9`). Foundation adds:

```css
/* in @theme */
--color-cream: #f5f2ea;   /* confirm exact value against design; sand is the darker companion */
```

Then the portal's existing `bg-cream`/`from-cream` classes resolve correctly. (Do not retro-fix every page in this spec — just define the token so the dashboard renders as intended.)

## Block install mechanics

- Registry already configured in `components.json`: `"@shadcn-space": "https://shadcnspace.com/r/{name}.json"`.
- Install command per block: `npx shadcn@latest add @shadcn-space/<name>` (must be run as-is; blocks are not hand-recreated).
- Installed block source lands under `src/components/` (exact path confirmed on first install). Wrappers live in `src/components/dashboard/`.

## Blocks to install (candidates — final pick confirmed at install time)

| Purpose | Candidate block | Fallback |
|---|---|---|
| KPI / stat cards | `statistics-01` (KPI summary cards) | `statistics-06` |
| Activity timeline | `widget-05` (Activity Timeline) | — |
| Upcoming schedule | `widget-14` (Upcoming Schedule Management) | `widget-03` |
| Movement vitality area chart | `chart-03` (Area gradient) | `chart-07` |
| Order-history table | `table-05` (Transaction status table) | `table-02` |

If an installed block's structure proves a poor fit, fall back to the listed alternative or compose from existing `src/components/ui/*` primitives — never block a section on a single block.

## Component layer (`src/components/dashboard/`)

Each wrapper is a thin presentational component: typed props in, semantic-token styling, no data fetching inside. Built on the installed block's markup.

```ts
// StatCard.tsx — single KPI tile
interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  hint?: string;              // e.g. "Best: 12"
  tone?: "default" | "up" | "down" | "warn";
}

// StatCardRow.tsx — responsive grid of StatCard
interface StatCardRowProps { items: StatCardProps[] }

// ActivityTimeline.tsx
interface ActivityItem { id: string; text: string; date: string; icon?: LucideIcon }
interface ActivityTimelineProps { items: ActivityItem[]; emptyCta?: ReactNode }

// UpcomingScheduleCard.tsx
interface ScheduleEntry {
  id: string; title: string; subtitle?: string; whenISO?: string;
  imageUrl?: string; status?: "pending" | "confirmed"; onClick?: () => void;
}
interface UpcomingScheduleCardProps { entries: ScheduleEntry[] }

// VitalityAreaChart.tsx
interface VitalityAreaChartProps {
  series: number[];           // length 30, daily minutes
  totalMinutes: number; avgPerDay: number;
  vsLabel: string; vsTone: "up" | "down" | "neutral";
}

// OrderHistoryTable.tsx
interface OrderRow { id: string; item: string; dateISO: string; amount: number; status: string; method: string }
interface OrderHistoryTableProps { rows: OrderRow[] }
```

Wrappers are pure: the page maps existing fetched state into these props. **No API changes** — `fetchUserData` and all `/api/*` calls stay exactly as they are today.

## Dashboard page layout (rebuilt)

`PortalNavigation` stays. `<main>` content rebuilt top→bottom:

1. **Greeting header** — keep current text (name, classes completed, streak, package), keep `RoleSwitcher` and Today's Intention. Restyled with `Card` + tokens.
2. **KPI row** → `StatCardRow`: Day streak, On time, Late, No-shows (+ optionally Credits remaining). Replaces the hand-built strip.
3. **Path to Mastery** → **kept custom**, restyled to sit on the same `Card`/token surface as the blocks (no Space block — bespoke milestone track).
4. **Achievements** → kept, restyled (badge chips). Unchanged data.
5. **Middle row**: `VitalityAreaChart` (2/3, replaces hand-rolled SVG) + right column `UpcomingScheduleCard` + a Quick-Book actions `Card` (1/3).
6. **Bottom row**: `ActivityTimeline` + **Nourish/Café card kept custom**, restyled.
7. **Order History modal** → body uses `OrderHistoryTable`. Check-In modal unchanged.

Loading and empty states preserved (e.g. "No upcoming classes", "Book your first class" CTA, vitality zeros until hydrated).

## Admin reuse (in scope as a light touch, not a full admin rebuild)

After the wrappers exist, the admin dashboard's equivalent KPI tiles can switch from `MetricCard` to `StatCard` where it's a drop-in. This is **opportunistic** — only swap where the prop shape matches cleanly. A full admin dashboard rebuild is out of scope.

## Out of scope (follow-up specs)

- Portal pages: bookings, book, packages, profile, menu, payment/razorpay-return (each its own spec).
- Auth pages (login/signup/reset/onboarding) — recently revamped, untouched.
- Any backend / API / Prisma change.
- Full admin dashboard rebuild.

## Edge cases & constraints

- **Brand fidelity:** wrappers use semantic tokens only; the page's bespoke cards may still use `bg-sage`/`text-charcoal` brand utilities. Both resolve to the same palette.
- **Charts:** recharts is already a dependency (admin uses it). `VitalityAreaChart` uses `ChartContainer` from `src/components/ui/chart.tsx` so tooltip/legend theming matches admin.
- **No new heavy deps:** Space blocks pull only shadcn/ui primitives already present.
- **`cream` token** must be defined before the redesigned page renders or branded surfaces look wrong.
- **TS build errors are silenced** (`ignoreBuildErrors`), so rely on `npm run lint` + manual type-check, not the build, to catch regressions.

## Verification

- `npm run lint` clean on changed files.
- `npm run dev:next`, sign in as a seeded member (`npm run db:seed:members`), load `/portal/dashboard`: KPI row, vitality chart, upcoming, activity, order-history modal all render with real data and brand colors.
- Empty-state member (no bookings/packages) renders without crashes.
- Admin dashboard still renders after any opportunistic `StatCard` swap.

## Open questions / risks

- Exact installed-block file path and markup are unknown until first `npx shadcn add` run; wrapper internals finalize then. Mitigated by the fallback column.
- Final `--color-cream` hex needs confirmation against the existing visual intent (sand `#e8e4d9` vs a lighter cream).