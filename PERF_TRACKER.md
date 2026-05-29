# Perf Tracker

Vercel React rules audit + remediation. Tracks all findings from initial scan + rescan.

Legend: `[x]` done · `[ ]` pending · `[~]` in progress · `[-]` deferred (needs discussion)

---

## Session 2026-05-28 — paused for dev test

~30 items landed across React rerender hygiene, Pages Router platform wins, and bundle hygiene.

### Test-on-dev checklist (regression surface)

Hit these flows in `npm run dev` first — they're the surfaces this session touched:

1. **Fonts** — every page should still show Playfair Display headings + Montserrat body (no FOUT to system fonts). Marketing pages should paint without the Google Fonts blocking request in Network tab.
2. **Cart** — add / remove / update qty across `/portal/menu`, `/shop`, `/cafe`. Cart badge in `Navigation` must reflect changes; checkout totals must match.
3. **Responsive dialogs** — open any admin dialog (e.g. `admin/members` → Manage), resize browser across 768px. Should NOT remount the form mid-edit. Mobile sheet variant should still appear under 768px on first open.
4. **Activity tracking** — open DevTools → Network. Page nav should still emit `page_view`. Tab hidden for 30s should pause the 15s flush; tab visible should resume + flush.
5. **Check-in countdown / beacon** — `/instructor/dashboard`. 1-Hz countdown should pause when tab hidden; instructor beacon should render correctly.
6. **Class countdown pill** — on `/admin/dashboard` overview "Today's classes" carousel.
7. **Sign-up form** — `/portal/signup`. Type into password field; the rest of the form should NOT visibly re-flash on every keystroke. Suggest-strong button still fills both password fields.
8. **Path to Mastery + Vitality area chart** — `/portal/dashboard`. Charts should render; milestone progress should still animate on first paint.
9. **Order history table** — `/portal/dashboard` or `/portal/bookings`. Date column, status badge, payment label should all render identically.
10. **Mobile bottom nav** — under 768px, primary tabs + More sheet still work; scanner FAB (member/instructor) opens scan modal.
11. **Admin Finance tab** — open a Finance-1 row → detail dialog should still open with full breakdown.
12. **Admin Classes tab** — Peak Hours heatmap colors should still gradient correctly; hover scale still works.
13. **Admin Overview tab** — Today carousel cards; date prev/next/today buttons; member selection checkboxes shouldn't re-render the carousel.
14. **Landing `/`** — Hero videos still autoplay; below-the-fold sections (Instructors, Pricing, Founder, Rental, Boutique, Testimonial) should still appear as user scrolls (now lazy-loaded via `next/dynamic`).
15. **Public API caching** — `/api/classes`, `/api/retail-products`, `/api/cafe/items`, `/api/packages`, `/api/class-schedules` (anon). Check Response headers for `Cache-Control: public, s-maxage=…`. Anon hits must NOT return `studio_payout_cut_percent` (was leaking via `include: instructor`).
16. **Auth-scoped APIs** — `/api/class-schedules` while signed in should still return `private, no-store`; `/api/user-stats` should return `private, max-age=10, swr=60`.
17. **GA + Softgen scripts** — Network tab: `googletagmanager.com/gtag/js?id=…` should fire after interactive; `cdn.softgen.ai/script.js` should fire on lazy load (not blocking first paint).
18. **Razorpay checkout** — book a class or buy a package and complete a test payment. Preconnect should warm the Razorpay origin earlier than before.
19. **NumberTicker** — admin dashboard metric cards animating from 0 → value should reach the correct end value (no off-by-one from the ref change).
20. **Pagination** — any admin table with >10 rows. Page-pill click should snap to active page (no more FLIP spring animation — this is intentional).

### Watch for
- Build still passes (`npm run build`) — `next/font` + `next/script` migration touches the build pipeline.
- Hydration warnings in console for the wrapped `<div>` in `_app.tsx` (the font-variable wrapper).
- Any `prisma.classModel.findMany` callers downstream that expected `studio_payout_cut_percent` to be present on `instructor` — it's now `omit`ed.

### Still pending after this session
- ~~Auth gSSP migration across ~25 pages~~ — done in session 4b
- ~~`next/image` migration~~ — done in sessions 3, 5e (14 sites total)
- ~~`pages/classes.tsx`, `shop.tsx`, `shop/[id].tsx` → `getStaticProps` + ISR~~ — done in session 3
- ~~`DashboardChrome` scalar session destructure~~ — done in session 3
- ~~SWR migration for shared endpoints~~ — partial in sessions 4c, 4d
- Hero video `poster` JPEGs (needs uploaded assets, not a code-only change)
- `next.config.mjs` `remotePatterns` tightening (needs full image-host audit)

---

## Session 2026-05-29 — second pass after green dev test

After confirming the first session held up in dev, knocked out the remaining low/medium-risk items:

### What landed
- **DashboardChrome scalar reads** — `userName`/`userEmail`/`userRole` derived once; `shellUser` `useMemo`'d so the 4-min session refetch can't cascade through `DashboardShell`. `OnboardingGate` effect now keys on scalar `onboardingCompleted`.
- **`next/image` migration** — 11 sites converted: `Footer` logo, `Testimonial` portrait, `ProfileSection` avatar preview, `instructor/dashboard` `MemberAvatar`, `admin/schedule` booking avatar, `admin/cafe` (3 menu-item images), `admin/control` (5 class/instructor previews). User-uploaded avatars use `unoptimized` to skip the optimizer. `admin/cafe.tsx` cropper kept its DOM `Image()` constructor by qualifying as `new window.Image()`. `Instructors.tsx` kept its custom `<picture srcSet>` pipeline.
- **SSG / ISR for data pages**:
  - `shop.tsx` — `getStaticProps` + 60s ISR; direct Prisma read; client `useEffect` fetch dropped.
  - `shop/[id].tsx` — `getStaticPaths` (featured products pre-rendered) + `fallback: "blocking"` for the tail; `getStaticProps` returns product + catalog with 60s ISR; uses `notFound: true` for inactive/missing.
  - `classes.tsx` — class catalog via `getStaticProps` + 5-min ISR (with `omit` for `studio_payout_cut_percent` / `hashed_password` like the API route). Schedule list stays client-fetched (date-windowed). Dead `fetchClassesList` helper removed.
- **`classes.tsx`** auth read — switched from `{ data: authSession }` to `{ status: authStatus }`.
- **`razorpayCheckout`** — verified SDK uses on-demand DOM injection (not `beforeInteractive`); preconnect already in place from session 1.

### Wrap-up notes
- **Still pending** for a future session: SWR migration for shared endpoints; `_app.tsx` partner-profile fetch via gSSP; remaining `eslint-disable react-hooks/exhaustive-deps` sites; `next.config.mjs` `remotePatterns` audit; Hero video poster JPEGs.
- Total across both sessions: ~45 items landed (~30 in session 1 + ~15 here).

---

## Session 2026-05-29 (b) — auth gSSP migration

Killed flash-of-unauth on 15 pages via a shared `requireSessionSSP({ roles })` helper:

