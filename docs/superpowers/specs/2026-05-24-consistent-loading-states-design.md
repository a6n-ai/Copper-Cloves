# Consistent Loading States — Design Spec

**Date:** 2026-05-24
**Branch:** feat/mobile-friendly
**Goal:** One canonical loader (shadcn `Spinner`) + skeletons on data load, applied app-wide. Eliminate the ~57 ad-hoc `animate-spin` sites across 28 files.

## Problem

Loading is inconsistent. Every page reinvents its loader:
- Full-page load: `h-12 w-12 border-4 border-sage/20 border-t-sage rounded-full animate-spin` (~12 copies).
- Inline button load: `border-2 border-white border-t-transparent rounded-full animate-spin` and `Loader2 animate-spin` (varied sizes/colors).
- Only the 4 dashboards use proper `<Skeleton>` (`src/components/dashboard/skeletons.tsx`).

Result: different colors (`sage`, `white`), sizes, and shapes for the same concept; layout shift on data pages that lack skeletons.

## Decisions (locked)

1. **Canonical loader:** official shadcn `Spinner` component.
2. **Scope:** full app sweep — portal, admin, partner, instructor, public, shared components.
3. **Rule:** skeleton for initial page/data load; spinner for actions and inline refetch; centered spinner (`PageLoader`) only when layout is unknown (route/auth gate).

## Architecture

### New primitives (`src/components/ui/`)

- **`spinner.tsx`** — shadcn `Spinner`. Wraps lucide `Loader2` with `animate-spin`, sized via `className` (`size-4` default), color via `currentColor` (adapts to button text / brand context automatically). Single source of `animate-spin` in the codebase.
- **`PageLoader`** — exported from `ui/spinner.tsx`. Full-height centered `<Spinner className="size-10 text-sage" />` for route/auth gates where no layout shape is known.

### Skeleton library

Existing dashboard skeletons stay in `src/components/dashboard/skeletons.tsx`: `StatCardSkeleton`, `StatRowSkeleton`, `CardBlockSkeleton`, `ListSkeleton`, `TableSkeleton`, dashboard composites. Keep as-is.

New generic skeletons go in a new `src/components/skeletons.tsx` (app-wide, not dashboard-only). `ListSkeleton`/`TableSkeleton` are re-exported there from the dashboard file so consumers have one import. New additions:
- **`GridSkeleton`** — responsive card grid (class catalog, book, packages, menu, products).
- **`FormSkeleton`** — labelled field placeholders (profile, settings).
- Reuse `ListSkeleton` / `TableSkeleton` for list and table pages.

## Loading rule → concrete mapping

| Current pattern | Files / sites | Becomes |
|---|---|---|
| Full-page `border-t-sage` (page load, layout known) | `classes`, `portal/book`, `portal/bookings`, `portal/packages`, `portal/menu`, `portal/profile`, `admin/members`, `admin/cafe`, `admin/CRM`, `admin/credits`, `ClassCatalog`, `Instructors` | Layout-matched skeleton (`GridSkeleton`/`ListSkeleton`/`TableSkeleton`/`FormSkeleton`) |
| Full-page loader (gate / unknown layout) | `portal/onboarding`, `portal/payment/razorpay-return`, `portal/reset-password`, auth checks | `<PageLoader />` |
| Inline button / action loader | `auth/SignInForm`, `auth/SignUpForm`, `CheckoutModal`, `RoleSwitcher`, `instructor/dashboard` (check-in), `portal/profile` (saves), `admin/schedule`, `admin/dashboard`, `admin/members`, `admin/partners`, `admin/control` | `<Spinner className="mr-2 size-4" />` inside button |
| Existing `<Skeleton>` dashboards | `admin/dashboard`, `portal/dashboard`, `partner/dashboard`, `instructor/dashboard` | Keep (already correct) |

Per-file site counts (from `rg -c animate-spin src`):
`admin/schedule`:5, `admin/cafe`:5, `portal/profile`:4, `admin/control`:4, `admin/CRM`:4, `portal/packages`:3, `instructor/dashboard`:3, `admin/dashboard`:3, `portal/menu`:2, `partner/settings`:2, `classes`:2, `admin/partners`:2, `admin/members`:2, `CheckoutModal`:2, then 1 each: `portal/reset-password`, `portal/payment/razorpay-return`, `portal/onboarding`, `portal/bookings`, `portal/book`, `partner/members`, `partner/classes`, `admin/schedule/[id]`, `admin/credits`, `auth/SignUpForm`, `auth/SignInForm`, `RoleSwitcher`, `Instructors`, `ClassCatalog`.

## Component contracts

- **`<Spinner>`**: `(props: { className?: string }) → JSX`. Color inherited (`currentColor`); size via `className`. No internal text. Used inline.
- **`<PageLoader>`**: `() → JSX`. Centered, fills parent min-height. No props for v1.
- **Skeletons**: pure presentational, accept `count`/`rows` where repeating; mirror the real layout's spacing/rounding so swap-in causes no shift.

## Out of scope (YAGNI)

- No global Suspense/route-loading overlay.
- No loading state for instant/synchronous UI.
- No animation library; `animate-spin` + `animate-pulse` (Tailwind) only.
- No redesign of the skeleton visual style.

## Testing / verification

1. `npm run lint` clean.
2. **Grep guard:** after sweep, `rg 'animate-spin' src` returns only `src/components/ui/spinner.tsx`.
3. **Grep guard:** `rg 'border-t-sage|border-t-transparent' src` returns no spinner divs.
4. Playwright responsive smoke (config already present) on classes, portal/book, admin/members — confirm no layout break.
5. Manual: throttle network in devtools, eyeball load → skeleton → content per portal; submit a form → button spinner.

## Risks

- Some bespoke full-page loaders sit inside conditional branches with surrounding markup; replacing with skeletons needs the real layout — handle file-by-file, don't blind-swap.
- `currentColor` spinner inside sage-bg buttons must read white text — verify contrast on primary buttons.
