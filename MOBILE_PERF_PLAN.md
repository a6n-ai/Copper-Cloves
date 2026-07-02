# Copper & Cloves — Mobile + Performance Optimization Plan

_Generated 2026-07-02 from a 6-surface parallel audit of all 65 pages (64 findings)._

## 1. Executive Summary

The audit surfaces three systemic problems. **First, uncached hand-rolled fetching is everywhere** — `book.tsx`, `packages.tsx`, `admin/schedule.tsx`, `admin/badges.tsx`, and both partner pages re-fetch identical data on every navigation/month/week change (and in a few cases fetch the same endpoint 2–3× per flow) despite SWR being installed; several also chain request waterfalls. **Second, always-on work drains phones and re-renders giant trees** — `admin/cafe.tsx` runs a 1s `setInterval` that re-renders the entire page every tick and polls orders on every tab, the auth leaves-canvas rAF never pauses when backgrounded, and the five 1500–2200 LOC admin pages mount large dead/closed dialog subtrees that ship in-bundle and evaluate on every render. **Third, mobile layout breaks in high-traffic flows** — the shop filter bar is hidden under the sticky nav, `book.tsx` blanks the whole page (losing scroll + week-nav) on every week tap, the partner Confirm/Reject workflow is off-screen inside a horizontally-scrolling table, and many admin dialog forms use unprefixed `grid-cols-2` that crush fields inside phone bottom-sheets. Layered on top is consistent design-system drift: native selects/checkboxes with blue focus rings, `shadow-2xl`/`shadow-md` on resting cards, Pill used as an interactive toggle, dead placeholder buttons, and low-contrast helper text below WCAG AA.

## 2. Quick Wins (Tier 1) — high-impact, low-effort, safe to batch