- `src/lib/requireSessionSSP.ts` — `GetServerSideProps` factory that calls `getStudioServerSession` then returns `redirect: { destination: "/login?redirect=…" }` for unauth or `redirect: "/login"` for wrong role. Otherwise `{ props: { session } }`.
- Applied to all admin pages, both authed dashboard landings (instructor + portal), and the high-traffic portal pages. See list above.
- **Pattern**: additive — kept existing `useSession()` hook calls so existing runtime effects (which gate behaviour on `status`/`session?.user?.role`) continue working as a fallback for mid-session expiry. Where the in-component redirect dance was risky to keep alongside gSSP (admin/dashboard, instructor/dashboard), it was removed.

### Test-on-dev checklist (gSSP regression surface)

1. **Unauth admin nav** — log out, visit `/admin/dashboard`. Should redirect server-side to `/login?redirect=/admin/dashboard` (no flash of the dashboard JSX).
2. **Wrong-role nav** — log in as a member, visit `/admin/dashboard`. Should redirect to `/login` (no admin JSX flash).
3. **Instructor portal** — log in as instructor, visit `/instructor/dashboard`. Should render directly (no client-side redirect bounce).
4. **Member portal** — log in as member, visit `/portal/dashboard`. Should render directly.
5. **All admin pages** — `/admin/dashboard`, `/admin/cafe` (admin OR chef), `/admin/control`, `/admin/credits`, `/admin/members`, `/admin/schedule`, `/admin/CRM`, `/admin/badges`, `/admin/partners`, `/admin/products`. Each should redirect to `/login` for unauthed callers.
6. **Member portal pages** — `/portal/book`, `/portal/bookings`, `/portal/packages`, `/portal/menu`. Same redirect behaviour for unauthed.
7. **Build** — `npm run build` must still succeed. New gSSP runs `getStudioServerSession` per request (not at build time), so this doesn't add build cost.

### Total: ~60 items across three sessions.

---

## Session 2026-05-29 (c) — SWR migration (partial)

`swr@^2.4.1` installed; shared `useStudioSWR` helper at `src/lib/swr.ts`. Migrated three of the most-duplicate endpoints:

- **`/api/user/profile`** — `_app.tsx` DashboardChrome (avatar). Write-side cache-bust in `ProfileSection.tsx` after avatar upload so the topbar updates without a hard reload.
- **`/api/partner/profile`** — `_app.tsx` DashboardChrome (brand). Write-side cache-bust in `partner/settings.tsx` after save.
- **`/api/cafe/items?available=true`** — `portal/menu.tsx` reader; `admin/cafe.tsx` write paths (`handleDelete`, `handleSave`, `seedDefaultItems`) all `mutate(...)` so the member-facing menu refreshes live.

### Pattern notes
- `useStudioSWR(key, config)` — pass `null` as key to disable the fetch (e.g. `kind === "partner" ? URL : null`). Defaults to 15s dedupe + revalidate on focus + keepPreviousData.
- `mutate("...url...")` from `swr` (top-level import) busts any cached entry for that URL across the whole app — use after writes that change server state.

### Deferred
- `portal/book.tsx` cafe-items migration — `foodItems` has a user-mutated `quantity: 0` field per item; needs server-vs-local state separation to migrate safely.
- `/api/class-schedules` migration — URL keys vary per consumer (different from/to windows), so cross-page dedupe value is modest.

### Test-on-dev checklist (SWR regression surface)
1. **Avatar live update** — `/account` upload a new photo → topbar/sidebar avatar updates without hard reload.
2. **Partner brand live update** — `/partner/settings` change name/logo → partner topbar updates without reload.
3. **Cafe menu live update** — `/admin/cafe` edit/delete an item → open `/portal/menu` in another tab → focus the portal tab → should refetch.
4. **Cafe menu dedupe** — navigate `/portal/menu` → `/portal/book` → `/portal/menu` within 15s. Network tab should NOT show repeated `/api/cafe/items?available=true` calls.
5. **Stale-while-revalidate** — visit `/portal/menu`, switch tabs for 30+ seconds, come back. Should show cached items immediately, then refetch in background.

### Total: ~65 items across three sessions.

---

## Session 2026-05-29 (d) — finish pass: SWR + bundle + memo cleanup

Mopped up the remaining tractable items after the SWR migration. No `[ ]` entries left — everything is either `[x]` done or `[-]` deferred with a written reason.

### What landed
- **`portal/menu.tsx` upcoming classes** — fetchUpcomingClasses migrated to `useStudioSWR` (URL key memoized so the dedupe + focus revalidation hits other consumers of the same window).
- **`portal/dashboard.tsx` mobile bundle** — `MemberMobileDashboard` now `next/dynamic({ ssr: false, loading: MemberMobileDashboardSkeleton })`; desktop visitors never download the mobile-only chunk.
- **`portal/dashboard.tsx` quick-actions** — `mobileQuickActions` array `useMemo([router])`; was reallocating 4 closures per render.

### Stale entries reconciled
Items already done in earlier passes that the tracker had not been updated for:
- `pages/admin/CRM.tsx` — analytics-from-messages was already in place.
- `admin/DayScheduleList.tsx` — sort `useMemo` + `toggleSort` `useCallback` already in place.
- `admin/MetricCard.tsx` — already `memo()`-wrapped.

### Deferred (with documented reasons)
- `admin/TodayClassesCarousel.tsx` per-card memo — small list, marginal benefit.
- `admin/ControlAnalyticsPanel.tsx` BarRow extraction — 11 heterogeneous bar shapes; needs prior split into per-section files.
- `components/Instructors.tsx` InstructorCard memo — already lazy-loaded via `next/dynamic`; custom `<picture srcSet>` pipeline.
- `components/Hero.tsx` lazy-mount — desktop has all three panels above the fold; mobile-only IntersectionObserver carries complexity vs. marginal gain.
- `pages/classes.tsx` `<Link>` prefetch on book button — auth-conditional click handler.
- `pages/_app.tsx` partner-profile flash — now SWR'd with write-side mutate; full SSR would need chrome lifted out of `_app`.
- `eslint-disable react-hooks/exhaustive-deps` cleanup — 33 sites, mostly intentional disables; per-file work best done organically.
- `pages/portal/book.tsx` cafe SWR — `foodItems` has user-mutated `quantity` field.
- `/api/class-schedules` cross-page SWR — URL keys vary per consumer (date windows differ).
- `next.config.mjs` `remotePatterns` tightening — needs concrete image-host audit.
- Hero video poster JPEGs — needs uploaded assets.
- `lib/razorpayCheckout.ts` SDK preload — gated to checkout click, doesn't block first paint.

### Total: ~70 items across four sessions. Tracker now has zero open items.

---

## Session 2026-05-29 (e) — fresh audit against Vercel React Best Practices

Ran the project against Vercel's 70-rule catalog (`vercel-react-best-practices` skill). Found four real new wins that earlier sweeps missed.

### What landed

- **`lib/financeReportExport.ts` — `xlsx` dynamic import.**
  `xlsx` is ~600KB raw / ~150KB gzip. Was statically imported, dragging the whole library into the admin/dashboard initial bundle even though it only fires on the Export click. Switched `downloadFinanceReportExcel` to `async function` with `const XLSX = await import("xlsx")` inside. Caller in `admin/dashboard.tsx` updated to `void downloadFinanceReportExcel(...)`.
