# Perf Tracker

Vercel React rules audit + remediation. Tracks all findings from initial scan + rescan.

Legend: `[x]` done · `[ ]` pending · `[~]` in progress · `[-]` deferred (needs discussion)

## Bundle (CRITICAL)

- [x] `admin/dashboard.tsx` — recharts (11 components) wrapped in `next/dynamic({ssr:false})`
- [x] `admin/control.tsx` — `ControlAnalyticsPanel` (~700 lines) dynamic
- [x] `admin/schedule/[id].tsx` — edit + status dialogs gated with `{open && ...}` so JSX subtrees are skipped when closed
- [x] `components/checkin/CheckInScanButton.tsx` — `ScanCheckInModal` (camera/jsqr) via `next/dynamic({ssr:false})`; only mounts when `open=true`
- [x] `portal/book.tsx` — razorpay helpers (`payWithRazorpayOrder`, `razorpayPaymentErrorHelp`, `completePendingBookingCheckout`, `completePendingPackageCheckout`) all migrated to dynamic `import()` inside handlers
- [x] `portal/packages.tsx` — same razorpay helpers dynamic
- [x] `admin/schedule/[id].tsx` — edit + status dialogs gated with `{open && ...}` so JSX subtrees are skipped when closed

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
- [ ] `pages/admin/CRM.tsx` L300 — `fetchAnalytics` re-fetches `/api/admin/crm/messages` already loaded
- [-] `pages/shop/[id].tsx` L61-105 — refetches catalog; still fetched but unblocked by detail (uses Promise.all). Deferred full dedup pending shared store/SWR.

## Hoist module-level constants

- [x] `components/Hero.tsx` — `moveMedia`, `refuelMedia`
- [x] `pages/cafe.tsx` — `analogImages`, `heroMedia`, `galleryImages`
- [x] `pages/cafe/meal-subscription.tsx` — `heroImages`
- [x] `pages/portal/menu.tsx` — `CATEGORIES`
- [x] `components/Pricing.tsx` — `classPassPackages`, `studioPassPackages` hoisted
- [x] `components/Founder.tsx` — `features`, `stats` hoisted
- [x] `components/dashboard/PathToMastery.tsx` — framer `LIST_VARIANTS`, `ITEM_VARIANTS` hoisted (was destabilizing motion stagger on parent rerenders)
- [-] `components/dashboard/mobile/MemberMobileDashboard.tsx` L196 — quick-book array (closures over `router`/`onShowOrderHistory` — minor; skipped)

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
- [ ] `portal/bookings.tsx` L198 — `sortedBookings`, `paginatedBookings`
- [x] `portal/dashboard.tsx` — `activeMilestones` `useMemo`; combined `currentMilestone`+`nextMilestone` single-pass `useMemo`; `statItems`/`upcomingEntries`/`orderRows` all wrapped in `useMemo` so memoized children get stable refs
- [ ] `pages/classes.tsx` L451-456 — `activeTab` effect+setState → derive from query

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
- [ ] `admin/DayScheduleList.tsx` L118,175,212 — sort runs each render; TableRow not memoed; toggleSort not useCallback
- [ ] `admin/TodayClassesCarousel.tsx` L114,156 — memoized card + StatusChip
- [ ] `admin/ControlAnalyticsPanel.tsx` L181..L635 — 11 unmemoized bar-rows → BarRow memo
- [ ] `admin/MetricCard.tsx` L54 — wrap React.memo
- [ ] `components/Instructors.tsx` L355-433 — extract `<InstructorCard>` React.memo
- [x] `portal/book.tsx` — extracted memoized `BookClassCard`; `handleSelectClass` wrapped in `useCallback` so memo actually skips rerender when only unrelated page state changes (food qty, friends/family typing, coupon validate)
- [ ] `portal/book.tsx` L1502 — `FoodRow` memo (cafe-items list, similar pattern)
- [x] `portal/bookings.tsx` — single memoized `BookingCard` replaces dual mobile-card + desktop-card render (was 2× DOM per booking); `ResponsiveCards` no longer needed
- [ ] `portal/dashboard.tsx` L548-553 — memo action-button array

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