| File | Issue | Fix | Category |
|---|---|---|---|
| `src/pages/shop.tsx:290` | Filter/Cart bar `sticky top-0 z-40` hides under marketing nav `sticky top-0 z-50`; cart entry unreachable on scroll | `sticky top-[68px]` (verify vs nav height) | mobile (high) |
| `src/pages/portal/book.tsx:1505` | Past week-day buttons `opacity-40` but still clickable → member selects greyed-out past day | Add `disabled`/`aria-disabled`, early-return in handler | mobile |
| `src/pages/admin/partners.tsx:207` | `Assign a class` Select fixed `w-72` overflows on 320–375px phones | `w-full sm:w-72` | mobile |
| `src/pages/admin/control.tsx:1217,1344,1484,1653` | Dialog forms `grid grid-cols-2` unprefixed → 2 cramped cols in phone sheet | `grid-cols-1 sm:grid-cols-2` | mobile |
| `src/pages/admin/schedule/[id].tsx:897,919` | Edit-class forms `grid-cols-2` unprefixed | `grid-cols-1 sm:grid-cols-2` | mobile |
| `src/pages/admin/dashboard.tsx:1795,1875` | Instructor add/edit forms `grid grid-cols-2` unprefixed | `grid-cols-1 sm:grid-cols-2` | mobile |
| `src/pages/partner/members.tsx:121` | `truncate` never fires (no width constraint) → long emails force horizontal scroll | Add `max-w-[180px] sm:max-w-none` / `min-w-0` | mobile |
| `src/components/auth/SignInForm.tsx:164,238` | Password `autoFocus` during height animation pops keyboard mid-animation | autoFocus email only; focus password in `onAnimationComplete` | mobile |
| `src/pages/cafe.tsx:500` | Category cards `<Image ... unoptimized>` ship full JPGs | Drop `unoptimized`, `fill` + `sizes` | perf |
| `src/pages/portal/dashboard.tsx:1128` | Check-in modal image `unoptimized` for 192px thumb | Drop `unoptimized`, add `sizes` | perf |
| `src/pages/admin/cafe.tsx:231` | 10s order-poll runs on every tab | Gate interval on `activeTab === 'orders'` | perf |
| `src/pages/admin/cafe.tsx:887` | `key={item.id}` with optional id → `key=undefined` collisions | `key={item.id ?? item.name}` | perf |
| `src/components/AuthLeavesBackground.tsx:105` | Decorative rAF loop never pauses when tab hidden → battery drain | `visibilitychange`: cancel rAF when hidden | perf |
| `src/pages/portal/bookings.tsx:286`, `packages.tsx:310`, `partners.tsx:52,72` | Redirect to legacy `/portal/login` → extra 307 hop | Redirect to `/login` directly | perf |
| `src/pages/portal/set-password.tsx:41` | Token-validate fetch chain has no `.catch` → perpetual spinner | `.catch(() => setTokenError(...))` | a11y |
| `src/pages/checkin.tsx:41` | Async check-in outcome not announced to SR | Add `role="status" aria-live="polite"` | a11y |
| `src/pages/meal-subscription.tsx:392`, `rental.tsx:366-372` | Form inputs lack `autoComplete` | Add `autoComplete` | a11y |
| `src/pages/portal/book.tsx:1981`, `packages.tsx:1162`, `dashboard.tsx:732` | Placeholder-only inputs, unlabeled for SR | Add `aria-label` | a11y |
| `src/pages/cafe/meal-subscription.tsx:109` | `duration-2000` not a valid token → hero hard-cuts | `duration-[2000ms]` | design |
| `src/pages/portal/book.tsx:1593,1581,2169,2182` | `duration-600` not a valid step → panel snaps at 150ms | `duration-500`/`duration-700` | design |
| `src/pages/cafe/meal-subscription.tsx:382` | `shadow-2xl` on resting Card | `border` + Lifted token on hover only | design |
| `src/pages/portal/payment/razorpay-return.tsx:156` | `bg-card/95` + `shadow-md` off-system | `bg-white-warm` + Lifted token | design |
| `src/pages/admin/kitchen/index.tsx:157` | `hover:shadow-md` generic | Lifted token | design |
| `src/pages/404.tsx:21`, `meal-subscription.tsx:181,342,356` | Raw hex bypass tokens | `text-muted-foreground`/`bg-white-warm` | design |
| `src/pages/portal/book.tsx` | Emoji glyphs (⚠️ ✓ ★) as UI icons | Replace with lucide icons | design |
| `src/pages/admin/badges.tsx:896-904` | Color swatch icon-buttons lack aria-label | Add `aria-label` + `title` | a11y |

## 3. High-Impact (Tier 2) — bigger wins, needs care

| File | Issue | Fix | Cat |
|---|---|---|---|
| `src/pages/admin/cafe.tsx:230` | 1s `setInterval` re-renders whole 1600-LOC page every second | Move countdown into memoized child owning its own interval | perf (high) |
| `src/pages/portal/book.tsx:1423` | Week nav blanks header+week-nav+filters; loses scroll | Keep chrome mounted; skeleton only the card region | perf (high) |
| `src/pages/portal/book.tsx:934` | Schedule fetch hand-rolled, no cache | `useStudioSWR` keyed on week-range | perf |
| `src/pages/portal/packages.tsx:322,524,564` | `/api/packages` fetched up to 3× per purchase | Carry DB `id` onto `Package`, or SWR the catalog | perf |
| `src/pages/admin/schedule.tsx:483` | Refetches full catalog+roster on every month page | Split effects | perf |
| `src/pages/admin/badges.tsx:158` | `member-stats`→`members-search` waterfall on every mount | Return id from member-stats; defer to custom tab | perf |
| `src/pages/partner/dashboard.tsx`,`classes.tsx` | Both hand-roll `/api/partner/classes`; refetch identical week | `useSWR` shared key | perf |
| `src/pages/admin/dashboard.tsx:1177,1236,1298,1702` | Dead dialogs evaluate every render + ship in bundle | Delete dead dialogs; gate behind `{open && …}` | perf |
| `src/pages/admin/control.tsx:1208,1331,1475,1643` | ~150-line dialog forms always mounted | Gate each behind `{showX && …}` | perf |
| `src/pages/partner/classes.tsx:403` | Confirm/Reject action column off-screen in horiz-scroll table | `ResponsiveCards` stack under md | mobile |
| `src/pages/admin/cafe.tsx:1557` | Hand-rolled crop modal: no role/focus-trap/Escape/backdrop | Wrap in `ResponsiveDialog` | a11y |
| `src/pages/portal/bookings/[id].tsx:360` | "Complete payment" is just a `<Link>` → broken recovery for held seat | In-page Razorpay re-checkout | design (L) |
| `src/pages/admin/products.tsx:393` | Category CRUD mutates local state only; lost on reload | Persist to backend | design |
| `src/pages/portal/packages.tsx:427` | Client invoice chips: paused/depleted all render "expired" | Map state→brand colors; route to @react-pdf invoice | design |