- **`pages/admin/cafe.tsx` — `react-easy-crop` dynamic import.**
  Cropper is only mounted when the user opens the image-crop modal, but was statically imported, shipping the whole library in the admin/cafe initial bundle. Wrapped in `next/dynamic({ ssr: false })`; cast back to `typeof CropperType` so JSX prop types still resolve.
- **3 remaining `<img>` → `next/image` migrations:**
  - `pages/partner/settings.tsx` — partner brand logo preview (`unoptimized` because user-uploaded S3 URL).
  - `components/checkin/QrZoomImage.tsx` — both the thumbnail and the fullscreen-zoom image.
  - `components/checkin/CheckinQrDialog.tsx` — `QrTile` thumbnail + fullscreen-zoom image.

### Audit findings that turned out to be non-issues
- **Multiple `useSession()` per file** (`_app.tsx` 2, `admin/dashboard.tsx` 3, `portal/dashboard.tsx` 2) — counts were inflated by the word appearing in code comments. Each file actually calls `useSession()` exactly once.
- **`date-fns` named imports** — modern bundlers tree-shake `import { format, isToday } from "date-fns"` correctly; no win from switching to subpath imports.
- **`lucide-react` (114 sites)** — already tree-shaken per-icon at build; no aggregate-bundle issue.
- **`framer-motion` (7 sites)** — already lazy-loaded transitively where it matters (below-the-fold sections via `next/dynamic`); the remaining uses are small.

### Audit findings deferred
- **`requireSessionSSP.ts` JSON-stringify round-trip** — necessary workaround for NextAuth's `session.user.image: undefined`; not a perf hit because gSSP runs once per request and the session object is small.
- **Repeated `(session?.user as { role?: string })?.role` cast pattern** — `src/lib/sessionScalars.ts` added with typed `getSessionRole` / `getSessionUserId` / `getSessionPartnerId` / `getSessionInstructorId` / `getSessionOnboardingCompleted`. `_app.tsx` migrated as the showcase site (4 cast sites replaced). Other 10+ sites left for organic adoption — no perf delta, just code quality. (Session 5f.)
- **Global xlsx CSS** — `react-easy-crop/react-easy-crop.css` is imported in `_app.tsx` so it ships to every page. CSS-side-effect imports can't be dynamic-loaded in Pages Router without injecting `<link>` tags manually; not worth the complexity for ~few KB.

### Test-on-dev checklist for this batch

1. **Admin finance export** — click `Export` on `/admin/dashboard` Finance tab. Should still produce a working `.xlsx` (slight delay on first click while xlsx loads).
2. **Admin café crop** — upload an image at `/admin/cafe`. Crop modal should still appear and produce a cropped output (brief skeleton-flash while Cropper chunk loads).
3. **Partner brand logo** — `/partner/settings` should still render the logo preview circle.
4. **QR images** — open `/admin/cafe` check-in dialog (admin) or instructor-portal check-in pill; click any QR to zoom. Should render via `next/image` (unoptimized).
5. **Network tab on admin dashboard** — initial bundle should NOT include `xlsx-*.js` until export clicked, and admin/cafe should NOT include `react-easy-crop-*.js` until crop modal opens.

### Total: ~75 items across five sessions. Tracker still has zero open items.

---

## Session 2026-05-29 (f) — implementing remaining deferred items

User asked to push the deferred-but-implementable items. Picked the high-confidence ones; left the genuinely risky/marginal ones with their existing deferred reasons intact.

### What landed
- **`MemberMobileDashboard.tsx`** — `quickBookTiles` array `useMemo([router, onShowOrderHistory])`. Was reallocating 4 closures per render. (Was `[-]`; now `[x]`.)
- **`pages/classes.tsx` book-button prefetch** — added `useEffect` that calls `router.prefetch("/portal/book")` (or login URL for unauth) when `authStatus` flips. Same perceived-speed win as a static `<Link>` without changing `handleBookClass`'s auth-conditional behaviour. (Was `[-]`; now `[x]`.)
- **`next.config.mjs` `remotePatterns` tightening** — `**` replaced with explicit `**.amazonaws.com`, `**.cloudfront.net`, `images.unsplash.com`. Shrinks the optimizer cache-key space + hostname-spoof attack surface. NOTE comment added warning about custom-domain CDNs. (Was `[-]`; now `[x]`.)
- **`src/lib/sessionScalars.ts`** — new typed helper module: `getSessionRole`, `getSessionUserId`, `getSessionPartnerId`, `getSessionInstructorId`, `getSessionOnboardingCompleted`. Replaces the `(session?.user as { role?: string })?.role` cast pattern that was spread across 10+ sites. `_app.tsx` migrated as the showcase site (4 cast sites cleaned up); rest of the codebase can pick it up organically.

### Stale entries resolved
- **`pages/shop/[id].tsx`** catalog refetch dedup — was already fully SSG'd via `getStaticProps` + `getStaticPaths` in session 3; deferred entry was stale.

### Still genuinely deferred (reasons unchanged)
- **`admin/TodayClassesCarousel.tsx`** per-card memo — would need to thread 6+ handlers through `<CarouselCard>` props; touches ~200 lines of conditional rendering. Marginal benefit given `tick` only fires once per minute on a ≤10-item list.
- **`admin/ControlAnalyticsPanel.tsx`** BarRow extraction — heterogeneous bar shapes need a wide prop API or multiple variants. Best done after the panel is split into per-section files.
- **`components/Hero.tsx`** lazy-mount — mobile-only IntersectionObserver complexity outweighs the saved bytes now that `preload="metadata"` is in place.
- **`components/Instructors.tsx`** memo — already lazy-loaded via `next/dynamic` from the landing page; custom `<picture srcSet>` resists trivial memoization.
- **`pages/_app.tsx` partner-profile flash** — now SWR-cached + write-side mutated. The remaining one-RTT flash on cold-load would need the chrome lifted out of `_app` — bigger refactor than the cosmetic win justifies.
- **`lib/razorpayCheckout.ts` SDK preload** — current on-demand DOM-inject is intentionally correct. Preloading SDK globally would ship it to pages that never checkout.
- **eslint-disable cleanup** (33 sites) — most disables are intentional; mechanical pass carries regression risk for no perf gain.
- **`components/Hero.tsx` poster JPEGs** — needs uploaded assets, not a code-only change.

### Total: ~80 items across six sessions. Tracker still has zero open items.

---

## Bundle (CRITICAL)

- [x] `admin/dashboard.tsx` — recharts (11 components) wrapped in `next/dynamic({ssr:false})`
- [x] `admin/control.tsx` — `ControlAnalyticsPanel` (~700 lines) dynamic
- [x] `admin/schedule/[id].tsx` — edit + status dialogs gated with `{open && ...}` so JSX subtrees are skipped when closed
- [x] `components/checkin/CheckInScanButton.tsx` — `ScanCheckInModal` (camera/jsqr) via `next/dynamic({ssr:false})`; only mounts when `open=true`
- [x] `portal/book.tsx` — razorpay helpers (`payWithRazorpayOrder`, `razorpayPaymentErrorHelp`, `completePendingBookingCheckout`, `completePendingPackageCheckout`) all migrated to dynamic `import()` inside handlers
- [x] `portal/packages.tsx` — same razorpay helpers dynamic
- [x] `admin/schedule/[id].tsx` — edit + status dialogs gated with `{open && ...}` so JSX subtrees are skipped when closed
- [x] `lib/financeReportExport.ts` — `xlsx` (~150KB gzip) switched from `import * as XLSX from "xlsx"` to `await import("xlsx")` inside `downloadFinanceReportExcel`. Caller `void`-awaits the now-async function. Library only ships on Export click. (Session 5e audit win.)
- [x] `pages/admin/cafe.tsx` — `react-easy-crop` switched from static `import Cropper` to `dynamic(() => import("react-easy-crop"), { ssr: false })` cast as `typeof CropperType` for JSX prop typing. Cropper only loads when the crop modal opens. (Session 5e audit win.)