- [ ] SWR migration — `/api/class-schedules`, `/api/cafe/items`, `/api/user/profile` hit from multiple pages
- [ ] Verify Razorpay `<script>` strategy not `beforeInteractive`
- [ ] Remove `eslint-disable react-hooks/exhaustive-deps` sites — wrap loaders in useCallback

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

- [ ] `contexts/CartContext.tsx` — provider `value` is a new object every render → every `useCart` consumer (Navigation cart badge, all checkout screens, shop pages) re-renders on any parent tick. Wrap value in `useMemo`; wrap `addItem`/`removeItem`/`updateQuantity`/`clearCart` in `useCallback`.
- [ ] `components/responsive/ResponsiveDialog.tsx` — each sub-component calls `useIsMobile()` independently. A single dialog uses 4-6 of these → 4-6× matchMedia listener attach/teardown per dialog mount. Solution: single context provider that reads `useIsMobile` once and shares via context. Also: switching root component type on resize crossing 768 → unmount/remount entire subtree, losing form state mid-resize.
- [ ] `hooks/useActivityTracking.ts` L48 — pageview effect deps include `router` object → re-binds on every render. Depend on `router.events` ref or use `[]`. L51 — 15s flush interval fires while tab hidden; gate on `document.hidden` + `visibilitychange`.
- [ ] `components/checkin/ClassCountdownPill.tsx` L26-29 — 1-Hz `setInterval` runs even when tab hidden → battery drain on background instructor portal. Pause on visibilitychange. L42-43 — `new Date(startIso).getTime()` parsed every tick; cache in `useMemo` keyed on `startIso`/`endIso`.
- [ ] `components/checkin/InstructorCheckinBeacon.tsx` L31 — `anyEverActive` derives from `Date.now()` during render (impure); 1-Hz tick + small list filter/sort runs ~60 passes/min.
- [ ] `components/dashboard/AnimatedIcon.tsx` — used 50+ times across the app. Each instance ships a fresh framer `initial`/`animate`/`transition` literal object per parent render. Heavy aggregate framer cost. Memoize component; default to plain `<Icon>` and reserve `AnimatedIcon` for hover-only spots.
- [ ] `hooks/useAuthWeather.ts` L45 — palette/greeting derived via `new Date()` during render (impure); wrap in `useMemo([weather])`.
- [ ] `components/admin/dashboard-tabs/FinanceTab.tsx` L412-462 — `financeTxnPg.pageItems.map` rebuilds row JSX inline + computes `openFinance`/`displayMember`/`plus` per row per render. Extract memoized `<FinanceRow>`. L635-646 — `[45,52,48,...]` placeholder revenue array allocated each render; hoist to module scope.
- [ ] `components/admin/dashboard-tabs/ClassesTab.tsx` L270-292 — Peak-Hours heatmap nests `slots × days` with inline title strings + style objects; extract memoized `<HeatCell>`.
- [ ] `components/admin/dashboard-tabs/MembersTab.tsx` L110-153 — `displayedMemberStats = {...memberStats, ...filteredMemberStats}` spread every render; wrap in `useMemo`. `activeMemberTierTotal` also derived per render.
- [ ] `components/admin/dashboard-tabs/OverviewTab.tsx` L123-135 — `today`/`iso`/`tom`/`yest`/`pretty`/`dateTitle` recomputed per render; wrap in `useMemo([scheduleDate])`. L250 — `.map((cls:any) => ({...}))` rebuilds carousel item shape every render; memoize.
- [ ] `components/dashboard/UpcomingScheduleCard.tsx` L52-81 — `entries.map` calls `formatWhen` (Date parse + 2× toLocale*) per row per render; precompute or extract memoized `<EntryButton>`.
- [ ] `components/dashboard/OrderHistoryTable.tsx` L67-95 — `rows.map` inline with `new Date().toLocaleDateString()` per row per render; extract `<OrderRow>` memo or memoize formatted strings per row.
- [ ] `components/dashboard/VitalityAreaChart.tsx` L34 — chart `data` rebuilt each render → recharts re-renders all paths; `useMemo([series])`.
- [ ] `components/dashboard/PathToMastery.tsx` L48-54 — `target`/`pct`/`gradient`/`trackLeft`/`trackSpan` recomputed per render; `useMemo([milestones])`. L102 — extract memoized `<MilestoneTier>` (motion.li per item runs spring on every parent tick).
- [ ] `components/auth/SignUpForm.tsx` L87 — `useWatch({name:"password"})` rerenders entire form on every password keystroke; only used in one onChange. Read via `getValues("password")` inside handler instead.
- [ ] `components/checkin/CheckinBeacon.tsx` L132 — `relLabel(next.startTime)` countdown badge text only updates on next poll (60s); either add 1-min tick interval or accept staleness explicitly.
- [ ] `components/checkin/CheckinQrDialog.tsx` L48 — `validUntil` rebuilt every render; `useMemo([data?.startTime])`.
- [ ] `components/checkin/ClassCheckinQr.tsx` L77-82 — `BlurredFakeQr` rebuilds 169-cell grid every render; hoist `cells` to module const (grid is static).
- [ ] `components/checkin/ClassCheckinQr.tsx` L70-76 — `isFinder` closure recreated each render; hoist to module scope.
- [ ] `components/responsive/MobileBottomNav.tsx` L29-41 — `Map`/`Set` constructions + `primary`/`overflow` slot derivation on every render; wrap in `useMemo([config])`.
- [ ] `components/SEO.tsx` L15,17,46,48 — default param `image = cdnUrl("/og-image.png")` evaluates `cdnUrl` on every call; hoist default to module const.
- [ ] `components/admin/NumberTicker.tsx` L30 — `fromRef.current = value` reads render-time `value`; should snapshot via ref on prev animation end to avoid stale reads.