## 4. Design Polish (Tier 3)

- **Native controls → shadcn (blue focus ring):** `admin/CRM.tsx:611,624,269,641,651`, `admin/cafe.tsx:1345`.
- **Pill misused as interactive control:** `admin/partners.tsx:181` → shadcn `Switch`.
- **Dead placeholder buttons:** `admin/dashboard.tsx:2153,2169,2172`, `admin/products.tsx:881`, `portal/packages.tsx:1305`.
- **Missing/placeholder imagery:** `admin/products.tsx:645`, `admin/dashboard.tsx:1502` raw `<img>`.
- **`window.confirm` on financial destructive action:** `admin/members/[id].tsx:412` → `ResponsiveDialog`.
- **Anti-pattern card grids:** `cafe/meal-subscription.tsx:273` six identical `border-2 hover:shadow-xl`.
- **Contrast below AA:** `onboarding.tsx:288,319,367,405,470`, `AuthShell.tsx:33`, `SignInForm.tsx:143` → raise to `/70`+.
- **Missing skeletons:** `PauseSubscriptionCard.tsx:161`, `portal/bookings.tsx:223`.

## 5. Cross-Cutting Recommendations

1. **Adopt `useStudioSWR` as default fetch path** (used in 2 files today). Dedup + cache + revalidation for free.
2. **Lazy-dialog pattern `{open && (<ResponsiveDialog/>)}`** — codify; delete dead dialogs; `next/dynamic` heaviest.
3. **Error state ≠ empty state** — shared destructive-Card + retry (classes.tsx does it right).
4. **Responsive-grid ESLint rule** — ban unprefixed `grid-cols-{2..9}` and bare `w-[NNNpx]`.
5. **`/portal/login` → `/login` codemod** — kill the 307 hop; add SSR gates to ungated portal pages.
6. **Tailwind token audit** — invalid durations, raw hex, resting `shadow-2xl`; encode Lifted shadow as named utility.
7. **`next/image` hygiene** — remove `unoptimized`, add `sizes`; extend to the 50/65 pages not yet using it.

## 6. Sequenced Execution Roadmap

1. **Tier 1 batch** (≈0.5–1 day, all S) — mechanical, low-risk. _[executing now]_
2. **Always-on render/battery** — `admin/cafe.tsx` clock refactor, poll gating, leaves-canvas pause.
3. **SWR migration + waterfalls** — `book`, `packages`, `admin/schedule`, `admin/badges`, `partner/*`.
4. **Code-split giant pages** — lazy-dialog + delete dead dialogs; `book.tsx` week-nav skeleton scoping.
5. **Mobile workflow conversions** — `partner/classes` roster → cards; crop-modal a11y; skeleton shapes.
6. **Design polish + guardrails** — shadcn swaps, Pill→Switch, contrast, ESLint rule.
7. **Deferred (spec separately)** — `bookings/[id]` in-page re-checkout, `products` category persistence.