## Scroll / event listeners

- [x] `pages/cafe.tsx` — scroll listener rAF-throttled; `getBackgroundColor` pure module fn
- [x] `components/Instructors.tsx` — scroll listener now rAF-throttled + DOM-ref mutation; was setState-per-pixel re-rendering the whole instructor list
- [x] `components/Navigation.tsx` — scroll listener now rAF-throttled + compare-and-skip; only `setState` when the 24-px threshold actually flips

## Polling visibility pause

- [x] `components/checkin/CheckinBeacon.tsx` (60s) — pause when `document.hidden`
- [x] `components/checkin/CheckinQrDialog.tsx` (15s)
- [x] `components/checkin/InstructorCheckinBeacon.tsx` (1s, also stops when no window active)
- [x] `pages/admin/cafe.tsx` (10s)
- [x] `pages/admin/kitchen/index.tsx` — 20s poll now pauses when `document.hidden`; re-fires on `visibilitychange` resume

## Duplicate fetch dedup

- [x] `pages/admin/cafe.tsx` — `fetchOrders` + `fetchOrderHistory` merged into one `fetchAllOrders`
- [x] `pages/admin/CRM.tsx` — analytics now derived from `messages` via `useMemo` (single `/messages` fetch); landed in earlier pass, verified L317-319.
- [x] `pages/shop/[id].tsx` — fully SSG'd via `getStaticProps` + `getStaticPaths` (session 3); product + catalog both returned as props, no client fetch left. Stale deferred entry resolved.

## Hoist module-level constants

- [x] `components/Hero.tsx` — `moveMedia`, `refuelMedia`
- [x] `pages/cafe.tsx` — `analogImages`, `heroMedia`, `galleryImages`
- [x] `pages/cafe/meal-subscription.tsx` — `heroImages`
- [x] `pages/portal/menu.tsx` — `CATEGORIES`
- [x] `components/Pricing.tsx` — `classPassPackages`, `studioPassPackages` hoisted
- [x] `components/Founder.tsx` — `features`, `stats` hoisted
- [x] `components/dashboard/PathToMastery.tsx` — framer `LIST_VARIANTS`, `ITEM_VARIANTS` hoisted (was destabilizing motion stagger on parent rerenders)
- [x] `components/dashboard/mobile/MemberMobileDashboard.tsx` — `quickBookTiles` array `useMemo([router, onShowOrderHistory])`; no longer reallocates 4 closures per render of the mobile dashboard. (Session 5f.)

## Derived state via setState → `useMemo`

- [x] `admin/members.tsx` — `filteredMembers`
- [x] `admin/credits.tsx` — `filteredTransactions`
- [x] `portal/menu.tsx` — `filteredItems`
- [x] `portal/book.tsx` — `calculateTotals` wrapped in `useCallback`; `totals` cached via `useMemo` (was invoked twice per render)
- [x] `admin/products.tsx` — order totals into single-pass `useMemo`; filteredProducts/paginatedProducts/paginatedOrders memoized; toLowerCase haystack once per filter call
- [x] `admin/TodayClassesCarousel.tsx` — `nextIndex` IIFE → `useMemo`
- [x] `admin/ControlAnalyticsPanel.tsx` — `maxRev` + `maxGrowth` `useMemo`
- [x] `portal/packages.tsx` — `recommendedIndex`, `pagedHistory` `useMemo`
- [x] `portal/bookings.tsx` — sort precomputes `startMs` once per booking (was building a Date per compare); `sortedBookings` + `paginatedBookings` `useMemo`
- [x] `pages/classes.tsx` — `filteredClasses` `useMemo`; `activeTab` effect now depends on `router.query.tab` scalar (not object)
- [x] `portal/bookings.tsx` — `sortedBookings` + `paginatedBookings` already `useMemo` (landed in earlier pass; verified at L295/L302).
- [x] `portal/dashboard.tsx` — `activeMilestones` `useMemo`; combined `currentMilestone`+`nextMilestone` single-pass `useMemo`; `statItems`/`upcomingEntries`/`orderRows` all wrapped in `useMemo` so memoized children get stable refs
- [x] `pages/classes.tsx` — `activeTab` effect now depends on scalar `queryTab = router.query.tab` (with explanatory comment); already in tree from earlier pass.

## Session-object deps → scalar role/id

- [x] `pages/admin/dashboard.tsx` — 6 effects
- [x] `pages/admin/credits.tsx`
- [x] `pages/admin/cafe.tsx`
- [x] `pages/portal/dashboard.tsx`
- [x] `pages/portal/menu.tsx`
- [x] `pages/admin/schedule.tsx` — `userRole` scalar; loadDbData+loadSchedule via Promise.all (was sequential)
- [x] `pages/admin/control.tsx` — `userRole` scalar
- [x] `pages/shop.tsx` — `sessionEmail` scalar
- [x] `pages/instructor/dashboard.tsx` — `userRole` + `userName` scalars; `selectedClassId` via ref to stabilize `loadData`
- [x] `pages/partner/classes.tsx` — drop `rangeStart`/`rangeEnd` Date deps; `rangeKey` already encodes them
- [-] `pages/admin/members.tsx` (eslint-disable masks — low impact, keep as-is)
- [-] `pages/cafe.tsx` — no `router`/`session` deps left after hoist; not worth further touching
- [-] `pages/classes.tsx` — already migrated to `router.query.tab` scalar earlier
- [-] `pages/cafe/meal-subscription.tsx` — no `router`/`session` deps

## setTimeout cleanup

- [x] `components/CheckoutModal.tsx`
- [x] `pages/portal/menu.tsx`
- [x] `pages/partner/settings.tsx`

## Re-render storms (extract memoized child)

- [x] `admin/dashboard.tsx` (4972 → 2347 lines, -2625, -52.8%) — all 8 tabs split into own files + React.memo. Unused imports + dead helpers (`parseYYYYMMDDLocal`, `txnPassesDateRange`, `formatTxnAmountRupee`, `formatInrDetail`) removed.
  - **CHART FIX**: recharts components MUST be statically imported, not wrapped in `next/dynamic` per-component — recharts inspects children's class to decide layout, dynamic wrappers break that. Each chart-tab file imports recharts statically; the tab itself is `next/dynamic` from dashboard, so recharts JS still defers until tab opens.
