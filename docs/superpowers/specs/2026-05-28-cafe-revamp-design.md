# Café Revamp — Design Spec

**Date:** 2026-05-28
**Scope:** Revamp all three café surfaces — `/admin/cafe`, `/portal/menu`, public `/cafe` — using shadcn-space ecommerce blocks, re-skinned to the `DESIGN.md` system. UI + UX-enhancement only; café backend unchanged.

## 1. Goal

Replace the current hand-rolled café UIs with installed shadcn-space ecommerce blocks, re-skinned to the "Copper & Clay Studio" design system, plus targeted UX enhancements. Preserve 100% of existing functionality and the `/api/cafe/*` backend.

## 2. Constraints (non-negotiable)

### Design system (`DESIGN.md`)
- Café/food context → **terracotta (`#c17856`) is the lead accent**; **sage (`#8f9779`) owns primary actions/CTAs** (Two-Voice Rule).
- Page bg cream (`#f5f2ea`); cards white-warm (`#fafaf8`); borders warm (`#e5e4dc`). **No pure `#ffffff`/`#000000`.**
- **Playfair Display**: item names + section headings ONLY. **Montserrat**: all UI text, labels, buttons, table cells (Strict Handoff Rule).
- Flat at rest; lifted shadow (`0 4px 24px rgba(51,51,51,0.08)`) on hover. Sage focus ring.
- Forbidden: glassmorphism/`backdrop-blur` decoration, blur-circle backgrounds, identical 3-across icon-card grids, `shadow-2xl` at rest, Tailwind amber/yellow, fabricated ratings.

### Backend / data — UNCHANGED
- No Prisma schema changes. No new `/api/cafe/*` behavior.
- Endpoints stay as-is: `GET/POST/PUT/DELETE /api/cafe/items`, `GET/POST/PATCH /api/cafe/orders`, `POST /api/cafe/checkout`, `POST /api/coupons/validate`, `GET /api/class-schedules`, `POST /api/upload`.
- Discount logic (`src/lib/cafeDiscount.ts`), coupon, guest, class-link, `Payment` ledger, order urgency/polling logic preserved.

### Data honesty
- `CafeItem` fields available: `id, name, category, description, price, image_url, image_file_id?, is_available`. **Nothing else exists.**
- Block fields with no backing data (macros/nutrition, multi-image carousels, star ratings, stock counts) are **stripped, not fabricated**.
- Single `image_url` → no image-carousel block variants.

## 3. Block installation

Registry `@shadcn-space` already configured in `components.json`. Install each via:
```
npx shadcn@latest add @shadcn-space/<block-name>
```
The shadcn-space AGENT RULE forbids recreating/approximating blocks — they MUST be installed via CLI. Re-skinning = editing the installed source files (palette, fonts, classes) to match `DESIGN.md`. Adapt any App-Router/`"use client"` idioms for this Pages Router project (`rsc: false`).

Blocks to install:
- `product-category-01`, `product-listing-01`, `product-listing-04`, `product-quick-view-03`, `checkout-01`
- `statistics-01`, `widget-04`, `chart-13`
- (`product-overview-04` as reference only — install only if used)

New runtime dep: `recharts` (pulled by `chart-13`; standard shadcn chart dependency).

## 4. Surface designs