## R2 · Next.js Pages Router optimization (highest leverage)

### Marketing pages — SSR per request → should be SSG/ISR

- [ ] `pages/index.tsx` — fully static landing; add `export const getStaticProps = () => ({ props: {} })`. Big TTFB win + better SEO.
- [ ] `pages/founder.tsx` · `pages/rental.tsx` · `pages/policy.tsx` · `pages/terms.tsx` — pure static content; convert to `getStaticProps` with `revalidate`.
- [ ] `pages/cafe.tsx` — mostly static (gallery + heroMedia hard-coded); `getStaticProps`.
- [ ] `pages/classes.tsx` L25 — `/api/classes` always fetched on mount; convert to `getStaticProps` + ISR (class catalog rarely changes). Keep schedule list client-side.
- [ ] `pages/shop.tsx` L91 — `/api/retail-products` fetched in `useEffect`; convert to `getStaticProps` + ISR (60s) for SEO/LCP.
- [ ] `pages/shop/[id].tsx` — product detail per-id, currently client-fetches every load; use `getStaticPaths` + `getStaticProps` with ISR.

### Bundle / code splitting

- [ ] `pages/index.tsx` L17-31 — below-the-fold sections (`Pricing`, `Founder`, `Rental`, `Boutique`, `Testimonial`, `Instructors`) load eagerly; wrap in `next/dynamic` to shrink landing JS bundle.
- [ ] `pages/portal/dashboard.tsx` L16 — `MemberMobileDashboard` always imported even though only mobile renders; wrap both mobile + desktop variants in `next/dynamic({ssr:false})` and gate on `isMobile`.
- [ ] `components/Pagination.tsx` L2 — uses `framer-motion` for trivial transitions; replace with CSS to drop framer from pagination chunk.

### Hero / LCP

- [ ] `components/Hero.tsx` L41-99 — three `<video autoPlay>` mount eagerly; only mid-panel is LCP. Lazy-mount left/right panels via `IntersectionObserver`.
- [ ] `components/Hero.tsx` L41,67,92 — videos missing `preload="metadata"` (default `auto` downloads full MP4 on first paint).
- [ ] `components/Hero.tsx` L42,68,93 — no `poster` attribute → black frame until video buffers, hurts LCP/CLS.

### Auth flash-of-content (FOUC)

- [ ] Move client-side auth redirects to `getServerSideProps` with session check + redirect. Eliminates ~200-400ms unauth flash. Applies to: `admin/{dashboard,cafe,credits,members,schedule,control,CRM,badges,partners,products,kitchen/*,instructors/*}`, `partner/*`, `instructor/dashboard`, `portal/{dashboard,book,bookings,packages,profile,menu}`.