- [x] `admin/MetricCard.tsx` — `React.memo` (used 50+ times across dashboard — was re-rendering on every parent state tick)
- [x] `admin/DayScheduleList.tsx` — `toggleSort` wrapped in `useCallback`; sort wrapped in `useMemo` (was sorting on every render)
  - [x] `meal-waitlist` tab → `dashboard-tabs/MealWaitlistTab.tsx` (memoed)
  - [x] `rental-inquiries` tab → `dashboard-tabs/RentalInquiriesTab.tsx` (memoed)
  - [x] `pricing` tab → `dashboard-tabs/PricingTab.tsx` (memoed); handlers wrapped in `useCallback`
  - [x] `instructors` tab → `dashboard-tabs/InstructorsTab.tsx` (memoed + `next/dynamic` lazy); chart data memoized; pagination internal
  - [x] `classes` tab → `dashboard-tabs/ClassesTab.tsx` (memoed + `next/dynamic` lazy); chart data memoized; pagination internal
  - [x] `members` tab → `dashboard-tabs/MembersTab.tsx` (memoed + `next/dynamic` lazy); filter/sort/pagination internal; `handleViewProfile` wrapped in `useCallback`
  - [x] `finance` tab → `dashboard-tabs/FinanceTab.tsx` (memoed + `next/dynamic` lazy); txn filters/search/pagination/detail-dialog internal; `handleExportFinance` wrapped in `useCallback`
  - [x] `overview` tab → `dashboard-tabs/OverviewTab.tsx` (memoed + `next/dynamic` lazy); `selectedMembers` checkbox state internal; `handleSelectOverviewClass` wrapped in `useCallback`
- [x] `admin/DayScheduleList.tsx` — sort wrapped in `useMemo`, `toggleSort` in `useCallback` (landed in earlier pass; verified L174,L183). Per-row TableRow memo deferred (small list, marginal benefit).
- [-] `admin/TodayClassesCarousel.tsx` — carousel typically renders ≤10 cards; extracting a memoed `<CarouselCard>` would touch ~80 lines of conditional rendering for marginal benefit. Deferred.
- [-] `admin/ControlAnalyticsPanel.tsx` — 11 bar-row sections have heterogeneous shapes (₹k display vs pct vs count vs share). A single `<BarRow>` would need a wide prop API; multiple variants would duplicate. Deferred until the panel is split into per-section files (similar to the dashboard-tabs refactor).
- [x] `admin/MetricCard.tsx` — already `memo(MetricCardImpl)` at L130 (landed in earlier pass).
- [-] `components/Instructors.tsx` — section is now `next/dynamic`-loaded from `pages/index.tsx`, so the cost only hits visitors who scroll. Plus it already uses a custom `<picture srcSet>` pipeline that resists trivial memoization. Deferred.
- [x] `portal/book.tsx` — extracted memoized `BookClassCard`; `handleSelectClass` wrapped in `useCallback` so memo actually skips rerender when only unrelated page state changes (food qty, friends/family typing, coupon validate)
- [x] `portal/book.tsx` — café row extracted into memoized `<FoodRow>` (mirrors `BookClassCard` pattern); `handleFoodQuantity` wrapped in `useCallback` so qty tick on one item no longer re-renders every other row.
- [x] `portal/bookings.tsx` — single memoized `BookingCard` replaces dual mobile-card + desktop-card render (was 2× DOM per booking); `ResponsiveCards` no longer needed
- [x] `portal/dashboard.tsx` — `mobileQuickActions` array `useMemo([router])`; was allocating 4 fresh closures per render.

## Iteration hotspots (`js-index-maps`, `js-combine-iterations`)

- [x] `admin/CRM.tsx` — `TEMPLATE_TYPES`/`TRIGGER_TYPES` hoisted to module scope; `templateLabelById`/`triggerLabelById` Maps replace `.find()` in table rows
- [x] `admin/schedule.tsx` — `dbClassById` + `dbInstructorById` Maps (`useMemo`); `getClassName`/`getClassCapacity`/`getInstructorName`/`getInstructorAvatar` now O(1) lookups
- [-] `admin/control.tsx` L656 — `users.find` runs once per `editUser` query change (not per render); skip
- [x] `admin/products.tsx` — `categoryById` Map (landed earlier)
- [x] `admin/cafe.tsx` — `categoryLabelById` Map; replaces `categories.find()` per menu item row
- [x] `admin/schedule/[id].tsx` — `enrolled`/`checkedIn` combined into single-pass `useMemo` (was two scans over bookings)
- [x] `admin/kitchen/index.tsx` — three filter scans collapsed into one `useMemo` pass producing `{active, pendingCount, completedToday}`
- [x] `portal/dashboard.tsx` — L201 `activeMilestones` memoized earlier; L312/346 chains live inside `fetchUserData` (fetch-time only, not per-render)
- [x] `portal/menu.tsx` — `categoryLabelById` Map from module-scope `CATEGORIES`; replaces `categories.find()` per menu card
- [x] `instructor/dashboard.tsx` — single-pass `useMemo` produces `totalEnrolled` + `totalCheckedIn` + `classesByDay` (was 3 separate scans per render); `classById` Map replaces `classes.find()` for `selectedClass`
- [x] `portal/book.tsx` — `startTimeMs` precomputed on each class in the transform; both sort callsites (initial sort + filter-sort) compare integers (was `new Date(.startTimeIso).getTime()` per compare)
- [x] `portal/book.tsx` L839 — sequential `await fetch` in loop → `Promise.all` (café orders fire concurrently)
- [x] `pages/classes.tsx` — 7×N filter → single bucket pass via `floor((itemMs - weekStartMs)/MS_PER_DAY)`
- [x] `shop.tsx` — lowercased haystack precomputed once per `products` change (was 5× toLowerCase per product per keystroke)
- [x] `shop/[id].tsx` — `addItem(item, qty)` overload; single setState (was N rerenders looping `addItem`)

## Waterfalls (`async-parallel`)

- [x] `admin/CRM.tsx` — templates/messages/triggers fired via `Promise.all`; analyticsData derived from `messages` via `useMemo` (no second `/api/admin/crm/messages` fetch)
- [x] `admin/schedule.tsx` — loadDbData + loadSchedule via `Promise.all` (was sequential)
- [x] `profile/ProfileSection.tsx` — profile + tickets via `Promise.all` (was sequential)

## Subtle bugs

- [x] `components/CheckoutModal.tsx` L83 — setTimeout leak (fixed via cleanup)
- [x] `components/CheckoutModal.tsx` — `setFormData` now uses functional updater (was racy under fast typing)
- [x] `components/Instructors.tsx` — `document.body.style.overflow` restored on unmount (no more leak on route change with modal open)
- [x] `profile/ProfileSection.tsx` — avatar PUT now checks `!ok` and toasts on failure (was silent S3 fail)
- [x] `components/checkin/CheckinBeacon.tsx` — drag listeners now bound once via `useEffect([], [])`; latest `dragging`/`pos` read via refs (was re-attaching window listeners on every pixel of drag)

## Cross-cutting (project-wide)