### 4.1 User menu — `/portal/menu`
Compose from blocks + new shared components:
- **CategoryFilter** (`product-category-01` tabbed, re-skinned) — All / Smoothie Bowls / Drinks / Snacks / Meals + **new search input** (client-side filter on item name).
- **Menu grid** (`product-listing-01`) — `MenuItemCard` per item: image, Playfair name, description, price, terracotta discount badge (rate from `cafeDiscount.ts` using member's package), "Add" / quantity controls. Card click opens quick-view.
- **ItemQuickView** (`product-quick-view-03`, re-skinned) — NEW modal: image, name, description, price + discount, qty stepper, Add to Cart. Feature-highlight slots repurposed to category + availability + discount line (no invented nutrition).
- **CartDrawer** (`checkout-01` re-skinned into a `Sheet`/`ResponsiveDialog`) — NEW slide-in replacing the current floating-button → full drawer. Contains existing checkout flow verbatim: line items + qty edit, coupon validate, guest count (0–5) + names, add-to-class selector, online payment, success → redirect.

Preserve: coupon discount, guest slots, class linking, processing/success/error states, mobile cart offset above `MobileBottomNav`.

### 4.2 Public marketing — `/cafe`
- Keep existing marketing page structure (hero, narrative sections).
- Swap the menu-showcase section to a re-skinned `product-listing-04` (promo-banner grid) for visual menu display. Read-only; no cart on public page (current behavior).
- Optional featured-item highlight referencing `product-overview-04` layout — only if it improves the page; else omit.

### 4.3 Admin — `/admin/cafe`
Add an **Overview** tab; keep existing **Menu Items / Categories / Orders** tabs.
- **Overview** (NEW):
  - **CafeStats** (`statistics-01`) — KPI cards: orders today, café revenue, pending orders, avg prep time. Sourced from existing `GET /api/cafe/orders` aggregation (client-side compute; no new endpoint).
  - **Best-selling** (`widget-04`) — top café items by order count.
  - **Sales chart** (`chart-13`) — café sales over time (recharts).
- **Menu Items** — re-skin CRUD grid using `product-listing-01` card styling; **keep** `react-easy-crop` image upload, create/edit/delete via existing endpoints. Add **search** over menu items.
- **Categories** — re-skin existing add/edit/delete grid to DESIGN.md.
- **Orders** — keep custom urgency colors (red/orange/yellow by minutes-from-class-start), countdown, 10s polling, status workflow (pending→preparing→ready→completed / cancel). Add **NEW order-status timeline** to each order card (visual step progression).

## 5. Component structure

New shared components in `src/components/cafe/`:
- `MenuItemCard.tsx` — single item card (used by user grid + admin CRUD grid).
- `CategoryFilter.tsx` — category tabs + search.
- `ItemQuickView.tsx` — user item modal.
- `CartDrawer.tsx` — user cart + checkout (wraps existing checkout logic).
- `CafeStats.tsx` — admin Overview KPIs + best-selling + chart wrapper.
- `OrderStatusTimeline.tsx` — admin order step progression.

Rationale: extract reusable UI out of the 1527-line `admin/cafe.tsx` and 614-line `portal/menu.tsx` so each file shrinks and responsibilities are isolated. Pages become composition + data-fetching shells.

Responsive: wrap modals/drawers in existing `ResponsiveDialog`/`Sheet`; data tables in `ResponsiveTable`; honor `useIsMobile` (768px). Keep desktop output unchanged where only adding mobile classes.

## 6. Out of scope
- No changes to café DB schema, API behavior, payment/discount/coupon logic.
- No new café data fields (macros, ratings, multi-image, stock).
- No auth/role changes.

## 7. Risks & mitigations
- **Block App-Router idioms** → adapt to Pages Router on install (strip server-only imports, keep `"use client"` harmless or remove).
- **`recharts` new dep** → standard, low risk; confirm bundle acceptable.
- **`ignoreBuildErrors: true`** masks type errors → typecheck manually (`tsc --noEmit` / `npm run lint`), don't trust the build.
- **DESIGN.md drift** → after install, every block re-skinned before wiring; no raw SaaS styling ships.

## 8. Acceptance
- All three surfaces render in C&C palette/type, no pure white/black, terracotta-led café accent.
- Every pre-existing café feature works unchanged (manual verification of: add-to-cart, coupon, guests, class-link, checkout, admin CRUD + image crop, order status workflow + polling).
- New: search (user + admin menu), item quick-view, cart drawer, admin Overview tab, order timeline.
- No Prisma/API diffs. `npm run lint` clean for touched files.
