# Kitchen / Chef Portal — Design

**Date:** 2026-05-26
**Status:** Approved

## Goal

Give kitchen staff a scoped portal. A dedicated `chef` account
(`chefs@copperandcloves.com`) can manage the café, watch live member orders, and
view a read-only list of members with their pass type and derived café discount —
without access to the rest of the admin panel.

## Decisions (from brainstorming)

- **Access model:** dedicated `chef` role. Sees only Kitchen, Café, and Members &
  Discounts. Blocked from every other `/admin/*` page.
- **Café discount source:** derived from pass type (no new schema field), via the
  existing mapping — Class Pass 5%; Studio (Unlimited) passes 1mo 10% / 3mo 12% /
  6mo 15% / 12mo 20%. View-only.
- **Discount editing:** none. Read-only everywhere for now.
- **Café reuse:** chef uses the existing `/admin/cafe` page unchanged. Shared APIs
  mean menu edits and orders stay consistent automatically.

## Architecture

Approach **A**: reuse `/admin/cafe`; `/admin/kitchen` is a new focused
live-orders dashboard; `/admin/kitchen/members` is the discount list. No
duplication of café CRUD, no data drift.

### 1. New `chef` role
- `Profile.role = "chef"`. No schema change (role is a free string).
- Seed: `scripts/seed-chef.ts` → `chefs@copperandcloves.com`, password
  `Qwerty@123!`, role `chef`, idempotent by `(email, role)`. npm alias
  `db:seed:chef`.

### 2. Auth plumbing
- `login-roles.ts`: add `chef` to `PORTAL_ORDER`.
- `SignInForm.tsx`: extend `Role` union + `PORTALS` map with
  `chef → /admin/kitchen`.
- `_app.tsx resolvePortalKind`: `role === "chef"` on `/admin/*` → `"kitchen"`
  chrome (admin still → `admin`).

### 3. New `kitchen` portal config (`dashboardNav.ts`)
- `kind: "kitchen"`, badge "Kitchen". Sections:
  - Kitchen → `/admin/kitchen`
  - Café → `/admin/cafe`
  - Members & Discounts → `/admin/kitchen/members`
- `mobilePrimary` for the bottom nav.
- `PortalKind` union gains `"kitchen"`.

### 4. Access guards (allow `chef` alongside `admin`)
- `/admin/cafe` client guard: allow `admin || chef` (else redirect).
- `/admin/kitchen` + `/admin/kitchen/members`: new pages, same `admin || chef`
  client guard.
- `/api/cafe/orders`: GET see-all and PATCH status update allowed for
  `admin || chef` (was `admin` only).
- `/api/admin/kitchen/members`: new, `admin || chef`.

### 5. Centralize discount — `src/lib/cafeDiscount.ts`
- `STUDIO_PASS_FOOD_DISCOUNTS: Record<string, number>` (the Unlimited map).
- `CLASS_PASS_FOOD_DISCOUNT = 0.05`.
- `cafeDiscountRate({ category, packageName }): number` — studio → map lookup by
  name, class → 0.05, else 0.
- Refactor `book.tsx` to import these (remove local copies). Single source of
  truth shared by member checkout and the kitchen members view.

### 6. New API — `GET /api/admin/kitchen/members`
- Guard `admin || chef`.
- Returns members (`role: "user"`) with: name, email, active `UserPackage`
  (name + pass category via `passCategoryForPackageType`), and derived discount %
  via `cafeDiscountRate`. Members with no active package → discount 0, pass "—".

### 7. New pages
- `/admin/kitchen`: live active-orders board (fetch `/api/cafe/orders`, filter to
  pending/preparing), status-advance buttons, today's order count/value stats.
- `/admin/kitchen/members`: read-only `ResponsiveTable` — name, email, pass type,
  discount %.

## Out of scope (YAGNI)
- No discount editor UI (derived, view-only).
- No café rebuild (reuse existing page).
- No schema migration.

## Risks
- Seeding writes to the configured DB. `.env.local` targets prod RDS — the chef
  account will be created in prod (intended), confirm before running the seed.
- Any future per-page server guard for `/admin/*` must include `chef` for café +
  kitchen routes.