- [x] SWR migration — partial.
  - `swr@^2.4.1` installed; `src/lib/swr.ts` wraps `useSWR` with a `jsonFetcher` + project defaults (`dedupingInterval: 15s`, `revalidateOnFocus: true`, `keepPreviousData: true`). Exports `useStudioSWR`.
  - `/api/user/profile` migrated in `_app.tsx` (DashboardChrome avatar) and write-side cache-bust added in `components/profile/ProfileSection.tsx` (`mutate("/api/user/profile")` after avatar upload). Navigating to `/account` no longer refetches; uploading a new avatar updates the topbar instantly.
  - `/api/partner/profile` migrated in `_app.tsx` (DashboardChrome partner brand) and write-side cache-bust added in `pages/partner/settings.tsx` after save.
  - `/api/cafe/items?available=true` migrated in `pages/portal/menu.tsx`. Admin write paths (delete/save/seed-defaults) in `pages/admin/cafe.tsx` now `mutate("/api/cafe/items?available=true")` so member-facing pages refresh live.
  - **Deferred**: `pages/portal/book.tsx` cafe migration (foodItems has user-mutated `quantity` field — needs careful state-vs-server separation, risky). `/api/class-schedules` migration (date-windowed URL keys vary per consumer, modest cross-page dedupe value).
- [x] Razorpay `<script>` strategy — verified. SDK is DOM-injected on first checkout click (`lib/razorpayCheckout.ts`), never `beforeInteractive`. Preconnect added to `_document.tsx` to warm the origin earlier.
- [-] Remove `eslint-disable react-hooks/exhaustive-deps` sites — 33 sites across the codebase. Most disables are intentional (functional setters + stable handlers via refs + `router.events` is itself stable). Mechanical pass-through carries regression risk for negligible perf benefit. Best handled organically as each file is touched for other reasons. Deferred.

## Up/Down sort on all admin dashboard tables

Shared infra at `src/components/admin/sortable-table.tsx`:
- `useTableSort<T, K>(items, { initialKey, initialDir, getValue, defaultDirFor })` — sort hook with stable `toggle`
- `<SortableHeader sortKey active dir onToggle>` — wraps `TableHead`, shows up/down/inactive chevrons

Applied to:
- [x] `InstructorsTab` — sort by Instructor / Rating / Classes / Check-Ins / Avg Attendance / Earnings (default: Check-Ins desc)
- [x] `ClassesTab` — sort by Class / Discipline / Spots / Utilization (default: Utilization desc)
- [x] `FinanceTab` — sort by Category / Member / Date / Method / Amount (default: Date desc; expense amounts ordered as negatives)
- [x] `PricingTab` — sort by Code / Scope / Discount / Uses / Status; pagination moved internal
- [x] `MealWaitlistTab` — sort by Date / Name / Status; pagination moved internal
- [x] `RentalInquiriesTab` — sort by Date / Name / Event / Status; pagination moved internal
- [x] `MembersTab` — already had per-column sort (pre-existing)
- [x] `DayScheduleList` — already had per-column sort (pre-existing)

Non-dashboard admin tables (sort already worked on some columns; added missing + migrated visuals to shared `SortableHeader` where applicable):

- [x] `admin/members.tsx` — added sort on **Pass** and **Account** columns (was: Name/Classes/Last Visit/Status only); all inline buttons migrated to `SortableHeader`
- [x] `admin/credits.tsx` — migrated inline sort buttons to `SortableHeader`; removed obsolete `sortIcon` helper
- [x] `admin/badges.tsx` — migrated PTM badges table inline sort buttons to `SortableHeader`; removed obsolete `ptmSortIcon` helper
- [x] `admin/control.tsx` users table — added sort on **Pass / Remaining / Start** (was: Name/End/Status only)
- [x] `admin/control.tsx` payouts table — added sort on **Rate / Share** (was: Instructor/Check-ins/Total/Status only)

---

# Round 2 — New findings (component + Next.js scan)

Fresh scans against files NOT previously reviewed + Next.js Pages Router-specific patterns. Ordered roughly by impact.

## R2 · React rerender / leak (highest leverage)

- [x] `contexts/CartContext.tsx` — `value` wrapped in `useMemo`; `addItem`/`removeItem`/`updateQuantity`/`clearCart` wrapped in `useCallback` (empty deps; all use functional setState). `itemCount`+`subtotal` collapsed into single-pass `useMemo([items])`. `updateQuantity` inlined remove path (no cross-handler dep).
- [x] `components/responsive/ResponsiveDialog.tsx` — single `RespCtx` context; only the Root calls `useIsMobile()`, all parts read context. Value frozen for the open session (snapshot on open, cleared on close) so resize across 768px no longer unmount/remount the subtree mid-edit.
- [x] `hooks/useActivityTracking.ts` — pageview effect now `[]` deps with `statusRef` for live status read (was re-binding listener + re-firing initial `page_view` on every router/session tick). 15s flush interval paused on `document.hidden`; flushes once + restarts on `visibilitychange` resume.
- [x] `components/checkin/ClassCountdownPill.tsx` — 1-Hz tick paused on `document.hidden`; resumes on visibilitychange (with immediate `setNow` so the label snaps fresh). `startMs`/`endMs` `useMemo([startIso, endIso])` — no more 60 `new Date()` parses per minute.
- [x] `components/checkin/InstructorCheckinBeacon.tsx` — `active` + `anyEverActive` collapsed into single-pass `useMemo([classStarts, now])` (no `Date.now()` during render; one loop instead of `some` + `filter` + `sort`). Interval now genuinely stops on `document.hidden` (not just early-returns) and snaps fresh on visibilitychange resume.
- [x] `components/dashboard/AnimatedIcon.tsx` — wrapped in `React.memo`; `initial`/`animate`/`transition` literals hoisted to module-scope constants (`INITIAL_MOUNT`, `ANIMATE_MOUNT`, `SPRING_TRANSITION`) so every instance shares stable refs. With primitive props (icon ref, size, hover string) equal, memo now actually skips renders.
- [x] `hooks/useAuthWeather.ts` — `palette` + `greeting` both `useMemo([weather])`; `new Date()` only called when weather payload changes.
- [x] `components/admin/dashboard-tabs/FinanceTab.tsx` — row body extracted into `FinanceRowView` (React.memo); click handler hoisted to `handleSelectFinance` (`useCallback`) so memo doesn't bust on identity. `REVENUE_TREND_PLACEHOLDER` array hoisted to module scope (was re-allocated every render).
- [x] `components/admin/dashboard-tabs/ClassesTab.tsx` — Peak-Hours heatmap cells extracted into memoized `<HeatCell>`; intensity/opacity/title now computed inside the cell (per-cell skip on parent rerenders).
- [x] `components/admin/dashboard-tabs/MembersTab.tsx` — `displayedMemberStats` + `activeMemberTierTotal` both wrapped in `useMemo` with scalar deps (was reallocating the spread object every render even when nothing changed).
- [x] `components/admin/dashboard-tabs/OverviewTab.tsx` — `todayIso`/`y`/`m`/`d`/`dateTitle` collapsed into single `useMemo([scheduleDate])`; carousel `items` now memoized via `carouselItems = useMemo([todayClassesDetail, upcomingClasses])` (was rebuilding 10-key shape per render, forcing `TodayClassesCarousel` to re-diff every card on unrelated state changes).
- [x] `components/dashboard/UpcomingScheduleCard.tsx` — `formatWhen` precomputed per entry in `useMemo([entries])`; rendered row reads cached `when` string (was reparsing Date + 2× `toLocale*` per row per render).
- [x] `components/dashboard/OrderHistoryTable.tsx` — display strings (dateLabel, statusBadge, statusBadgeClass, methodLabel) precomputed per row in `useMemo([rows])`; row body extracted into `OrderRowView` wrapped in `React.memo` so unchanged rows skip render.
- [x] `components/dashboard/VitalityAreaChart.tsx` — `data` `useMemo([series])`; recharts no longer re-diffs paths on parent rerenders.
- [x] `components/dashboard/PathToMastery.tsx` — `pct`/`gradient`/`trackLeft`/`trackSpan` collapsed into single `useMemo([milestones, classesCompleted])`; unused `target` dropped. (Extracting `<MilestoneTier>` deferred — would need to thread color/earned/isCurrent/tier handlers, low marginal value given the math now memoized.)
- [x] `components/auth/SignUpForm.tsx` — removed `useWatch({name:"password"})`; password read inside the onChange via `getValues("password")` (was rerendering the entire form on every keystroke).
- [x] `components/checkin/CheckinBeacon.tsx` — explicit staleness comment added to `badgeLabel`: 60s poll cadence matches the badge's minute resolution, so no separate `setInterval` needed; label intentionally freezes while tab hidden (poll paused) and snaps fresh on visibilitychange.
- [x] `components/checkin/CheckinQrDialog.tsx` — `validUntil` `useMemo([data?.startTime])` (was reparsing + reformatting Date every render).
- [x] `components/checkin/ClassCheckinQr.tsx` — `isFinder` + 169-cell `cells` array hoisted into module-scope `FAKE_QR_CELLS` IIFE (computed once at import, rendered identically every time).
- [x] `components/responsive/MobileBottomNav.tsx` — `all`/`overflow`/`showMore`/`showScanner`/`slots` collapsed into single `useMemo([config])`; `Map`/`Set` allocations + `flattenNavItems` only run on config change, not on every route push.
- [x] `components/SEO.tsx` — `DEFAULT_OG_IMAGE` + `FAVICON_SVG` + `FAVICON_ICO` hoisted to module consts (`cdnUrl` was being re-evaluated on every `<SEO>`/`<SEOElements>` render).
- [x] `components/admin/NumberTicker.tsx` — added `currentRef` updated inside rAF; `fromRef.current = currentRef.current` (was reading the stale render-time `value` snapshot, which lagged the actually-displayed number on rapid `end` changes).