### Image optimization (`<img>` → `next/image`)

- [ ] `components/Footer.tsx` L17 — logo
- [ ] `components/Instructors.tsx` L103,108 — instructor cards
- [ ] `components/Testimonial.tsx` L98 — testimonial portrait
- [ ] `components/profile/ProfileSection.tsx` L434 — avatar preview
- [ ] `pages/instructor/dashboard.tsx` L103 — avatar
- [ ] `pages/admin/schedule.tsx` L1684 — booking avatars
- [ ] `pages/admin/cafe.tsx` L796,927,1144 — menu item images
- [ ] `pages/admin/control.tsx` L1719,2532,2656,2815,2982 — class/instructor previews

### Fonts

- [ ] `styles/globals.css` L1-3 — Google Fonts `@import url()` is render-blocking. Migrate to `next/font/google` (Playfair, Montserrat, Bricolage) in `_app.tsx`. **Single highest-impact LCP win for marketing pages.**

### Scripts

- [ ] `_document.tsx` L11-21 — GA `<script async>` should use `next/script strategy="afterInteractive"`.
- [ ] `_document.tsx` L37-41 — Softgen monitoring inline `<script async>` should be `next/script strategy="lazyOnload"`.
- [ ] `_document.tsx` L7 — add `<link rel="preconnect">` for `fonts.googleapis.com`, `fonts.gstatic.com` (crossOrigin), S3/CDN bucket, `checkout.razorpay.com`.
- [ ] `lib/razorpayCheckout.ts` L65-76 — DOM-injects Razorpay `checkout.js` on first call; preload via `next/script lazyOnload` in `_app` so SDK is ready by user click. Min: add `preconnect` to `checkout.razorpay.com` in `_document`.

### Navigation

- [ ] `pages/classes.tsx` L438 — `router.push("/portal/book")` from click handler should be `<Link href>` (enables prefetch).

### API routes — caching + payload

- [ ] `pages/api/retail-products.ts` L34 — public catalog GET missing `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`; also missing `select` (returns all columns) + unbounded `findMany`.
- [ ] `pages/api/cafe/items.ts` L12 — public-when-anonymous GET missing `Cache-Control: public, s-maxage=30, stale-while-revalidate=120`; unbounded `findMany`.
- [ ] `pages/api/classes.ts` L6 — missing `Cache-Control: s-maxage=300, swr=600`; `include: { instructor: true }` returns `studio_payout_cut_percent` to client (sensitive); switch to `select`.
- [ ] `pages/api/packages.ts` L6 — public package list missing `Cache-Control`.
- [ ] `pages/api/class-schedules.ts` L62 — `private, no-store` even for anonymous list; split anon vs auth: anon gets `public, s-maxage=60, swr=300`.
- [ ] `pages/api/user-stats.ts` L13 — auth-scoped but cacheable per user; add `private, max-age=10, swr=60` to dedupe rapid portal-dashboard refetches.
- [ ] `pages/api/admin/badges.ts` L54,62,68 — 3 unbounded `findMany` on `badgeTemplate`; admin-only but still no `select`/pagination.

### Session / NextAuth

- [ ] `pages/_app.tsx` L51,105 — `DashboardChrome` + `OnboardingGate` both call `useSession()` for full `session` data when status is enough. Causes rerender of these wrappers on every session refresh (every 4 min after our refetchInterval change).
- [ ] `pages/portal/dashboard.tsx` L153 — destructures full `session` then derives role/email; switch to scalar reads.
- [ ] `pages/classes.tsx` L430 — `session` destructure used only for role/id.
- [ ] `pages/_app.tsx` L67 — `/api/partner/profile` fetched client-side after auth; should be passed via `getServerSideProps` on partner pages to avoid topbar logo flash.

### Build config

- [ ] `next.config.mjs` L73 — `images.remotePatterns: [{hostname: "**"}]` overly permissive. Restrict to S3 bucket + CDN domain (security + smaller image optimizer cache key space).
- [ ] `next.config.mjs` — no `images.minimumCacheTTL`; set to `31536000` for CDN images.
- [ ] `next.config.mjs` — no immutable cache headers configured for `/fonts/*` if custom font dir under `src/pages/fonts/` exists (verify).

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