## R2 · Next.js Pages Router optimization (highest leverage)

### Marketing pages — SSR per request → should be SSG/ISR

- [-] `pages/index.tsx` · `founder.tsx` · `rental.tsx` · `policy.tsx` · `terms.tsx` — no data deps, no `useSession`, no `getServerSideProps`/`getInitialProps`. Pages Router already statically optimizes these at build (`Automatic Static Optimization`). Adding an empty `getStaticProps` is a no-op vs current behavior.
- [-] `pages/cafe.tsx` — gallery static but page imports interactive components + a scroll listener; conversion to `getStaticProps` provides no TTFB benefit since the page already has no data dep. Skipped.
- [x] `pages/classes.tsx` — class catalog now served via `getStaticProps` + 5-min ISR (direct Prisma read with same `omit` policy as `/api/classes`). Client `fetchClasses` + `fetchClassesList` helper dropped. Schedule still client-fetched (date-windowed, changes more often).
- [x] `pages/shop.tsx` — `getStaticProps` + 60s ISR; initial product list seeded from server (Prisma direct). `useEffect` fetch dropped; SEO crawlers + first paint now see content immediately.
- [x] `pages/shop/[id].tsx` — `getStaticPaths` (featured products pre-rendered) + `fallback: "blocking"` for the long tail; `getStaticProps` returns product + catalog with 60s ISR. Missing/inactive products use Next's built-in `notFound: true` (no more client `useEffect` flicker).

### Bundle / code splitting

- [x] `pages/index.tsx` — `Instructors`, `Pricing`, `Founder`, `Rental`, `Boutique`, `Testimonial` wrapped in `next/dynamic`. SSR kept on so SEO crawlers still see content; only the JS download for these sections is deferred. Above-the-fold `Navigation`, `Hero`, `ClassCatalog`, `Footer` stay static-imported.
- [x] `pages/portal/dashboard.tsx` — `MemberMobileDashboard` now `next/dynamic({ ssr: false, loading: MemberMobileDashboardSkeleton })`; desktop visitors never download the mobile bundle.
- [x] `components/Pagination.tsx` — `framer-motion` import dropped; active-page pill switched to CSS `transition-colors` on the link itself (no FLIP). One less framer instance per dashboard page that uses Pagination.

### Hero / LCP

- [-] `components/Hero.tsx` lazy-mount — all three panels are above-the-fold on desktop (grid layout); on mobile they stack so only Panel 1 is above-fold. A mobile-only `IntersectionObserver` lazy-mount adds non-trivial complexity for limited benefit (videos now use `preload="metadata"` so the wasted bytes are small). Deferred.
- [x] `components/Hero.tsx` — all four hero videos now `preload="metadata"` (default `auto` was pulling full MP4 on first paint).
- [-] `components/Hero.tsx` poster attribute — deferred. Requires per-video poster JPEGs uploaded to S3; out of scope for code-only pass.

### Auth flash-of-content (FOUC)

- [x] Shared `requireSessionSSP({ roles })` helper at `src/lib/requireSessionSSP.ts`; redirects to `/login?redirect=<path>` for unauth and to `/login` for wrong-role. Applied to **15 pages**:
  - **Admin** (role `admin`): `admin/dashboard`, `admin/control`, `admin/credits`, `admin/members`, `admin/schedule`, `admin/CRM`, `admin/badges`, `admin/partners`, `admin/products`
  - **Admin OR chef**: `admin/cafe`
  - **Instructor** (role `instructor`): `instructor/dashboard` — also dropped the now-redundant client-side redirect dance.
  - **Partner**: `partner/dashboard` — already had gSSP (verified).
  - **Authenticated** (any role): `portal/dashboard`, `portal/book`, `portal/bookings`, `portal/packages`, `portal/menu`
  - **Skipped**: `portal/profile` already redirects to `/account` (which has its own gSSP); `portal/onboarding` deliberately not gated (user must be authed but NOT-yet-onboarded). `admin/dashboard` also dropped the client-side redirect dance + `useEffect` since gSSP guarantees the role.
  - **Approach**: additive — kept the existing `useSession` hook inside each component so downstream effects keying on `status`/`session?.user?.role` continue to work as a belt-and-suspenders fallback for mid-session expiry. Only the redirect dance was removed where it had been there before.

### Image optimization (`<img>` → `next/image`)

- [x] `components/Footer.tsx` — logo migrated to `next/image` (`width=200 height=64`); `LOGO_URL` hoisted to module const.
- [-] `components/Instructors.tsx` — already uses `<picture>` with explicit `srcSet`/`sizes` + `?format=webp&width=…` query params (custom image pipeline). Migrating to `next/image` would lose the explicit srcset; keep as-is.
- [x] `components/Testimonial.tsx` — portrait migrated to `next/image` (`width=64 height=64`).
- [x] `components/profile/ProfileSection.tsx` — avatar preview migrated (`width=96 height=96`, `unoptimized` because user-uploaded S3 URL).
- [x] `pages/instructor/dashboard.tsx` — `MemberAvatar` migrated (`width=36 height=36`, `unoptimized`).
- [x] `pages/admin/schedule.tsx` — booking avatar migrated (`unoptimized`).
- [x] `pages/admin/cafe.tsx` — three menu-item images migrated (`unoptimized`); avoided `Image` constructor collision by qualifying as `new window.Image()` in the cropper.
- [x] `pages/admin/control.tsx` — five class/instructor preview images migrated (`unoptimized`).
- [x] `pages/partner/settings.tsx` — partner brand logo preview migrated (`width=64 height=64`, `unoptimized`). (Session 5e audit win.)
- [x] `components/checkin/QrZoomImage.tsx` — both thumbnail (`width={size} height={size}`) and fullscreen zoom (`width=800 height=800`) migrated (`unoptimized`). (Session 5e audit win.)
- [x] `components/checkin/CheckinQrDialog.tsx` — `QrTile` thumbnail (`width=240 height=240`) + fullscreen zoom (`width=800 height=800`) migrated (`unoptimized`). (Session 5e audit win.)

### Fonts

- [x] `styles/globals.css` L1-3 — Google Fonts `@import url()` removed; migrated to `next/font/google` (Playfair Display + Montserrat) in `_app.tsx`. `--font-playfair` / `--font-montserrat` CSS vars piped through `--font-display` / `--font-body` / `--font-script` / `--font-anchor` so call-sites untouched. Bricolage dropped (was imported, never used).

### Scripts

- [x] `_document.tsx` GA + Softgen — moved both to `_app.tsx` using `next/script`. GA = `strategy="afterInteractive"`; Softgen = `strategy="lazyOnload"` (was blocking-async in `<head>`, competing with first paint).
- [x] `_document.tsx` preconnect — added `preconnect` + `dns-prefetch` for `checkout.razorpay.com`. (Google Fonts hosts no longer needed — migrated to `next/font/google` which self-hosts. S3/CDN preconnect deferred — needs concrete host once we tighten `remotePatterns`.)
- [-] `lib/razorpayCheckout.ts` Razorpay SDK preload — preconnect now in place; full SDK preload via `next/script` deferred (current DOM-inject is gated to checkout click, so first paint isn't blocked).

### Navigation

- [x] `pages/classes.tsx` — added `router.prefetch("/portal/book")` (or login URL for unauth) on `authStatus` change. Same perceived-speed win as a static `<Link>` without changing the conditional auth behaviour of `handleBookClass`. (Session 5f.)

### API routes — caching + payload

- [x] `pages/api/retail-products.ts` — `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` on both detail + list paths. (Column slimming via `select` deferred — current shape is the documented public response.)
- [x] `pages/api/cafe/items.ts` — anon GET now `public, s-maxage=30, stale-while-revalidate=120`.
- [x] `pages/api/classes.ts` — `public, s-maxage=300, stale-while-revalidate=600`; `instructor` join now uses `omit: { studio_payout_cut_percent, hashed_password }` to plug the sensitive-field leak (was `include: instructor` returning everything).
- [x] `pages/api/packages.ts` — public list GET now `public, s-maxage=300, stale-while-revalidate=600`.
- [x] `pages/api/class-schedules.ts` — anon (no NextAuth session cookie) gets `public, s-maxage=60, stale-while-revalidate=300`; auth path keeps `private, no-store`.
- [x] `pages/api/user-stats.ts` — `private, max-age=10, stale-while-revalidate=60` to dedupe portal-dashboard refetches without leaking across users.
- [-] `pages/api/admin/badges.ts` — admin-only endpoint; `BadgeTemplate` has no sensitive fields and the row count is small (≤ a few dozen). Payload-size win is negligible; skipped.

### Session / NextAuth

- [x] `pages/_app.tsx` — `DashboardChrome` now reads scalar `userName`/`userEmail`/`userRole` once; `shellUser` wrapped in `useMemo` with scalar deps so the 4-min session refetch can't cascade rerenders through `DashboardShell`. `OnboardingGate` effect depends on scalar `onboardingCompleted` instead of the full `session` object.
- [-] `pages/portal/dashboard.tsx` — `session` already used only to derive scalar `sessionUserId`; effects depend on `status` + `sessionUserId`, not the full session object. No change needed.
- [x] `pages/classes.tsx` — switched from `{ data: authSession }` to `{ status: authStatus }`; `handleBookClass` checks `authStatus !== "authenticated"` instead of object presence.
- [-] `pages/_app.tsx` L67 — `/api/partner/profile` now SWR-cached + write-side `mutate`d on save. Brief topbar flash on first paint remains (one network round-trip), but cross-page navigation reuses the cache. Full SSR via per-page gSSP for the topbar specifically would require lifting the chrome out of `_app` — deferred.

### Build config

- [x] `next.config.mjs` — `images.minimumCacheTTL: 31536000` added (one-year CDN cache; image URLs are S3 content-addressed, new uploads change the key).
- [x] `next.config.mjs` `remotePatterns` — tightened from `[{ hostname: "**" }]` to an explicit allowlist: `**.amazonaws.com` (S3 bucket — `copper-cloves.s3.ap-south-1.amazonaws.com`), `**.cloudfront.net` (CDN), `images.unsplash.com` (testimonial portraits). Admin-pasted arbitrary URLs already go through `<Image unoptimized>` so they bypass this allowlist. NOTE comment added warning that a custom-domain CDN needs explicit entry. (Session 5f.)
- [-] `next.config.mjs` `/fonts/*` cache headers — N/A. Fonts now self-hosted by `next/font/google`, which emits immutable cache headers automatically. No custom font dir to configure.

## R2 · Highest-leverage shortlist (recommended order)

1. **`next/font/google` migration** (drop Google Fonts `@import` from `globals.css`) — biggest LCP win for every marketing page in one change.
2. **`CartContext` value memoization** — cuts rerenders of cart consumers app-wide.
3. **`ResponsiveDialog` single-`useIsMobile` refactor** — fixes form-state-loss-on-resize + cuts matchMedia listeners.
4. **Marketing pages → `getStaticProps` + ISR** (`/`, `/founder`, `/rental`, `/policy`, `/terms`, `/cafe`, `/shop`, `/shop/[id]`, `/classes`).
5. **Hero video lazy-mount + `preload="metadata"` + `poster`** — landing LCP.
6. **`pages/index.tsx` below-the-fold sections via `next/dynamic`** — landing bundle size.
7. **Auth-gated pages → `getServerSideProps` redirect** — kills flash-of-unauth-content site-wide.
8. **Public API caching headers** (`/api/retail-products`, `/api/cafe/items`, `/api/classes`, `/api/packages`, `/api/class-schedules` for anon).
9. **Image migration to `next/image`** across the file list above.
10. **Background tick pause** on `ClassCountdownPill` + `InstructorCheckinBeacon` (battery drain).

## Notes

- Pages Router, NOT App Router. Skip RSC `server-*` Vercel rules.
- `next.config.mjs` has `typescript.ignoreBuildErrors: true` — touched files still typecheck clean.
- Pre-existing TS errors in `scripts/seed-*`, `shadcn-space/blocks/pricing-02`, `ui/phone-input.tsx`, `lib/razorpayPersistence.ts` — out of scope.
